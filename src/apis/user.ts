/**
 * 用户资料读写（users 集合，小程序端直连）
 * 集合权限「仅创建者可读写」：_openid 由数据库自动写入，get 查询只会返回自己的记录
 */

/** @description 用户资料（users 集合记录）*/
export interface I_UserProfile {
	/** 数据库记录 id */
	_id: string
	/** 用户 openid（「仅创建者可读写」权限下 get 返回的必是自己记录，_openid 即自身身份）*/
	_openid?: string
	/** 昵称 */
	nickname: string
	/** 云存储头像 fileID（cloud:// 开头，可直接作为 image 的 src；空串表示未设置）*/
	avatarUrl: string
}

/**
 * @description 读取当前用户资料
 * @return 有记录返回资料，无记录（首次使用）返回 null
 */
export function fetchUserProfile(): Promise<I_UserProfile | null> {
	return wx.cloud
		.database()
		.collection('users')
		.get()
		.then((res) => (res.data.length ? (res.data[0] as I_UserProfile) : null))
}

/**
 * @description 内容安全检测（云函数 checkContent，提审声明的平台内容安全 API）
 *  - 违规时云函数抛错（errcode 87014 内容违规），直接把错误透传给调用方
 * @param action 'text' 检测文本（昵称）| 'image' 检测图片（头像）
 * @param payload text 传 content，image 传 fileID（云存储 fileID）
 */
export function checkContent(action: 'text' | 'image', payload: { content?: string; fileID?: string }): Promise<{ ok: boolean }> {
	return wx.cloud
		.callFunction({
			name: 'checkContent',
			data: { action, ...payload }
		})
		.then((res) => res.result as { ok: boolean })
}

/**
 * @description 上传头像图片到云存储
 * @param filePath 本地临时文件路径（chooseAvatar 返回）
 * @return 云存储 fileID
 */
export function uploadAvatar(filePath: string): Promise<string> {
	const ext = filePath.split('.').pop() || 'png'
	return wx.cloud
		.uploadFile({
			cloudPath: `avatars/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`,
			filePath
		})
		.then((res) => res.fileID)
		.then(async (fileID) => {
			try {
				// 上传后立刻过图片安全检测（imgSecCheck），不让违规图入库
				await checkContent('image', { fileID })
				return fileID
			} catch (err) {
				// 检测违规/报错时清掉刚传的文件再抛错
				await wx.cloud.deleteFile({ fileList: [fileID] }).catch(() => {})
				throw err
			}
		})
}

/**
 * @description 保存用户资料（无记录新增、有记录按 id 更新）
 * @param profile 要保存的资料
 * @param docId 已有记录的 id（更新用，不传则新增）
 * @return 记录 id（更新时即传入的 docId，新增时为数据库生成的 _id）
 */
export function saveUserProfile(profile: { nickname: string; avatarUrl: string }, docId?: string): Promise<string> {
	const collection = wx.cloud.database().collection('users')
	if (docId) {
		return collection
			.doc(docId)
			.update({ data: profile })
			.then(() => docId)
	}
	return collection.add({ data: profile }).then((res) => res._id)
}
