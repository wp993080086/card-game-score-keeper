'use strict'

const cloud = require('wx-server-sdk')

// 按部署环境动态初始化，避免环境 ID 硬编码在云函数侧
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

/** 单次查询上限 */
const PAGE_SIZE = 100

/** 房号占位文档 id。云开发自定义 id 过短会失败，所以加固定前缀，房号本身仍是 4 位 */
const _codeDocId = (code) => `rc${code}`

/** 进房失败次数上限（4 位房号约 105 万种，按人限流避免被反复试） */
const JOIN_FAIL_LIMIT = 10

/** 失败计数窗口（毫秒） */
const JOIN_FAIL_WINDOW_MS = 60 * 1000

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
 * @description 条件更新命中的文档数
 * @param {object} res update 返回值
 * @return {number} 更新条数
 */
const _updated = (res) => (res && res.stats && res.stats.updated) || 0

/**
 * @description 房间状态对应的进房失败文案
 * @param {string} status 房间状态
 * @return {string} 中文错误
 */
const _statusError = (status) => {
	if (status === 'dissolved') return '房间已解散'
	if (status === 'settled') return '该局已结算，无需加入'
	if (status === 'settling') return '房间正在结算'
	return '房间已结束'
}

/**
 * @description 旧成员记录没有 active。同一人多条未退出记录只留 joinedAt 最新的一条在场
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
 * @description 旧房间没有 memberCount 时，按在场人数补上（只写还没有该字段的文档）
 * @param {string} roomId 房间 id
 * @return {Promise<void>}
 */
const _initMemberCount = async (roomId) => {
	const _ = db.command
	await _backfillActive({ roomId })
	const cnt = await db.collection('room_members').where({ roomId, active: true }).count()
	await db
		.collection('rooms')
		.where({ _id: roomId, memberCount: _.exists(false) })
		.update({ data: { memberCount: cnt.total } })
}

/**
 * @description 读房号占位。不存在返回 null
 * @param {string} roomCode 房号
 * @return {Promise<object|null>} room_codes 文档
 */
const _readCode = async (roomCode) => {
	for (const id of [_codeDocId(roomCode), roomCode]) {
		try {
			const res = await db.collection('room_codes').doc(id).get()
			if (res.data && res.data.roomId) return res.data
		} catch (err) {
			// 这个 id 没有占位
		}
	}
	return null
}

/**
 * @description 删掉仍指向这个房间的房号占位（兼容 rc 前缀和更早的纯房号 id）
 * @param {object} room 房间文档
 * @param {string} roomCode 房号
 * @return {Promise<void>}
 */
const _releaseCode = async (room, roomCode) => {
	const code = room.roomCode || roomCode
	if (!code) return
	for (const id of [_codeDocId(code), code]) {
		try {
			const codeRes = await db.collection('room_codes').doc(id).get()
			if (codeRes.data && codeRes.data.roomId === room._id) {
				await db.collection('room_codes').doc(id).remove()
			}
		} catch (err) {
			// 房号已经释放
		}
	}
}

/**
 * @description 当前窗口内失败次数是否已满
 * @param {string} openid 调用者
 * @return {Promise<boolean>} 已满则为 true
 */
const _joinBlocked = async (openid) => {
	try {
		const res = await db.collection('rate_limits').doc(`join_${openid}`).get()
		const data = res.data
		if (!data || typeof data.count !== 'number') return false
		if (Date.now() - Number(data.windowStart) >= JOIN_FAIL_WINDOW_MS) return false
		return data.count >= JOIN_FAIL_LIMIT
	} catch (err) {
		return false
	}
}

/**
 * @description 记一次进房失败
 * @param {string} openid 调用者
 * @return {Promise<void>}
 */
const _noteJoinFail = async (openid) => {
	const now = Date.now()
	const ref = db.collection('rate_limits').doc(`join_${openid}`)
	let count = 1
	let windowStart = now
	try {
		const res = await ref.get()
		const data = res.data
		if (data && typeof data.count === 'number' && now - Number(data.windowStart) < JOIN_FAIL_WINDOW_MS) {
			count = data.count + 1
			windowStart = Number(data.windowStart) || now
		}
	} catch (err) {
		// 尚无记录
	}
	await ref.set({ data: { count, windowStart } })
}

/**
 * @description 解析可加入的房间。房号占位优先；没有占位时兼容尚未写入 room_codes 的进行中旧房
 * @param {string} roomCode 房号
 * @return {Promise<object>} 房间文档
 */
const _resolveRoom = async (roomCode) => {
	const codeDoc = await _readCode(roomCode)
	if (codeDoc) {
		try {
			const res = await db.collection('rooms').doc(codeDoc.roomId).get()
			if (res.data && res.data._id) return res.data
		} catch (err) {
			// 占位指向的房间不存在，继续走下面的提示
		}
	}
	const res = await db.collection('rooms').where({ roomCode }).orderBy('createdAt', 'desc').limit(10).get()
	const gaming = res.data.find((r) => r.status === 'gaming')
	if (gaming) {
		try {
			await db.collection('room_codes').add({
				data: { _id: _codeDocId(gaming.roomCode), roomId: gaming._id, createdAt: db.serverDate() }
			})
		} catch (err) {
			// 并发补写，占位已在
		}
		return gaming
	}
	if (res.data[0]) throw new Error(_statusError(res.data[0].status))
	throw new Error('房间不存在')
}

