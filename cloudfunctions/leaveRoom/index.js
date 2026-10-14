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
 * @description 条件更新命中的文档数
 * @param {object} res update 返回值
 * @return {number} 更新条数
 */
const _updated = (res) => (res && res.stats && res.stats.updated) || 0

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
 * @description 释放房号占位（文档不存在或已指向别的房间时忽略）
 * @param {object} room 房间文档
 * @return {Promise<void>}
 */
const _releaseCode = async (room) => {
	if (!room.roomCode) return
	for (const id of [`rc${room.roomCode}`, room.roomCode]) {
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
 * @description 退出房间：成员写 leftAt 并让出名额；房主退出 = 全员清出 + status=dissolved + 释放房号
 * @param {object} event { roomId }
 * @return {Promise<object>} { left, dissolved }
 */
exports.main = async (event) => {
	const { OPENID } = cloud.getWXContext()
	const roomId = String(event.roomId || '')
	if (!roomId) throw new Error('缺少房间')
	const _ = db.command

	const roomRes = await db.collection('rooms').where({ _id: roomId }).limit(1).get()
	const room = roomRes.data[0]
	if (!room) throw new Error('房间不存在')

	// 结算落库中：房主应把这局结完，不能当成已结束解散；成员可以离开，账还在流水里
	if (room.status === 'settling') {
		await _backfillActive({ roomId })
		const settlingMine = await db.collection('room_members').where({ roomId, openid: OPENID, active: true }).limit(1).get()
		const settlingMember = settlingMine.data[0]
		if (!settlingMember) throw new Error('你已不在房间内')
		if (room.ownerOpenid === OPENID) throw new Error('房间正在结算，请完成结算')
		await db
			.collection('room_members')
			.doc(settlingMember._id)
			.update({ data: { active: false, leftAt: db.serverDate() } })
		await db.collection('messages').add({
			data: {
				roomId,
				type: 'system',
				senderOpenid: OPENID,
				senderNickname: settlingMember.nickname,
				senderAvatar: settlingMember.avatarUrl || '',
				content: `${settlingMember.nickname} 退出了房间`,
				createdAt: db.serverDate()
			}
		})
		return { left: true, dissolved: false }
	}
	if (room.status !== 'gaming') throw new Error('房间已结束')

	await _backfillActive({ roomId })

	const mineRes = await db.collection('room_members').where({ roomId, openid: OPENID, active: true }).limit(1).get()
	const mine = mineRes.data[0]
	if (!mine) throw new Error('你已不在房间内')

	if (room.ownerOpenid === OPENID) {
		const closed = await db
			.collection('rooms')
			.where({ _id: roomId, status: 'gaming' })
			.update({ data: { status: 'dissolved', memberCount: 0 } })
		if (!_updated(closed)) throw new Error('房间已结束')
		await db
			.collection('room_members')
			.where({ roomId, active: true })
			.update({ data: { active: false, leftAt: db.serverDate() } })
		await _releaseCode(room)
		await db.collection('messages').add({
			data: {
				roomId,
				type: 'system',
				senderOpenid: OPENID,
				senderNickname: mine.nickname,
				senderAvatar: mine.avatarUrl || '',
				content: '房主解散了房间',
				createdAt: db.serverDate()
			}
		})
		return { left: true, dissolved: true }
	}

	if (typeof room.memberCount !== 'number') {
		await _backfillActive({ roomId })
		const cnt = await db.collection('room_members').where({ roomId, active: true }).count()
		await db
			.collection('rooms')
			.where({ _id: roomId, memberCount: _.exists(false) })
			.update({ data: { memberCount: cnt.total } })
	}
	const released = await db
		.collection('rooms')
		.where({ _id: roomId, status: 'gaming', memberCount: _.gt(0) })
		.update({ data: { memberCount: _.inc(-1) } })
	if (!_updated(released)) {
		const again = await db.collection('rooms').doc(roomId).get()
		if (!again.data || again.data.status !== 'gaming') throw new Error('房间已结束')
	}

	try {
		await db
			.collection('room_members')
			.doc(mine._id)
			.update({ data: { active: false, leftAt: db.serverDate() } })
	} catch (err) {
		await db
			.collection('rooms')
			.where({ _id: roomId, status: 'gaming' })
			.update({ data: { memberCount: _.inc(1) } })
		throw err
	}

	await db.collection('messages').add({
		data: {
			roomId,
			type: 'system',
			senderOpenid: OPENID,
			senderNickname: mine.nickname,
			senderAvatar: mine.avatarUrl || '',
			content: `${mine.nickname} 退出了房间`,
			createdAt: db.serverDate()
		}
	})
	return { left: true, dissolved: false }
}
