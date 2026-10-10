/**
 * 房间相关云函数调用封装（仅小程序端）
 */
import { callCloud } from './cloud'

/** @description createRoom 返回的房间信息 */
export interface I_CreateRoomResult {
	roomId: string
	roomCode: string
	/** 小程序码 fileID，生成失败时为空串 */
	qrFileID: string
}

/**
 * @description 创建房间
 * @return 房间 id / 短码 / 小程序码 fileID
 */
export function createRoom(): Promise<I_CreateRoomResult> {
	return callCloud<I_CreateRoomResult>('createRoom')
}

/** @description joinRoom 返回的房间信息 */
export interface I_JoinRoomResult {
	roomId: string
	roomCode: string
}

/**
 * @description 扫码/转发进房
 * @param roomCode 房间短码
 * @return 房间 id / 短码
 */
export function joinRoom(roomCode: string): Promise<I_JoinRoomResult> {
	return callCloud<I_JoinRoomResult>('joinRoom', { roomCode })
}

/**
 * @description 转账（唯一入口，服务端校验在场/满员/状态）
 * @param params 房间 id / 收款人 openid / 正整数积分
 * @return 转账记录 id
 */
export function transfer(params: { roomId: string; toOpenid: string; amount: number }): Promise<{ recordId: string }> {
	return callCloud<{ recordId: string }>('transfer', params)
}

/** @description 结算方案中的单笔转账 */
export interface I_TransferItem {
	fromOpenid: string
	toOpenid: string
	amount: number
}

/** @description 结算快照中的单人净额 */
export interface I_NetScore {
	openid: string
	nickname: string
	avatarUrl: string
	delta: number
}

/** @description settle 返回的结算结果 */
export interface I_SettleResult {
	transfers: I_TransferItem[]
	netScores: I_NetScore[]
	/** 房间是否已结算落库（preview 返回 false，确认/已结算快照返回 true） */
	settled: boolean
	/** 转账流水笔数（game_records 条数） */
	recordCount?: number
	/** 结算时间（serverDate 序列化的 ISO 串，未结算为 null/缺省） */
	settledAt?: string | null
	/** 首页小程序码 fileID（战绩图底部用，生成失败为空串） */
	homeQrFileID?: string
}

/**
 * @description 结算：preview=true 只算方案不落库；否则确认落库（仅房主，已结算幂等返回快照）
 * @param roomId 房间 id
 * @param preview 是否仅预览
 */
export function settle(roomId: string, preview: boolean): Promise<I_SettleResult> {
	return callCloud<I_SettleResult>('settle', { roomId, preview })
}

/**
 * @description 退出房间（成员软删 / 房主解散全员清出）
 * @param roomId 房间 id
 */
export function leaveRoom(roomId: string): Promise<{ left: boolean; dissolved: boolean }> {
	return callCloud<{ left: boolean; dissolved: boolean }>('leaveRoom', { roomId })
}

/** @description getOngoingRoom 返回的进行中牌局（首页卡片数据源） */
export interface I_OngoingRoom {
	roomId: string
	roomCode: string
	/** 活跃成员列表（按加入顺序） */
	members: { openid: string; nickname: string; avatarUrl: string }[]
}

/**
 * @description 查询我的进行中牌局（与 createRoom 单房间拦截逻辑同源，云函数端不受集合权限过滤）
 * @return 无进行中房间时 room 为 null
 */
export function getOngoingRoom(): Promise<{ room: I_OngoingRoom | null }> {
	return callCloud<{ room: I_OngoingRoom | null }>('getOngoingRoom')
}
