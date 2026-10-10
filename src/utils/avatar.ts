import { ref } from 'vue'

/** @description 默认头像占位图（云存储读取失败/权限不足时的保底展示）*/
export const DEFAULT_AVATAR = '/static/images/avatar.png'

/**
 * @description 头像加载失败兜底：image @error 时记下失败地址，src 解析时替换为本地占位图。
 *   云存储头像（cloud:// fileID）在读取权限不足/文件缺失时 <image> 只会渲染一片空白，
 *   用 @error 换默认占位图保证永远有头像可见；同一地址失败一次即本页内全程替换
 */
export function useAvatarFallback() {
	/** 加载失败的头像地址表（本页生命周期内记忆） */
	const failed = ref<TDict<boolean>>({})

	/** @description image @error 回调：标记该地址加载失败*/
	const onAvatarError = (url: string) => {
		if (url && !failed.value[url]) {
			failed.value = { ...failed.value, [url]: true }
		}
	}

	/** @description 解析实际渲染地址：失败过的地址换默认占位图*/
	const avatarSrc = (url: string) => {
		return url && failed.value[url] ? DEFAULT_AVATAR : url
	}

	return { failed, onAvatarError, avatarSrc }
}
