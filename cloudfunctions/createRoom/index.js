'use strict'

const cloud = require('wx-server-sdk')

// 按部署环境动态初始化，避免环境 ID 硬编码在云函数侧
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

/** 4 位短码字符集：去掉 0/O、1/I 等易混淆字符，人工抄写不歧义 */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** 撞码最大重试次数（仅与进行中房间判重，历史房码可复用） */
const MAX_RETRY = 5

/** @description 生成 4 位随机短码 */
const _randomCode = () => {
	let code = ''
	for (let i = 0; i < 4; i++) {
		code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length))
	}
	return code
}

/**
 * @description 取一个未被进行中房间占用的短码（最多重试 MAX_RETRY 次）
 * @return {Promise<string>} 可用的房间短码
 */
const _pickCode = async () => {
	for (let i = 0; i < MAX_RETRY; i++) {
		const code = _randomCode()
		const { total } = await db.collection('rooms').where({ roomCode: code, status: 'gaming' }).count()
		if (total === 0) {
			return code
		}
	}
	throw new Error('房号分配繁忙，请重试')
}

/**
 * @description 生成房间小程序码并存云存储（scene=roomCode，扫码进首页后解析进房）
 * @param {string} roomCode 房间短码
 * @return {Promise<string>} 码文件 fileID，失败返回空串（不阻塞建房）
 */
const _makeQrCode = async (roomCode) => {
	try {
		const res = await cloud.openapi.wxacode.getUnlimited({
			scene: roomCode,
			// 开发阶段页面未发布，跳过路径校验；不传 page 默认进首页
			checkPath: false
		})
		const { fileID } = await cloud.uploadFile({
			cloudPath: `qrcodes/rooms/${roomCode}-${Date.now()}.png`,
			fileContent: res.buffer
		})
		return fileID
	} catch (err) {
		// 码生成失败不影响建房，房间页需要时另行重试
		console.error('[createRoom] 小程序码生成失败:', err)
		return ''
	}
}

/**
 * @description 创建房间：分配短码 → 建 rooms → 房主写 room_members → 生成小程序码回填
 * @return {Promise<object>} roomId / roomCode / qrFileID
 */
exports.main = async () => {
	const { OPENID } = cloud.getWXContext()
	const dbCmd = db.command

	// 房主资料以 users 集合为准（前端已保证建房前完善资料），不信任入参
	const userRes = await db.collection('users').where({ _openid: OPENID }).limit(1).get()
	const owner = userRes.data[0]
	if (!owner) {
		throw new Error('请先完善资料')
	}

	// 单房间原则：已在进行中的牌局不允许再建房（历史房间已结束的不算）
	const activeRes = await db
		.collection('room_members')
		.where({ openid: OPENID, leftAt: dbCmd.exists(false) })
		.get()
	for (const m of activeRes.data) {
		const r = await db.collection('rooms').where({ _id: m.roomId }).limit(1).get()
		if (r.data[0] && r.data[0].status === 'gaming') {
			throw new Error('你已在牌局中，请先结算或退出')
		}
	}

	const roomCode = await _pickCode()

	const { _id: roomId } = await db.collection('rooms').add({
		data: {
			roomCode,
			ownerOpenid: OPENID,
			status: 'gaming',
			maxMembers: 4,
			adLevel: 0,
			qrFileID: '',
			createdAt: db.serverDate()
		}
	})

	// 云函数端写入不会自动注入 _openid，成员 openid 需显式记录
	await db.collection('room_members').add({
		data: {
			roomId,
			openid: OPENID,
			nickname: owner.nickname,
			avatarUrl: owner.avatarUrl,
			joinedAt: db.serverDate()
		}
	})

	// 建房动态进消息流（房间页 watch 渲染）
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

	// 码生成不阻塞建房；fileID 为空串时房间页可另行重试
	const qrFileID = await _makeQrCode(roomCode)
	if (qrFileID) {
		await db.collection('rooms').doc(roomId).update({ data: { qrFileID } })
	}

	return { roomId, roomCode, qrFileID }
}
