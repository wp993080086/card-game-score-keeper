'use strict'

const cloud = require('wx-server-sdk')

// 按部署环境动态初始化，避免环境 ID 硬编码在云函数侧
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

/** 单次查询上限（云函数端默认 100） */
const PAGE_SIZE = 100

/** in 查询分批大小（防御 roomId 数量过大） */
const IN_BATCH = 50

/**
 * @description 分页取全集合记录（where 条件固定，超出单次 limit 时循环补齐）
 * @param {string} name 集合名
 * @param {object} where 查询条件
 * @return {Promise<object[]>} 全部记录
 */
const _fetchAll = async (name, where) => {
	const all = []
	for (;;) {
		const res = await db.collection(name).where(where).skip(all.length).limit(PAGE_SIZE).get()
		all.push(...res.data)
		if (res.data.length < PAGE_SIZE) {
			return all
		}
	}
}

/**
 * @description 按房间 id 分批 in 查询取全记录（in 条目过多时拆批）
 * @param {string} name 集合名
 * @param {string[]} ids 房间 id 列表
 * @param {object} [extra] 附加查询条件
 * @param {string} [field] id 匹配字段名（rooms 集合主键是 _id，成员/快照/流水集合用 roomId）
 * @return {Promise<object[]>} 全部记录
 */
const _fetchByRoomIds = async (name, ids, extra, field = 'roomId') => {
	const all = []
	for (let i = 0; i < ids.length; i += IN_BATCH) {
		const where = Object.assign({ [field]: _.in(ids.slice(i, i + IN_BATCH)) }, extra || {})
		const batch = await _fetchAll(name, where)
		all.push(...batch)
	}
	return all
}

/**
 * @description 兼容取时间戳（serverDate 读出为 Date 对象，其他类型尝试毫秒解析）
 * @param {Date|number|string} [v] 时间值
 * @return {number} 毫秒时间戳，无法解析返回 0
 */
const _ts = (v) => {
	if (v instanceof Date) return v.getTime()
	const n = Number(v)
	return Number.isFinite(n) ? n : 0
}

/**
 * @description 聚合我的全部已结算对局（战绩页数据源，跨房间）
 *   口径：只统计 status=settled 的房间；净额、笔数、人数、时间都取结算快照（同一房间多份时留确认时间最新的一份）
 * @return {Promise<object>} { games: [{ roomId, roomCode, count, net, memberCount, lastTime }] }（lastTime 毫秒时间戳，倒序）
 */
exports.main = async () => {
	const { OPENID } = cloud.getWXContext()
	if (!OPENID) {
		throw new Error('缺少身份')
	}

	// 我参与过的房间聚合：按 roomId 分组取最新 joinedAt（一个房间一条结果）。
	// 不全量拉 room_members——每次退房重进都会多一条记录，历史增长后全量拉取越来越慢
	const $ = db.command.aggregate
	const mineAgg = await db
		.collection('room_members')
		.aggregate()
		.match({ openid: OPENID })
		.group({ _id: '$roomId', lastJoinedAt: $.max('$joinedAt') })
		.end()
	const mine = mineAgg.list || []
	const roomIds = mine.map((m) => m._id)
	if (!roomIds.length) {
		return { games: [] }
	}

	// 只统计已结算对局（打牌中/已解散不进战绩）；rooms 主键是 _id，匹配字段需显式指定
	const settledRooms = await _fetchByRoomIds('rooms', roomIds, { status: 'settled' }, '_id')
	if (!settledRooms.length) {
		return { games: [] }
	}
	const settledIds = settledRooms.map((r) => r._id)

	// 结算快照：同一房间有多份时按确认时间留最新一份。不再把流水重加一遍
	const snapshots = await _fetchByRoomIds('settlements', settledIds)
	const snapMap = {}
	for (const s of snapshots) {
		const prev = snapMap[s.roomId]
		if (!prev || _ts(s.confirmedAt) >= _ts(prev.confirmedAt)) {
			snapMap[s.roomId] = s
		}
	}

	const codeMap = {}
	for (const r of settledRooms) {
		codeMap[r._id] = r.roomCode || ''
	}

	// 各房间最新加入时间（无快照确认时间时的兜底，避免落到 1970）
	const joinTsMap = {}
	for (const m of mine) {
		joinTsMap[m._id] = _ts(m.lastJoinedAt)
	}

	const games = settledIds.map((id) => {
		const snap = snapMap[id]
		const scores = (snap && snap.netScores) || []
		const mineScore = scores.find((s) => s.openid === OPENID)
		return {
			roomId: id,
			roomCode: codeMap[id],
			count: (snap && snap.recordCount) || 0,
			net: mineScore ? mineScore.delta || 0 : 0,
			memberCount: scores.length || 1,
			lastTime: _ts(snap && snap.confirmedAt) || joinTsMap[id] || 0
		}
	})

	games.sort((x, y) => y.lastTime - x.lastTime)
	return { games }
}
