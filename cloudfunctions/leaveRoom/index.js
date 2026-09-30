'use strict'

const cloud = require('wx-server-sdk')

// 按部署环境动态初始化，避免环境 ID 硬编码在云函数侧
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

/**
 * @description 退出房间：成员写 leftAt 软删 + 系统消息；房主退出 = 全员清出 + status=dissolved + 系统消息
 * @param {object} event { roomId }
 * @return {Promise<object>} { left, dissolved }
 */
exports.main = async (event) => {
	const { OPENID } = cloud.getWXContext()
	const roomId = String(event.roomId || '')
	if (!roomId) {
		throw new Error('缺少房间')
	}
	const dbCmd = db.command

	const roomRes = await db.collection('rooms').where({ _id: roomId }).limit(1).get()
	const room = roomRes.data[0]
	if (!room) {
		throw new Error('房间不存在')
	}

	// 自己的在场记录
	const mineRes = await db
		.collection('room_members')
		.where({ roomId, openid: OPENID, leftAt: dbCmd.exists(false) })
		.limit(1)
		.get()
	const mine = mineRes.data[0]
	if (!mine) {
		throw new Error('你已不在房间内')
	}

	// 房主退出 = 解散：全员写 leftAt 清出 + 置 dissolved
	if (room.ownerOpenid === OPENID) {
		if (room.status !== 'gaming') {
			throw new Error('房间已结束')
		}
		await db
			.collection('room_members')
			.where({ roomId, leftAt: dbCmd.exists(false) })
			.update({ data: { leftAt: db.serverDate() } })
		await db
			.collection('rooms')
			.doc(roomId)
			.update({ data: { status: 'dissolved' } })
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

	// 成员退出：软删自己的记录（房间继续）
	await db
		.collection('room_members')
		.doc(mine._id)
		.update({ data: { leftAt: db.serverDate() } })
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
