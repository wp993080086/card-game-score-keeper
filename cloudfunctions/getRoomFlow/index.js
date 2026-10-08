'use strict'

const cloud = require('wx-server-sdk')

// 按部署环境动态初始化，避免环境 ID 硬编码在云函数侧
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

/** 单次查询上限（云函数端默认 100） */
const PAGE_SIZE = 100

/**
 * @description 取本房间全部原始转账流水（流水明细页数据源）
 *   口径：调用者须参与过该房（含已退出的历史成员可回看）；流水按时间倒序；from/to 由 scores 正负 delta 还原并映射昵称
 * @param {object} event { roomId }
 * @return {Promise<object>} { roomCode, flow: [{ id, from, to, amount, createdAt }] }
 */
exports.main = async (event) => {
	const { OPENID } = cloud.getWXContext()
	const roomId = String(event.roomId || '')
	if (!roomId) {
		throw new Error('缺少房间')
	}

	const roomRes = await db.collection('rooms').where({ _id: roomId }).limit(1).get()
	const room = roomRes.data[0]
	if (!room) {
		throw new Error('房间不存在')
	}

	// 调用者须参与过该房（防拿 roomId 越权看他人房账）
	const memRes = await db.collection('room_members').where({ roomId, openid: OPENID }).limit(1).get()
	if (!memRes.data.length) {
		throw new Error('你不在该房间')
	}

	// 昵称映射（同 settle 口径：每个 openid 取首条成员记录，含已退出）
	const memAll = await db.collection('room_members').where({ roomId }).get()
	const info = {}
	for (const m of memAll.data) {
		if (!info[m.openid]) {
			info[m.openid] = m
		}
	}

	// 分页取全部流水（时间倒序）
	const records = []
	for (;;) {
		const res = await db.collection('game_records').where({ roomId }).orderBy('createdAt', 'desc').skip(records.length).limit(PAGE_SIZE).get()
		records.push(...res.data)
		if (res.data.length < PAGE_SIZE) {
			break
		}
	}

	// scores 两元素：负 delta 为支出方，正 delta 为收款方
	const flow = []
	for (const rec of records) {
		const neg = (rec.scores || []).find((s) => (s.delta || 0) < 0)
		const pos = (rec.scores || []).find((s) => (s.delta || 0) > 0)
		if (!neg || !pos) {
			continue
		}
		const fromInfo = info[neg.openid]
		const toInfo = info[pos.openid]
		flow.push({
			id: rec._id,
			from: (fromInfo && fromInfo.nickname) || '牌友',
			to: (toInfo && toInfo.nickname) || '牌友',
			amount: pos.delta,
			createdAt: rec.createdAt || null
		})
	}

	return { roomCode: room.roomCode || '', flow }
}
