'use strict'

const cloud = require('wx-server-sdk')

// 按部署环境动态初始化，避免环境 ID 硬编码在云函数侧
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

/** 单次查询上限 */
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
 * @description 查询我的进行中牌局（首页卡片数据源）
 *   在场只看 active == true。结算进行中（settling）仍算进行中，方便房主回来把这局结完
 * @return {Promise<object>} { room: null } 或 { room: { roomId, roomCode, members } }
 */
exports.main = async () => {
	const { OPENID } = cloud.getWXContext()
	const _ = db.command

	await _backfillActive({ openid: OPENID })
	const activeRes = await db.collection('room_members').where({ openid: OPENID, active: true }).limit(20).get()

	const roomIds = [...new Set(activeRes.data.map((m) => m.roomId))]
	let room = null
	if (roomIds.length) {
		const roomRes = await db
			.collection('rooms')
			.where({ _id: _.in(roomIds) })
			.get()
		const roomMap = new Map(roomRes.data.map((r) => [r._id, r]))
		for (const m of activeRes.data) {
			const r = roomMap.get(m.roomId)
			if (r && (r.status === 'gaming' || r.status === 'settling')) {
				room = r
				break
			}
		}
	}
	if (!room) return { room: null }

	await _backfillActive({ roomId: room._id })
	const memRes = await db.collection('room_members').where({ roomId: room._id, active: true }).limit(20).get()
	const members = memRes.data.slice().sort((a, b) => _ts(a.joinedAt) - _ts(b.joinedAt))
	return {
		room: {
			roomId: room._id,
			roomCode: room.roomCode || '',
			members: members.map((m) => ({
				openid: m.openid || '',
				nickname: m.nickname || '',
				avatarUrl: m.avatarUrl || ''
			}))
		}
	}
}
