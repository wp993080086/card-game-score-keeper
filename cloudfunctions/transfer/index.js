'use strict'

const cloud = require('wx-server-sdk')

// 按部署环境动态初始化，避免环境 ID 硬编码在云函数侧
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

/** 单笔积分上限（打牌积分；超出安全整数后累加会丢精度） */
const AMOUNT_MAX = 999999

/** 同一人在同一房间每分钟最多记账次数 */
const TRANSFER_LIMIT = 20

/** 记账次数窗口（毫秒） */
const TRANSFER_WINDOW_MS = 60 * 1000

/** 单房流水上限，再记下去结算分页会拖到云函数超时 */
const ROOM_RECORD_MAX = 800

/** 单次查询上限（补 active 时用） */
const PAGE_SIZE = 100

/**
 * @description 兼容取时间戳
 * @param {Date|number|string} [v] 时间值
 * @return {number} 毫秒时间戳
 */
const _ts = (v) => {
	if (v instanceof Date) return v.getTime()
	const n = Number(v)
	return Number.isFinite(n) ? n : 0
}

/**
 * @description 旧成员记录没有 active。同一人多条未退出记录只留最新一条在场
 * @param {object} where 房间或 openid 条件
 * @return {Promise<void>}
 */
const _backfillActive = async (where) => {
	const _ = db.command
	let migrated = false
	for (let i = 0; i < 10; i++) {
		const pending = await db
			.collection('room_members')
			.where(Object.assign({}, where, { active: _.exists(false) }))
			.limit(1)
			.get()
		if (!pending.data.length) break
		migrated = true
		await db
			.collection('room_members')
			.where(Object.assign({}, where, { active: _.exists(false), leftAt: _.exists(true) }))
			.update({ data: { active: false } })
		await db
			.collection('room_members')
			.where(Object.assign({}, where, { active: _.exists(false), leftAt: _.exists(false) }))
			.update({ data: { active: true } })
	}
	if (!migrated) return
	const active = []
	for (;;) {
		const res = await db
			.collection('room_members')
			.where(Object.assign({}, where, { active: true }))
			.skip(active.length)
			.limit(PAGE_SIZE)
			.get()
		active.push(...res.data)
		if (res.data.length < PAGE_SIZE || active.length >= 500) break
	}
	const groups = new Map()
	for (const m of active) {
		const key = `${m.roomId}\n${m.openid}`
		const arr = groups.get(key)
		if (arr) arr.push(m)
		else groups.set(key, [m])
	}
	for (const list of groups.values()) {
		if (list.length < 2) continue
		let keeper = list[0]
		for (const m of list) {
			if (_ts(m.joinedAt) >= _ts(keeper.joinedAt)) keeper = m
		}
		for (const m of list) {
			if (m._id === keeper._id) continue
			await db
				.collection('room_members')
				.doc(m._id)
				.update({
					data: { active: false, leftAt: m.leftAt || db.serverDate() }
				})
		}
	}
}

/**
 * @description 短时间连续记账计数。窗口内达到上限返回 false
 * @param {string} docId rate_limits 文档 id
 * @return {Promise<boolean>} 是否允许本次记账
 */
const _consumeRate = async (docId) => {
	const now = Date.now()
	const ref = db.collection('rate_limits').doc(docId)
	let count = 0
	let windowStart = now
	try {
		const res = await ref.get()
		const data = res.data
		if (data && typeof data.count === 'number' && now - Number(data.windowStart) < TRANSFER_WINDOW_MS) {
			count = data.count
			windowStart = Number(data.windowStart) || now
		}
	} catch (err) {
		// 尚无记录
	}
	if (count >= TRANSFER_LIMIT) return false
	await ref.set({ data: { count: count + 1, windowStart } })
	return true
}

/**
 * @description 转账唯一入口：服务端全量校验 → 落 game_records（append-only）→ 发 payment 消息
 * @param {object} event { roomId, toOpenid, amount }
 * @return {Promise<object>} recordId
 */
exports.main = async (event) => {
	const { OPENID } = cloud.getWXContext()
	const roomId = String(event.roomId || '')
	const toOpenid = String(event.toOpenid || '')
	const amount = Number(event.amount)

	if (!roomId) throw new Error('缺少房间')
	if (!toOpenid) throw new Error('缺少收款人')
	if (!Number.isSafeInteger(amount) || amount < 1 || amount > AMOUNT_MAX) {
		throw new Error('积分须为 1 到 999999 的整数')
	}
	if (toOpenid === OPENID) throw new Error('不能转给自己')

	await _backfillActive({ roomId })

	const mineRes = await db.collection('room_members').where({ roomId, openid: OPENID, active: true }).limit(1).get()
	const fromMember = mineRes.data[0]
	if (!fromMember) throw new Error('你已不在房间内')

	const roomRes = await db.collection('rooms').where({ _id: roomId }).limit(1).get()
	const room = roomRes.data[0]
	if (!room) throw new Error('房间不存在')
	if (room.status === 'settling') throw new Error('房间正在结算')
	if (room.status !== 'gaming') throw new Error('房间已结束')

	const toRes = await db.collection('room_members').where({ roomId, openid: toOpenid, active: true }).limit(1).get()
	const toMember = toRes.data[0]
	if (!toMember) throw new Error('对方已不在房间内')

	const cnt = await db.collection('game_records').where({ roomId }).count()
	if (cnt.total >= ROOM_RECORD_MAX) throw new Error('本局流水过多，请先结算')

	const allowed = await _consumeRate(`xfer_${roomId}_${OPENID}`)
	if (!allowed) throw new Error('记账过于频繁，请稍后再试')

	// 与 settle 把 gaming 改成 settling 互斥：改的是同一份房间文档，状态已不是 gaming 则本笔拒绝
	const guard = await db
		.collection('rooms')
		.where({ _id: roomId, status: 'gaming' })
		.update({ data: { touchAt: db.serverDate() } })
	if (!guard.stats || !guard.stats.updated) throw new Error('房间已结束')

	const { _id: recordId } = await db.collection('game_records').add({
		data: {
			roomId,
			scores: [
				{ openid: OPENID, delta: -amount },
				{ openid: toOpenid, delta: amount }
			],
			createdBy: OPENID,
			createdAt: db.serverDate()
		}
	})

	await db.collection('messages').add({
		data: {
			roomId,
			type: 'payment',
			senderOpenid: OPENID,
			senderNickname: fromMember.nickname,
			senderAvatar: fromMember.avatarUrl || '',
			toOpenid,
			toNickname: toMember.nickname,
			amount,
			createdAt: db.serverDate()
		}
	})

	return { recordId }
}
