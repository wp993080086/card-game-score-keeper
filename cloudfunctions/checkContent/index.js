'use strict'

const cloud = require('wx-server-sdk')

// 按部署环境动态初始化，避免环境 ID 硬编码在云函数侧
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

/**
 * @description 内容安全检测（提审声明：使用平台建议的内容安全 API）
 *  - action=text  → security.msgSecCheck（昵称等文本，走 v2 接口带 openid/scene）
 *  - action=image → security.imgSecCheck（头像等图片，需先 downloadFile，限 1MB 内）
 * 违规时抛错（errcode 87014 为内容违规，其余为接口异常），前端据此拦截保存
 * @param {object} event { action: 'text'|'image', content?: string, fileID?: string }
 * @return {Promise<object>} { ok: true }
 */
exports.main = async (event) => {
	const { OPENID } = cloud.getWXContext()

	if (event.action === 'text') {
		const content = String(event.content || '').trim()
		if (!content) {
			return { ok: true }
		}
		const res = await cloud.openapi.security.msgSecCheck({
			version: 2,
			scene: 2, // 2=用户资料编辑
			openid: OPENID,
			content
		})
		// v2 通过时 result.suggest 为 pass / risky / review，非 pass 一律拦截
		if (res.result && res.result.suggest && res.result.suggest !== 'pass') {
			const err = new Error('内容包含违规信息，请修改后重试')
			err.errcode = 87014
			throw err
		}
		return { ok: true }
	}

	if (event.action === 'image') {
		const fileID = String(event.fileID || '')
		if (!fileID) {
			return { ok: true }
		}
		const dlRes = await cloud.downloadFile({ fileID })
		await cloud.openapi.security.imgSecCheck({
			media: {
				contentType: 'image/png',
				value: dlRes.fileContent
			}
		})
		return { ok: true }
	}

	throw new Error('未知检测类型')
}
