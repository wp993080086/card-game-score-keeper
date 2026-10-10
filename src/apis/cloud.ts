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

/**
 * @description 提取云开发错误的业务文案用于 toast 提示
 * 云函数 throw 的错误会被包装成超长 errMsg（errCode -504002 + 业务文案 + 函数堆栈），
 * 业务文案位于「errMsg: Error: <文案>」段（堆栈从下一行开始），正则提取；取不到再整串兜底
 * @param err 调用失败 reject 的错误对象
 * @return 可直接展示的短文案
 */
export function cloudErrMsg(err: TAny): string {
	const raw = String(err?.errMsg || err?.errMessage || err?.message || '')
	const m = /errMsg:\s*Error:\s*([^\n]+)/.exec(raw)
	return ((m ? m[1] : raw) || '').trim() || '未知错误'
}
