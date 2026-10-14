'use strict'

const cloud = require('wx-server-sdk')
const QRCode = require('qrcode')

// 按部署环境动态初始化，避免环境 ID 硬编码在云函数侧
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

/** 4 位短码字符集：去掉 0/O、1/I 等易混淆字符，人工抄写不歧义 */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** 撞码最大重试次数（结算后删除占位，历史房号可复用） */
const MAX_RETRY = 5

/** 云开发自定义文档 id 过短会写入失败，房号前加固定前缀 */
const _codeDocId = (code) => `rc${code}`

/**
 * @description 取出云数据库错误原文，便于提示真正原因
 * @param {object} err 异常
 * @return {string} 短文案
 */
const _errText = (err) => {
	const msg = (err && (err.errMsg || err.message)) || String(err || '')
	return msg.replace(/^Error:\s*/, '').slice(0, 80)
}

/** @description 是否为文档 id 冲突（换一个房号再试） */
const _isDuplicate = (err) => /duplicate|duplicated|already exist|E11000|已存在/i.test(_errText(err))

/**
 * @description 集合不存在时创建。云函数 add 不会自动建表，必须先 createCollection
 * @param {string} name 集合名
 * @return {Promise<void>}
 */
const _ensureCollection = async (name) => {
	if (typeof db.createCollection !== 'function') {
		throw new Error(`请在云开发数据库新建集合 ${name}`)
	}
	try {
		await db.createCollection(name)
	} catch (err) {
		const text = _errText(err)
		if (/not exist/i.test(text)) throw new Error(`请在云开发数据库新建集合 ${name}`, { cause: err })
		if (/exist/i.test(text)) return
		throw err
	}
}

/** 单次查询上限 */
const PAGE_SIZE = 100

/**
 * 房间码二维码内容：纯文本提示（外部微信扫一扫直接看到提示与房号，不用 URL 即无需域名）。
 * 站内 wx.scanCode 扫普通二维码可靠读出该文本，前端首页按「房号：XXXX」解析进房
 * （小程序码真机部分机型拿不到内容，平台限制，故房间码不用小程序码）
 */
const _qrJoinText = (roomCode) => `请在小程序内点击「扫码进房」加入牌局，房号：${roomCode}`

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

/** @description 生成 4 位随机短码 */
const _randomCode = () => {
	let code = ''
	for (let i = 0; i < 4; i++) {
		code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length))
	}
	return code
}

/**
 * @description 占用一个房号。只有 id 冲突才换码
 * @return {Promise<string>} 已占住的房号
 */
const _claimCode = async () => {
	let lastErr = null
	for (let i = 0; i < MAX_RETRY; i++) {
		const code = _randomCode()
		try {
			await db.collection('room_codes').add({
				data: { _id: _codeDocId(code), roomId: '', createdAt: db.serverDate() }
			})
			return code
		} catch (err) {
			lastErr = err
			console.error('[createRoom] 占用房号失败:', _codeDocId(code), err)
			if (_isDuplicate(err)) continue
			throw new Error(`房号分配失败：${_errText(err)}`, { cause: err })
		}
	}
	console.error('[createRoom] 房号多次占用失败:', lastErr)
	throw new Error('房号分配繁忙，请重试')
}

/**
 * @description 生成房间码普通二维码并存云存储（内容为提示文本+房号，站内扫码解析进房）
 * @param {string} roomCode 房间短码
 * @return {Promise<string>} 码文件 fileID，失败返回空串（不阻塞建房）
 */
const _makeQrCode = async (roomCode) => {
	try {
		const buffer = await QRCode.toBuffer(_qrJoinText(roomCode), { width: 600, margin: 2 })
		const { fileID } = await cloud.uploadFile({
			cloudPath: `qrcodes/rooms/${roomCode}-${Date.now()}.png`,
			fileContent: buffer
		})
		return fileID
	} catch (err) {
		console.error('[createRoom] 房间码生成失败:', err)
		return ''
	}
}

/**
 * @description 创建房间：占房号 → 建 rooms → 房主写 room_members → 异步生成普通二维码回填
 * @return {Promise<object>} roomId / roomCode / qrFileID（恒为空串，码由后台异步生成回填）
 */
exports.main = async () => {
	const { OPENID } = cloud.getWXContext()
	const _ = db.command

	await _ensureCollection('room_codes')
	await _ensureCollection('rate_limits')
	await _ensureCollection('app_config')

	const userRes = await db.collection('users').where({ _openid: OPENID }).limit(1).get()
	const owner = userRes.data[0]
	if (!owner) throw new Error('请先完善资料')

	await _backfillActive({ openid: OPENID })
	const activeRes = await db.collection('room_members').where({ openid: OPENID, active: true }).limit(20).get()
	const activeIds = [...new Set(activeRes.data.map((m) => m.roomId))]
	if (activeIds.length) {
		const roomRes = await db
			.collection('rooms')
			.where({ _id: _.in(activeIds) })
			.get()
		if (roomRes.data.some((r) => r.status === 'gaming' || r.status === 'settling')) {
			throw new Error('你已在牌局中，请先结算或退出')
		}
	}

	const roomCode = await _claimCode()
	let roomId = ''
	try {
		const added = await db.collection('rooms').add({
			data: {
				roomCode,
				ownerOpenid: OPENID,
				status: 'gaming',
				maxMembers: 4,
				memberCount: 1,
				adLevel: 0,
				qrFileID: '',
				createdAt: db.serverDate()
			}
		})
		roomId = added._id
		await db.collection('room_codes').doc(_codeDocId(roomCode)).update({ data: { roomId } })
		await db.collection('room_members').add({
			data: {
				roomId,
				openid: OPENID,
				nickname: owner.nickname,
				avatarUrl: owner.avatarUrl,
				active: true,
				joinedAt: db.serverDate()
			}
		})
		await db.collection('messages').add({
			data: {
				roomId,
				type: 'system',
				senderOpenid: OPENID,
				senderNickname: owner.nickname,
				senderAvatar: owner.avatarUrl || '',
				content: `${owner.nickname} 创建了房间`,
				createdAt: db.serverDate()
			}
		})
	} catch (err) {
		if (roomId) {
			await db
				.collection('room_members')
				.where({ roomId })
				.remove()
				.catch(() => {})
			await db
				.collection('rooms')
				.doc(roomId)
				.remove()
				.catch(() => {})
		}
		await db
			.collection('room_codes')
			.doc(_codeDocId(roomCode))
			.remove()
			.catch(() => {})
		throw err
	}

	// 普通二维码异步生成：不阻塞建房返回。生成完回填 rooms.qrFileID，房间页 watcher 会换成真码
	void _makeQrCode(roomCode)
		.then((qrFileID) => qrFileID && db.collection('rooms').doc(roomId).update({ data: { qrFileID } }))
		.catch((err) => console.error('[createRoom] 二维码异步回填失败:', err))

	return { roomId, roomCode, qrFileID: '' }
}
