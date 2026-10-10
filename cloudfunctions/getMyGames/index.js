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
 *   口径：只统计 status=settled 的房间；净额只算包含本人的转账记录；人数取结算快照（与对局详情一致）
 * @return {Promise<object>} { games: [{ roomId, roomCode, count, net, memberCount, lastTime }] }（lastTime 毫秒时间戳，倒序）
 */
exports.main = async () => {
	const { OPENID } = cloud.getWXContext()
	if (!OPENID) {
		throw new Error('缺少身份')
	}

	// 我参与过的所有房间（含已退出的历史房间）
	const mine = await _fetchAll('room_members', { openid: OPENID })
	const roomIds = [...new Set(mine.map((m) => m.roomId))]
	if (!roomIds.length) {
		return { games: [] }
	}

	// 只统计已结算对局（打牌中/已解散不进战绩）；rooms 主键是 _id，匹配字段需显式指定
	const settledRooms = await _fetchByRoomIds('rooms', roomIds, { status: 'settled' }, '_id')
	if (!settledRooms.length) {
		return { games: [] }
	}
	const settledIds = settledRooms.map((r) => r._id)

	// 结算快照：参与人数 + 结算时间兜底（与对局详情页口径一致）
	const snapshots = await _fetchByRoomIds('settlements', settledIds)
	const snapMap = {}
	for (const s of snapshots) {
		if (!snapMap[s.roomId]) {
			snapMap[s.roomId] = s
		}
	}

	// 全部转账流水
	const records = await _fetchByRoomIds('game_records', settledIds)

	// 按房间聚合：笔数 / 我参与记录的净额 / 打过牌的人 / 最后转账时间
	const agg = {}
	for (const id of settledIds) {
		agg[id] = { count: 0, net: 0, players: {}, lastTime: 0 }
	}
	for (const rec of records) {
		const a = agg[rec.roomId]
		if (!a) {
			continue
		}
		a.count += 1
		for (const s of rec.scores || []) {
			a.players[s.openid] = true
			if (s.openid === OPENID) {
				a.net += s.delta || 0
			}
		}
		const t = _ts(rec.createdAt)
		if (t > a.lastTime) {
			a.lastTime = t
		}
	}

	const codeMap = {}
	for (const r of settledRooms) {
		codeMap[r._id] = r.roomCode || ''
	}

	const games = settledIds.map((id) => {
		const a = agg[id]
		const snap = snapMap[id]
		// 无流水对局：时间退回结算时间，再退回我加入该房的时间
		const joinTs = Math.max(...mine.filter((m) => m.roomId === id).map((m) => _ts(m.createdAt)), 0)
		return {
			roomId: id,
			roomCode: codeMap[id],
			count: a.count,
			net: a.net,
			memberCount: (snap && snap.netScores && snap.netScores.length) || Object.keys(a.players).length || 1,
			lastTime: a.lastTime || _ts(snap && snap.confirmedAt) || joinTs
		}
	})

	games.sort((x, y) => y.lastTime - x.lastTime)
	return { games }
}
