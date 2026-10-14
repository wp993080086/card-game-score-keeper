'use strict'

const cloud = require('wx-server-sdk')

// 按部署环境动态初始化，避免环境 ID 硬编码在云函数侧
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

/** 单次查询上限（云函数端默认 100） */
const PAGE_SIZE = 100

/** 首页小程序码只生成一次，fileID 记在这份固定文档 */
const HOME_QR_DOC = 'home_qr'

/** 房号占位文档 id（rc + 4 位房号） */
const _codeDocId = (code) => `rc${code}`

/**
 * @description 兼容取时间戳（serverDate 读出为 Date）
 * @param {Date|number|string} [v] 时间值
 * @return {number} 毫秒时间戳，无法解析返回 0
 */
const _ts = (v) => {
	if (v instanceof Date) return v.getTime()
	const n = Number(v)
	return Number.isFinite(n) ? n : 0
}

/**
 * @description 条件更新命中的文档数
 * @param {object} res update 返回值
 * @return {number} 更新条数
 */
const _updated = (res) => (res && res.stats && res.stats.updated) || 0

/**
 * @description 旧成员记录没有 active。同一人多条未退出记录只留 joinedAt 最新的一条在场，其余视为重复历史
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
 * @description 分页取全房间转账记录（append-only，超出单次 limit 时循环补齐）
 * @param {string} roomId 房间 id
 * @return {Promise<object[]>} 全部转账记录
 */
const _fetchAllRecords = async (roomId) => {
	const all = []
	for (;;) {
		const res = await db.collection('game_records').where({ roomId }).skip(all.length).limit(PAGE_SIZE).get()
		all.push(...res.data)
		if (res.data.length < PAGE_SIZE) return all
	}
}

/**
 * @description 分页取全房间成员（joinedAt 升序，后写的覆盖先写的）
 * @param {string} roomId 房间 id
 * @return {Promise<object[]>} 全部成员记录
 */
const _fetchMembers = async (roomId) => {
	const all = []
	for (;;) {
		const res = await db.collection('room_members').where({ roomId }).orderBy('joinedAt', 'asc').skip(all.length).limit(PAGE_SIZE).get()
		all.push(...res.data)
		if (res.data.length < PAGE_SIZE) return all
	}
}

/**
 * @description 汇总净额 + 贪心计算最少转账方案（不落库）
 * @param {string} roomId 房间 id
 * @return {Promise<object>} { transfers, netScores, recordCount }
 */
const _calcSettlement = async (roomId) => {
	await _backfillActive({ roomId })
	const records = await _fetchAllRecords(roomId)
	const net = {}
	for (const rec of records) {
		for (const s of rec.scores || []) {
			net[s.openid] = (net[s.openid] || 0) + (s.delta || 0)
		}
	}

	// joinedAt 升序读完，后写覆盖，与「取最新一条成员资料」一致
	const members = await _fetchMembers(roomId)
	const info = {}
	for (const m of members) {
		info[m.openid] = m
	}

	// 无流水的在场成员兜底 0 分（否则零流水对局结算页「每人累计输赢」空白）
	for (const m of members) {
		if (m.active && !(m.openid in net)) {
			net[m.openid] = 0
		}
	}

	// 贪心：收款方/付款方按待处理额度降序配对，单笔取小者，清零一方移出
	const creditors = Object.keys(net)
		.filter((k) => net[k] > 0)
		.map((k) => ({ openid: k, rest: net[k] }))
		.sort((a, b) => b.rest - a.rest)
	const debtors = Object.keys(net)
		.filter((k) => net[k] < 0)
		.map((k) => ({ openid: k, rest: -net[k] }))
		.sort((a, b) => b.rest - a.rest)
	const transfers = []
	let ci = 0
	let di = 0
	while (ci < creditors.length && di < debtors.length) {
		const c = creditors[ci]
		const d = debtors[di]
		const amount = Math.min(c.rest, d.rest)
		if (amount > 0) {
			transfers.push({ fromOpenid: d.openid, toOpenid: c.openid, amount })
			c.rest -= amount
			d.rest -= amount
		}
		if (c.rest === 0) ci++
		if (d.rest === 0) di++
	}

	const netScores = Object.keys(net)
		.map((k) => ({
			openid: k,
			nickname: (info[k] && info[k].nickname) || '牌友',
			avatarUrl: (info[k] && info[k].avatarUrl) || '',
			delta: net[k]
		}))
		.sort((a, b) => b.delta - a.delta)

	return { transfers, netScores, recordCount: records.length }
}

