'use strict'

const cloud = require('wx-server-sdk')

// 按部署环境动态初始化，避免环境 ID 硬编码在云函数侧
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

/** 单次查询上限 */
const PAGE_SIZE = 100

/** 房间结束后 messages 保留时长（成员回看最终动态），超时由本函数惰性删除 */
const MESSAGE_KEEP_MS = 5 * 60 * 1000

/** 单次清理的房间数上限（防止积压时一次删太多拖慢响应） */
const CLEAN_BATCH = 20

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
 * @description 惰性清理已结束房间的 messages：结算/解散后保留 MESSAGE_KEEP_MS 供成员回看，
 *   之后每次有人打开首页就顺手删一批（云函数 return 后进程冻结，做不了定时器）。
 *   对局详情/流水走 settlements/game_records，messages 删除不影响任何历史查看
 * @return {Promise<void>} 失败静默，不阻塞主流程
 */
const _cleanEndedMessages = async () => {
	const _ = db.command
	try {
		const ended = await db
			.collection('rooms')
			.where({ status: _.in(['settled', 'dissolved']), endedAt: _.lt(new Date(Date.now() - MESSAGE_KEEP_MS)) })
			.limit(CLEAN_BATCH)
			.get()
		const ids = ended.data.map((r) => r._id).filter(Boolean)
		if (!ids.length) return
		const res = await db
			.collection('messages')
			.where({ roomId: _.in(ids) })
			.remove()
		console.log('[getOngoingRoom] 清理已结束房间消息:', ids.length, '个房间, 删除', (res && res.deleted) || 0, '条')
	} catch (err) {
		console.error('[getOngoingRoom] 清理已结束房间消息失败:', err)
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

	// 顺手清理结束超时的房间消息（失败静默，不影响主流程）
	await _cleanEndedMessages()

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
