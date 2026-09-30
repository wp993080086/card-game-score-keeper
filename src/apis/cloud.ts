/**
 * 微信云开发调用封装（仅小程序端）
 */

/**
 * @description 调用微信云函数
 * @param name 云函数名（cloudfunctions/ 下的目录名）
 * @param data 传给云函数的入参
 * @return 云函数 exports.main 的返回值
 */
export function callCloud<T = unknown>(name: string, data?: TDict): Promise<T> {
	return wx.cloud.callFunction({ name, data }).then((res) => res.result as T)
}