/**
 * @description 读取已生成的首页码
 * @return {Promise<string>} fileID，没有则空串
 */
const _readHomeQr = async () => {
	try {
		const res = await db.collection('app_config').doc(HOME_QR_DOC).get()
		return (res.data && res.data.fileID) || ''
	} catch (err) {
		return ''
	}
}

/**
 * @description 首页小程序码只生成一次（scene='h' 非合法房码，首页扫码解析时自动忽略）
 * @return {Promise<string>} 码文件 fileID，失败返回空串（不阻塞结算）
 */
const _makeHomeQr = async () => {
	const cached = await _readHomeQr()
	if (cached) return cached
	try {
		const res = await cloud.openapi.wxacode.getUnlimited({ scene: 'h', checkPath: false })
		const uploaded = await cloud.uploadFile({
			cloudPath: `qrcodes/home-${Date.now()}.png`,
			fileContent: res.buffer
		})
		const fileID = uploaded.fileID || ''
		if (!fileID) return ''
		await db
			.collection('app_config')
			.doc(HOME_QR_DOC)
			.set({
				data: { fileID, createdAt: db.serverDate() }
			})
		return fileID
	} catch (err) {
		console.error('[settle] 首页码生成失败:', err)
		return ''
	}
}

/**
 * @description 取该房间确认时间最新的一份快照
 * @param {string} roomId 房间 id
 * @return {Promise<object|null>} 快照文档
 */
const _loadSnapshot = async (roomId) => {
	const sRes = await db.collection('settlements').where({ roomId }).orderBy('confirmedAt', 'desc').limit(1).get()
	return sRes.data[0] || null
}

/**
 * @description 把快照整理成接口返回
 * @param {object} snapshot 结算快照
 * @return {object} 已结算结果
 */
const _snapshotResult = (snapshot) => ({
	transfers: snapshot.transfers || [],
	netScores: snapshot.netScores || [],
	settled: true,
	recordCount: snapshot.recordCount || 0,
	settledAt: snapshot.confirmedAt || null,
	homeQrFileID: snapshot.homeQrFileID || ''
})

/**
 * @description 结算收尾：在场成员写 leftAt、人数归零、释放房号。重复调用无副作用
 * @param {object} room 房间文档
 * @return {Promise<void>}
 */
const _ensureClosed = async (room) => {
	const roomId = room._id
	await db
		.collection('room_members')
		.where({ roomId, active: true })
		.update({ data: { active: false, leftAt: db.serverDate() } })
	// endedAt 供 getOngoingRoom 惰性清理消息（结束超 5 分钟后删该房间 messages）；重复调用会刷新时间戳，无害
	await db
		.collection('rooms')
		.doc(roomId)
		.update({ data: { memberCount: 0, endedAt: db.serverDate() } })
	if (!room.roomCode) return
	for (const id of [_codeDocId(room.roomCode), room.roomCode]) {
		try {
			const codeRes = await db.collection('room_codes').doc(id).get()
			if (codeRes.data && codeRes.data.roomId === roomId) {
				await db.collection('room_codes').doc(id).remove()
			}
		} catch (err) {
			// 房号已经释放
		}
	}
}

/**
 * @description 结算：preview=true 只算方案不落库（参与过的人可看，含已退出）；否则落库（仅房主）
 *   落库先把 gaming 条件更新为 settling，与 transfer 的同文档条件更新互斥。卡在 settling 时房主可重入结完
 * @param {object} event { roomId, preview }
 * @return {Promise<object>} { transfers, netScores, settled, recordCount, settledAt, homeQrFileID }
 */
