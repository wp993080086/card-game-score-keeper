/** @description 任意类型*/
declare type TAny = any

/** @description 对象字典*/
declare type TDict<T = TAny> = { [key: string]: T }

/** @description 任意函数*/
declare type TFunc<T = TAny> = (...args: T[]) => T

/** @description 云数据库链式查询（where/orderBy/limit/skip 可任意组合）*/
interface I_DbQuery {
	where(condition: TDict): I_DbQuery
	orderBy(field: string, order: 'asc' | 'desc'): I_DbQuery
	limit(count: number): I_DbQuery
	skip(count: number): I_DbQuery
	/** 权限过滤后查询（集合为「仅创建者可读写」时即自己的记录）*/
	get(): Promise<{ data: TAny[] }>
	count(): Promise<{ total: number }>
	/** 实时监听：init 快照 + 增量推送，返回可关闭的 watcher */
	watch(handlers: {
		onChange(snapshot: { type: string; docs: TAny[]; docChanges: { dataType: string; doc: TAny }[] }): void
		onError(err: TAny): void
	}): { close(): void }
}

/** @description 微信小程序原生 wx 能力（@dcloudio/types 未覆盖，仅声明本项目用到的部分）*/
declare const wx: {
	cloud: {
		/** 初始化云开发环境（App.vue onLaunch 调用一次）*/
		init(config: { env: string; traceUser?: boolean }): void
		/** 调用云函数 */
		callFunction(params: { name: string; data?: TDict }): Promise<{ result: TAny }>
		/** 上传本地文件到云存储 */
		uploadFile(params: { cloudPath: string; filePath: string }): Promise<{ fileID: string }>
		/** 换取云存储文件的临时访问链接（canvas 画图等需要真实 URL 的场景）*/
		getTempFileURL(params: { fileList: string[] }): Promise<{ fileList: { fileID: string; tempFileURL: string; status: number }[] }>
		/** 导出 canvas 2d 画布为临时图片 */
		canvasToTempFilePath(params: { canvas: TAny; success?: (res: { tempFilePath: string }) => void; fail?: (err: TAny) => void }): void
		/** 调起图片转发/保存面板（发送给朋友、保存图片）*/
		showShareImageMenu(params: { path: string; success?: TFunc; fail?: (err: TAny) => void }): void
		/** 获取云数据库实例 */
		database(): {
			/** 查询指令（db.command.exists 等）*/
			command: {
				exists(value: boolean): TAny
			}
			/** 服务端时间占位（写入时由数据库展开）*/
			serverDate(): TAny
			collection(name: string): I_DbQuery & {
				/** 按记录 id 取文档引用 */
				doc(id: string): {
					get(): Promise<{ data: TAny }>
					update(data: { data: TDict }): Promise<TAny>
				}
			}
		}
	}
}
