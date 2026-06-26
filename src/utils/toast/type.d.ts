/** @description 显示Toast选项*/
export interface I_ShowToastOptions {
	title?: string
	icon?: 'success' | 'loading' | 'error' | 'none'
	image?: string
	duration?: number
	position?: 'top' | 'center' | 'bottom'
	mask?: boolean
}

/** @description 加载中选项*/
export interface I_LoadingOptions {
	show?: (content?: string) => void
	hide?: () => void
}

/** @description 显示弹窗选项*/
export interface I_ShowModalOptions {
	title?: string
	content?: string
	showCancel?: boolean
	cancelText?: string
	cancelColor?: string
	confirmText?: string
	confirmColor?: string
	editable?: boolean
	placeholderText?: string
}
