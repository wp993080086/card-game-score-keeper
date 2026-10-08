'use strict'

const cloud = require('wx-server-sdk')

// 按部署环境动态初始化，避免环境 ID 硬编码在云函数侧
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

/** 单次查询上限（云函数端默认 100） */
const PAGE_SIZE = 100

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
		if (res.data.length < PAGE_SIZE) {
			return all
		}
	}
}

/**
 * @description 汇总净额 + 贪心计算最少转账方案（不落库）
 * @param {string} roomId 房间 id
 * @return {Promise<object>} { transfers, netScores }
 */
const _calcSettlement = async (roomId) => {
	// 汇总净额（含已退出成员的账目，欠账不能消失）
	const records = await _fetchAllRecords(roomId)
	const net = {}
	for (const rec of records) {
		for (const s of rec.scores || []) {
			net[s.openid] = (net[s.openid] || 0) + (s.delta || 0)
		}
	}

	// openid → 资料（取最近一次加入记录的昵称头像）
	const memRes = await db.collection('room_members').where({ roomId }).get()
	const info = {}
	for (const m of memRes.data) {
		if (!info[m.openid]) {
			info[m.openid] = m
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

	// 每人净额快照（结算页 MVP/排名展示用），按净额降序
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
 * @description 生成首页小程序码（战绩图底部用；房间已结算，进房码无意义。scene='h' 非合法房码，首页扫码解析时自动忽略）
 * @return {Promise<string>} 码文件 fileID，失败返回空串（不阻塞结算）
 */
const _makeHomeQr = async () => {
	try {
		const res = await cloud.openapi.wxacode.getUnlimited({ scene: 'h', checkPath: false })
		const { fileID } = await cloud.uploadFile({
			cloudPath: `qrcodes/home-${Date.now()}.png`,
			fileContent: res.buffer
		})
		return fileID
	} catch (err) {
		console.error('[settle] 首页码生成失败:', err)
		return ''
	}
}

/**
 * @description 结算：preview=true 只算方案不落库（结算页预览，全员可看）；否则落库（仅房主，已 settled 幂等返回快照）
 * @param {object} event { roomId, preview }
 * @return {Promise<object>} { transfers, netScores, settled, recordCount, settledAt, homeQrFileID }
 */
exports.main = async (event) => {
	const { OPENID } = cloud.getWXContext()
	const roomId = String(event.roomId || '')
	const preview = !!event.preview
	if (!roomId) {
		throw new Error('缺少房间')
	}

	const roomRes = await db.collection('rooms').where({ _id: roomId }).limit(1).get()
	const room = roomRes.data[0]
	if (!room) {
		throw new Error('房间不存在')
	}

	// 已结算：直接返回已有快照（幂等，结算页/对局详情可重复进入）
	if (room.status === 'settled') {
		const sRes = await db.collection('settlements').where({ roomId }).orderBy('confirmedAt', 'desc').limit(1).get()
		const snapshot = sRes.data[0]
		if (!snapshot) {
			throw new Error('结算数据缺失')
		}
		return {
			transfers: snapshot.transfers || [],
			netScores: snapshot.netScores || [],
			settled: true,
			recordCount: snapshot.recordCount || 0,
			settledAt: snapshot.confirmedAt || null,
			homeQrFileID: snapshot.homeQrFileID || ''
		}
	}
	if (room.status !== 'gaming') {
		throw new Error('房间已解散')
	}

	const { transfers, netScores, recordCount } = await _calcSettlement(roomId)
	if (preview) {
		return { transfers, netScores, settled: false, recordCount }
	}

	// 落库仅房主
	if (room.ownerOpenid !== OPENID) {
		throw new Error('仅房主可结算')
	}

	// 首页小程序码（战绩图用），失败不阻塞结算
	const homeQrFileID = await _makeHomeQr()

	await db.collection('settlements').add({
		data: {
			roomId,
			transfers,
			netScores,
			recordCount,
			homeQrFileID,
			confirmedBy: OPENID,
			confirmedAt: db.serverDate()
		}
	})

	await db
		.collection('rooms')
		.doc(roomId)
		.update({ data: { status: 'settled' } })

	// 结算动态进消息流
	const mine = netScores.find((s) => s.openid === OPENID)
	await db.collection('messages').add({
		data: {
			roomId,
			type: 'system',
			senderOpenid: OPENID,
			senderNickname: mine ? mine.nickname : '',
			senderAvatar: mine ? mine.avatarUrl : '',
			content: transfers.length ? `本局已结算，共 ${transfers.length} 笔转账待执行` : '本局已结算，无需转账',
			createdAt: db.serverDate()
		}
	})

	return { transfers, netScores, settled: true, recordCount, homeQrFileID }
}
