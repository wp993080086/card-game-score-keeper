'use strict'

const cloud = require('wx-server-sdk')

// 按部署环境动态初始化，避免环境 ID 硬编码在云函数侧
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

/**
 * @description 创建房间（骨架：验证链路用，返回调用者 openid 与入参；正式逻辑在接入 createRoom 步骤实现）
 * @param {object} event 调用方传入的数据
 * @return {Promise<object>} openid 与入参回显
 */
exports.main = async (event) => {
	const { OPENID } = cloud.getWXContext()
	return { openid: OPENID, event }
}
