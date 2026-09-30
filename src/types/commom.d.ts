/** @description 任意类型*/
declare type TAny = any

/** @description 对象字典*/
declare type TDict<T = TAny> = { [key: string]: T }

/** @description 任意函数*/
declare type TFunc<T = TAny> = (...args: T[]) => T

/** @description 微信小程序原生 wx 能力（@dcloudio/types 未覆盖，仅声明本项目用到的部分）*/
declare const wx: {
	cloud: {
		/** 初始化云开发环境（App.vue onLaunch 调用一次）*/
		init(config: { env: string; traceUser?: boolean }): void
		/** 调用云函数 */
		callFunction(params: { name: string; data?: TDict }): Promise<{ result: TAny }>
		/** 上传本地文件到云存储 */
		uploadFile(params: { cloudPath: string; filePath: string }): Promise<{ fileID: string }>
		/** 获取云数据库实例 */
		database(): {
			collection(name: string): {
				/** 权限过滤后查询（集合为「仅创建者可读写」时即自己的记录）*/
				get(): Promise<{ data: TAny[] }>
				/** 新增记录（_openid 由数据库自动写入）*/
				add(data: { data: TDict }): Promise<{ _id: string }>
				/** 按记录 id 取文档引用 */
				doc(id: string): {
					update(data: { data: TDict }): Promise<TAny>
				}
			}
		}
	}
}
