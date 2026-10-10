'use strict'

const cloud = require('wx-server-sdk')

// 按部署环境动态初始化，避免环境 ID 硬编码在云函数侧
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

/**
 * @description 查询我的进行中牌局（首页卡片数据源）
 *   与 createRoom 的单房间拦截完全同构：云函数端管理员权限查全部活跃成员记录，
 *   关联房间一次 in 批量查出（原逐条查询在残留记录多时 N+1 拖慢首页），按活跃记录顺序取第一个 gaming——
 *   保证「createRoom 会拦 ⇔ 首页一定显示卡片」两端永不打架。
 *   不取最近一条（历史结算残留的活跃记录可能让最近一条指向已结束房间，导致漏判）
 * @return {Promise<object>} { room: null } 或 { room: { roomId, roomCode, members } }
 */
exports.main = async () => {
	const { OPENID } = cloud.getWXContext()
	const dbCmd = db.command

	// 全部活跃成员记录（leftAt 未写 = 未退出）
	const activeRes = await db
		.collection('room_members')
		.where({ openid: OPENID, leftAt: dbCmd.exists(false) })
		.get()

	// 批量查关联房间状态，按活跃记录顺序取第一个进行中的房间（与 createRoom 拦截语义一致）
	const roomIds = [...new Set(activeRes.data.map((m) => m.roomId))]
	let room = null
	if (roomIds.length) {
		const roomRes = await db
			.collection('rooms')
			.where({ _id: dbCmd.in(roomIds) })
			.get()
		const roomMap = new Map(roomRes.data.map((r) => [r._id, r]))
		for (const m of activeRes.data) {
			const r = roomMap.get(m.roomId)
			if (r && r.status === 'gaming') {
				room = r
				break
			}
		}
	}
	if (!room) {
		return { room: null }
	}

	// 活跃成员列表（按加入顺序，首页卡片头像展示用）
	const memRes = await db
		.collection('room_members')
		.where({ roomId: room._id, leftAt: dbCmd.exists(false) })
		.orderBy('joinedAt', 'asc')
		.get()
	return {
		room: {
			roomId: room._id,
			roomCode: room.roomCode || '',
			members: memRes.data.map((m) => ({
				openid: m.openid || '',
				nickname: m.nickname || '',
				avatarUrl: m.avatarUrl || ''
			}))
		}
	}
}
