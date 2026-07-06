export interface I_MessageItem {
	type: 'system' | 'payment' | 'warning' | 'self' | 'other'
	content: string
	sender: string
	avatar: string
	timestamp: number
}
