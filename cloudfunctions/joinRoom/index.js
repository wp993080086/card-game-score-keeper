'use strict'

const cloud = require('wx-server-sdk')

// 按部署环境动态初始化，避免环境 ID 硬编码在云函数侧
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

/**
 * @description 扫码/转发进房：校验房间与满员 → 已在房幂等返回 → 写 room_members
 * @param {object} event { roomCode }
 * @return {Promise<object>} roomId / roomCode
 */
exports.main = async (event) => {
	const { OPENID } = cloud.getWXContext()
	const dbCmd = db.command
	const roomCode = String(event.roomCode || '')
		.trim()
		.toUpperCase()
	if (!roomCode) {
		throw new Error('缺少房号')
	}

	// 进房人资料以 users 集合为准（前端已保证进房前完善资料），不信任入参
	const userRes = await db.collection('users').where({ _openid: OPENID }).limit(1).get()
	const user = userRes.data[0]
	if (!user) {
		throw new Error('请先完善资料')
	}

	// 取最新一条同码房（gaming 判重保证同码最多一个 gaming，最新创建的房代表当前语义）
	const roomRes = await db.collection('rooms').where({ roomCode }).orderBy('createdAt', 'desc').limit(1).get()
	const room = roomRes.data[0]
	if (!room) {
		throw new Error('房间不存在')
	}
	if (room.status === 'dissolved') {
		throw new Error('房间已解散')
	}
	if (room.status === 'settled') {
		throw new Error('该局已结算，无需加入')
	}

	// 幂等：已在房内（未退出）直接返回，重复点卡片/重复扫码不重复登记
	const mineRes = await db.collection('room_members').where({ roomId: room._id, openid: OPENID }).get()
	if (mineRes.data.some((m) => !m.leftAt)) {
		return { roomId: room._id, roomCode }
	}

	// 单房间原则：已在其他进行中的牌局不允许再进房
	// 排除当前房后关联房间一次 in 批量查出（原逐条查询在残留记录多时 N+1 拖慢进房）
	const activeRes = await db
		.collection('room_members')
		.where({ openid: OPENID, leftAt: dbCmd.exists(false) })
		.get()
	const otherIds = [...new Set(activeRes.data.map((m) => m.roomId).filter((id) => id !== room._id))]
	if (otherIds.length) {
		const roomRes = await db
			.collection('rooms')
			.where({ _id: dbCmd.in(otherIds) })
			.get()
		if (roomRes.data.some((r) => r.status === 'gaming')) {
			throw new Error('你已在其他牌局中，请先退出')
		}
	}

	// 满员校验：活跃成员（无 leftAt）达上限则拒绝
	const cntRes = await db
		.collection('room_members')
		.where({ roomId: room._id, leftAt: dbCmd.exists(false) })
		.count()
	if (cntRes.total >= room.maxMembers) {
		throw new Error('房间已满')
	}

	// 云函数端写入不会自动注入 _openid，成员 openid 需显式记录
	await db.collection('room_members').add({
		data: {
			roomId: room._id,
			openid: OPENID,
			nickname: user.nickname,
			avatarUrl: user.avatarUrl,
			joinedAt: db.serverDate()
		}
	})

	// 进房动态进消息流（房间页 watch 渲染）
	await db.collection('messages').add({
		data: {
			roomId: room._id,
			type: 'system',
			senderOpenid: OPENID,
			senderNickname: user.nickname,
			senderAvatar: user.avatarUrl || '',
			content: `${user.nickname} 加入了房间`,
			createdAt: db.serverDate()
		}
	})

	return { roomId: room._id, roomCode }
}
