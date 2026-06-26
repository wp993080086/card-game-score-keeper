/** @description App名*/
export const APP_NAME = 'Card Game Score Keeper'

/** @description 当前构建环境*/
const APP_ENV = import.meta.env.VITE_MODE as string

/** @description 是否为开发环境*/
export const IS_DEVELOPMENT = APP_ENV === 'development'

/** @description 是否为生产环境*/
export const IS_PRODUCTION = APP_ENV === 'production'

/** @description 是否为测试环境*/
export const IS_TEST = APP_ENV === 'test'

/** @description Http响应码 */
export const HTTP_CODE = [
	{ code: 200, message: '请求成功' },
	{ code: 304, message: '资源未修改' },
	{ code: 400, message: '请求参数错误' },
	{ code: 401, message: '数据库未授权' },
	{ code: 403, message: '拒绝访问' },
	{ code: 404, message: '请求资源不存在' },
	{ code: 500, message: '服务器内部错误' },
	{ code: 502, message: '网关错误' },
	{ code: 503, message: '服务不可用' },
	{ code: 504, message: '网关超时' }
]