/**
 * @description 在房间文档上占一个名额。状态不是 gaming 或人数已满时更新落空
 * @param {object} room 房间文档
 * @return {Promise<boolean>} 是否占到名额
 */
const _takeSeat = async (room) => {
	const _ = db.command
	if (typeof room.memberCount !== 'number') await _initMemberCount(room._id)
	const res = await db
		.collection('rooms')
		.where({ _id: room._id, status: 'gaming', memberCount: _.lt(room.maxMembers || 4) })
		.update({ data: { memberCount: _.inc(1) } })
	return _updated(res) > 0
}

/**
 * @description 扫码/转发进房
 * @param {string} openid 调用者
 * @param {object} event { roomCode }
 * @return {Promise<object>} roomId / roomCode
 */
const _join = async (openid, event) => {
	const _ = db.command
	const roomCode = String(event.roomCode || '')
		.trim()
		.toUpperCase()
	if (!roomCode) throw new Error('缺少房号')

	const userRes = await db.collection('users').where({ _openid: openid }).limit(1).get()
	const user = userRes.data[0]
	if (!user) throw new Error('请先完善资料')

	const room = await _resolveRoom(roomCode)
	if (room.status !== 'gaming') {
		// 结算或解散若在释放房号前中断，房号会一直占着。这里补删，之后可以再用
		if (room.status === 'settled' || room.status === 'dissolved') {
			await _releaseCode(room, roomCode)
		}
		throw new Error(_statusError(room.status))
	}

	await _backfillActive({ openid })

	const mineRes = await db.collection('room_members').where({ roomId: room._id, openid, active: true }).limit(1).get()
	if (mineRes.data.length) return { roomId: room._id, roomCode: room.roomCode || roomCode }

	const activeRes = await db.collection('room_members').where({ openid, active: true }).limit(20).get()
	const otherIds = [...new Set(activeRes.data.map((m) => m.roomId).filter((id) => id !== room._id))]
	if (otherIds.length) {
		const others = await db
			.collection('rooms')
			.where({ _id: _.in(otherIds) })
			.get()
		if (others.data.some((r) => r.status === 'gaming' || r.status === 'settling')) {
			throw new Error('你已在其他牌局中，请先退出')
		}
	}

	const seated = await _takeSeat(room)
	if (!seated) {
		const again = await db.collection('rooms').doc(room._id).get()
		const status = again.data && again.data.status
		if (status !== 'gaming') throw new Error(_statusError(status))
		throw new Error('房间已满')
	}

	let memberId
	try {
		const added = await db.collection('room_members').add({
			data: {
				roomId: room._id,
				openid,
				nickname: user.nickname,
				avatarUrl: user.avatarUrl,
				active: true,
				joinedAt: db.serverDate()
			}
		})
		memberId = added._id
	} catch (err) {
		await db
			.collection('rooms')
			.where({ _id: room._id, status: 'gaming' })
			.update({ data: { memberCount: _.inc(-1) } })
		throw err
	}

	const after = await db.collection('rooms').doc(room._id).get()
	if (!after.data || after.data.status !== 'gaming') {
		await db
			.collection('room_members')
			.doc(memberId)
			.update({ data: { active: false, leftAt: db.serverDate() } })
		throw new Error(_statusError(after.data && after.data.status))
	}

	// 连点进房会各插一条。留下 _id 较小的那条，后写入的这一条让出名额
	const dup = await db.collection('room_members').where({ roomId: room._id, openid, active: true }).limit(5).get()
	if (dup.data.length > 1) {
		const keeper = dup.data.slice().sort((a, b) => String(a._id).localeCompare(String(b._id)))[0]._id
		if (memberId !== keeper) {
			await db
				.collection('room_members')
				.doc(memberId)
				.update({ data: { active: false, leftAt: db.serverDate() } })
			await db
				.collection('rooms')
				.where({ _id: room._id, status: 'gaming', memberCount: _.gt(0) })
				.update({ data: { memberCount: _.inc(-1) } })
			return { roomId: room._id, roomCode: room.roomCode || roomCode }
		}
	}

	await db.collection('messages').add({
		data: {
			roomId: room._id,
			type: 'system',
			senderOpenid: openid,
			senderNickname: user.nickname,
			senderAvatar: user.avatarUrl || '',
			content: `${user.nickname} 加入了房间`,
			createdAt: db.serverDate()
		}
	})

	return { roomId: room._id, roomCode: room.roomCode || roomCode }
}

/**
 * @description 扫码/转发进房：校验房间与满员 → 已在房幂等返回 → 写 room_members
 * @param {object} event { roomCode }
 * @return {Promise<object>} roomId / roomCode
 */
exports.main = async (event) => {
	const { OPENID } = cloud.getWXContext()
	if (await _joinBlocked(OPENID)) throw new Error('尝试过于频繁，请稍后再试')
	try {
		return await _join(OPENID, event)
	} catch (err) {
		try {
			await _noteJoinFail(OPENID)
		} catch (noteErr) {
			console.error('[joinRoom] 记录失败次数出错:', noteErr)
		}
		throw err
	}
}
