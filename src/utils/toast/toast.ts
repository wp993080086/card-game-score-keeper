import type { I_LoadingOptions, I_ShowModalOptions, I_ShowToastOptions } from './type'

/**
 * @description 轻提示
 * @param {String} content 提示内容
 * @param {Object} option 配置
 */
export const Toast = (content: string, option: I_ShowToastOptions = {}) => {
	uni.showToast({
		title: content,
		icon: 'none',
		mask: true,
		duration: 1500,
		...option
	})
}

/**
 * @description Loading 提示框
 * @param {String} content 提示内容
 */
export const Loading: I_LoadingOptions = {
	show: (content = '加载中') => {
		uni.showLoading({
			title: content,
			mask: true
		})
	},
	hide: () => {
		uni.hideLoading()
	}
}

/**
 * @description Alert 提示框
 * @param {String} content 提示内容
 * @param {Object} option 配置
 */
export const Alert = (content: string, option: I_ShowModalOptions = {}) => {
	option.showCancel = false
	return new Promise((resolve, reject) => {
		uni.showModal({
			title: '温馨提示',
			content,
			showCancel: false,
			confirmColor: '#1677FF',
			success(res) {
				if (res.confirm) resolve(res)
			},
			fail() {
				reject(new Error('Alert 调用失败 !'))
			},
			...option
		})
	})
}

/**
 * @description Confirm 确认框
 * @param {String} content 提示内容
 * @param {Object} option 配置
 */
export const Confirm = (content: string, option: I_ShowModalOptions = {}) => {
	return new Promise((resolve, reject) => {
		uni.showModal({
			title: '温馨提示',
			content,
			cancelColor: '#1D2129',
			confirmColor: '#1677FF',
			success(res) {
				if (res.confirm) {
					resolve(res)
				} else if (res.cancel) {
					reject(res)
				}
			},
			fail() {
				reject(new Error('Alert 调用失败 !'))
			},
			...option
		})
	})
}
