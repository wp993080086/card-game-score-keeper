/**
 * 对局战绩相关云函数调用封装（仅小程序端）
 */
import { callCloud } from './cloud'

/** @description 一局已结算对局的聚合信息 */
export interface I_GameItem {
	roomId: string
	roomCode: string
	/** 转账流水笔数 */
	count: number
	/** 本人净输赢（只统计包含本人的转账记录） */
	net: number
	/** 参与人数（取结算快照口径，与对局详情页一致） */
	memberCount: number
	/** 归档时间戳（毫秒）：最后转账时间，无流水退结算时间/加入时间 */
	lastTime: number
}

/**
 * @description 拉取我的全部已结算对局（服务端聚合，跨房间，按时间倒序）
 * @return 对局列表
 */
export function getMyGames(): Promise<{ games: I_GameItem[] }> {
	return callCloud<{ games: I_GameItem[] }>('getMyGames')
}

/** @description 一笔原始转账流水（from/to 已映射昵称） */
export interface I_FlowItem {
	id: string
	from: string
	to: string
	amount: number
	/** 转账时间（serverDate 序列化的 ISO 串） */
	createdAt: string | null
}

/**
 * @description 拉取本房间全部原始转账流水（流水明细页，按时间倒序）
 * @param roomId 房间 id
 * @return 房号 + 流水列表
 */
export function getRoomFlow(roomId: string): Promise<{ roomCode: string; flow: I_FlowItem[] }> {
	return callCloud<{ roomCode: string; flow: I_FlowItem[] }>('getRoomFlow', { roomId })
}