exports.main = async (event) => {
	const { OPENID } = cloud.getWXContext()
	const roomId = String(event.roomId || '')
	const preview = !!event.preview
	if (!roomId) throw new Error('缺少房间')

	const roomRes = await db.collection('rooms').where({ _id: roomId }).limit(1).get()
	const room = roomRes.data[0]
	if (!room) throw new Error('房间不存在')

	// 打过的人仍能看战绩（含已退出）；确认落库仍然只允许房主
	const joined = await db.collection('room_members').where({ roomId, openid: OPENID }).limit(1).get()
	if (!joined.data.length) throw new Error('你不在该房间')

	if (room.status === 'settled') {
		const snapshot = await _loadSnapshot(roomId)
		if (!snapshot) throw new Error('结算数据缺失')
		// 确认请求重入时补做收尾（上次在改状态之后中断）
		if (!preview) await _ensureClosed(room)
		return _snapshotResult(snapshot)
	}
	if (room.status !== 'gaming' && room.status !== 'settling') {
		throw new Error('房间已解散')
	}

	if (preview) {
		const calc = await _calcSettlement(roomId)
		return { transfers: calc.transfers, netScores: calc.netScores, settled: false, recordCount: calc.recordCount }
	}

	if (room.ownerOpenid !== OPENID) throw new Error('仅房主可结算')

	// 云开发事务不能跨集合写 rooms + game_records。条件更新同一份房间文档：
	// transfer 要求 status 仍为 gaming；这里把 gaming 改成 settling 后，转账的更新会落空
	if (room.status === 'gaming') {
		const locked = await db
			.collection('rooms')
			.where({ _id: roomId, status: 'gaming' })
			.update({ data: { status: 'settling' } })
		if (!_updated(locked)) {
			const again = await db.collection('rooms').doc(roomId).get()
			const status = again.data && again.data.status
			if (status === 'settled') {
				const snapshot = await _loadSnapshot(roomId)
				if (!snapshot) throw new Error('结算数据缺失')
				return _snapshotResult(snapshot)
			}
			throw new Error('结算进行中，请稍后重试')
		}
	}

	const calc = await _calcSettlement(roomId)
	const homeQrFileID = await _makeHomeQr()
	await db
		.collection('settlements')
		.doc(roomId)
		.set({
			data: {
				roomId,
				transfers: calc.transfers,
				netScores: calc.netScores,
				recordCount: calc.recordCount,
				homeQrFileID,
				confirmedBy: OPENID,
				confirmedAt: db.serverDate()
			}
		})

	// 只有抢到 settling → settled 的这一次负责清人和释放房号，避免并发确认写两份收尾
	const finished = await db
		.collection('rooms')
		.where({ _id: roomId, status: 'settling' })
		.update({ data: { status: 'settled', memberCount: 0 } })
	if (!_updated(finished)) {
		const snapshot = await _loadSnapshot(roomId)
		if (!snapshot) throw new Error('结算数据缺失')
		return _snapshotResult(snapshot)
	}

	await _ensureClosed(Object.assign({}, room, { status: 'settled', memberCount: 0 }))

	const mine = calc.netScores.find((s) => s.openid === OPENID)
	await db.collection('messages').add({
		data: {
			roomId,
			type: 'system',
			senderOpenid: OPENID,
			senderNickname: mine ? mine.nickname : '',
			senderAvatar: mine ? mine.avatarUrl : '',
			content: calc.transfers.length ? `本局已结算，共 ${calc.transfers.length} 笔转账待执行` : '本局已结算，无需转账',
			createdAt: db.serverDate()
		}
	})

	return {
		transfers: calc.transfers,
		netScores: calc.netScores,
		settled: true,
		recordCount: calc.recordCount,
		homeQrFileID
	}
}
