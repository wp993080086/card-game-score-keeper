'use strict'

const cloud = require('wx-server-sdk')

// 按部署环境动态初始化，避免环境 ID 硬编码在云函数侧
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

/**
 * @description 转账唯一入口：服务端全量校验 → 落 game_records（append-only）→ 发 payment 消息
 * @param {object} event { roomId, toOpenid, amount }
 * @return {Promise<object>} recordId
 */
exports.main = async (event) => {
	const { OPENID } = cloud.getWXContext()
	const roomId = String(event.roomId || '')
	const toOpenid = String(event.toOpenid || '')
	const amount = Number(event.amount)
	const dbCmd = db.command

	if (!roomId) {
		throw new Error('缺少房间')
	}
	if (!toOpenid) {
		throw new Error('缺少收款人')
	}
	if (!Number.isInteger(amount) || amount <= 0) {
		throw new Error('积分必须为正整数')
	}
	if (toOpenid === OPENID) {
		throw new Error('不能转给自己')
	}

	// 调用者必须是在场成员（顺带取昵称头像发动态）
	const mineRes = await db
		.collection('room_members')
		.where({ roomId, openid: OPENID, leftAt: dbCmd.exists(false) })
		.limit(1)
		.get()
	const fromMember = mineRes.data[0]
	if (!fromMember) {
		throw new Error('你已不在房间内')
	}

	// 房间必须是进行中
	const roomRes = await db.collection('rooms').where({ _id: roomId }).limit(1).get()
	const room = roomRes.data[0]
	if (!room) {
		throw new Error('房间不存在')
	}
	if (room.status !== 'gaming') {
		throw new Error('房间已结束')
	}

	// 收款人必须是在场成员
	const toRes = await db
		.collection('room_members')
		.where({ roomId, openid: toOpenid, leftAt: dbCmd.exists(false) })
		.limit(1)
		.get()
	const toMember = toRes.data[0]
	if (!toMember) {
		throw new Error('对方已不在房间内')
	}

	// 落账：append-only，两元素净额变动，累计净额由结算时实时汇总
	const { _id: recordId } = await db.collection('game_records').add({
		data: {
			roomId,
			scores: [
				{ openid: OPENID, delta: -amount },
				{ openid: toOpenid, delta: amount }
			],
			createdBy: OPENID,
			createdAt: db.serverDate()
		}
	})

	// 转账动态进消息流（房间页 watch 渲染）
	await db.collection('messages').add({
		data: {
			roomId,
			type: 'payment',
			senderOpenid: OPENID,
			senderNickname: fromMember.nickname,
			senderAvatar: fromMember.avatarUrl || '',
			toOpenid,
			toNickname: toMember.nickname,
			amount,
			createdAt: db.serverDate()
		}
	})

	return { recordId }
}
