<template>
	<view class="detail-page">
		<!-- 头部信息卡 -->
		<view class="head-info">
			<view class="top">
				<view>
					<view class="code">{{ roomCode }}</view>
					<view class="date">{{ dateLabel }}</view>
				</view>
				<view class="my-net">
					<view class="lbl">你的净输赢</view>
					<view class="val" :class="myNet >= 0 ? 'win' : 'lose'">{{ formatNet(myNet) }} 分</view>
				</view>
			</view>
			<view class="summary-row">
				<text>{{ memberCount }} 人参与</text>
				<text class="dot">·</text>
				<text>共 {{ transferCount }} 笔转账</text>
				<text class="badge">已结算</text>
			</view>
		</view>

		<!-- 结算方案 -->
		<view class="section-title">结算方案</view>
		<view class="plans-card">
			<view v-for="plan in planList" :key="`${plan.from}-${plan.to}`" class="plan-item">
				<view class="g-avatar xs" :style="avatarStyle(plan.fromAvatar)">{{ plan.from.charAt(0) }}</view>
				<view class="from">{{ plan.from }}</view>
				<view class="arrow">→</view>
				<view class="to">{{ plan.to }}</view>
				<view class="amount">{{ plan.amount }} 分</view>
			</view>
		</view>

		<!-- 每人累计输赢 -->
		<view class="section-title">每人累计输赢</view>
		<view class="stats-card">
			<view v-for="stat in statList" :key="stat.name" class="stat-row">
				<view class="g-avatar sm" :style="avatarStyle(stat.avatar)">{{ stat.name.charAt(0) }}</view>
				<view class="name">{{ stat.name }}</view>
				<view class="val" :class="stat.net >= 0 ? 'win' : 'lose'">{{ formatNet(stat.net) }}</view>
			</view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'

defineOptions({
	name: 'RoomDetail'
})

/** @description 头像配色（背景 + 文字色）*/
interface I_Avatar {
	bg: string
	color: string
}

/** @description 最少转账方案条目*/
interface I_PlanItem {
	from: string
	to: string
	amount: number
	fromAvatar: I_Avatar
}

/** @description 每人累计输赢条目*/
interface I_StatItem {
	name: string
	net: number
	avatar: I_Avatar
}

/** @description 头像配色方案（对齐设计稿 mock）*/
const AVATAR_PRESET: TDict<I_Avatar> = {
	default: { bg: 'var(--primary-soft)', color: 'var(--primary-text)' },
	win: { bg: 'var(--win-soft)', color: 'var(--win-text)' },
	lose: { bg: 'var(--lose-soft)', color: 'var(--lose-text)' },
	green: { bg: '#e8f7ee', color: '#34a35b' }
}

/** @description 拼接头像内联样式*/
const avatarStyle = (avatar: I_Avatar): string => {
	return `background:${avatar.bg};color:${avatar.color}`
}

/** @description 格式化净输赢展示（正数带 + 号）*/
const formatNet = (net: number): string => {
	return net >= 0 ? `+${net}` : `${net}`
}

/** @description 房号（从战绩列表/结算页跳转携带）*/
const roomCode = ref('mucj')

/** @description 牌局时间文案（mock）*/
const dateLabel = ref('2026-09-28 · 14:20')

/** @description 参与人数（mock）*/
const memberCount = ref(4)

/** @description 转账笔数（mock）*/
const transferCount = ref(5)

/** @description 你的净输赢（mock）*/
const myNet = ref(-60)

/** @description 结算方案（mock，只读回看 settlements 快照）*/
const planList = ref<I_PlanItem[]>([
	{ from: '王五', to: '张三', amount: 90, fromAvatar: AVATAR_PRESET.green },
	{ from: '法外狂徒', to: '张三', amount: 60, fromAvatar: AVATAR_PRESET.default },
	{ from: '李四', to: '张三', amount: 50, fromAvatar: AVATAR_PRESET.lose }
])

/** @description 每人累计输赢（mock，按 game_records 汇总）*/
const statList = ref<I_StatItem[]>([
	{ name: '法外狂徒', net: -60, avatar: AVATAR_PRESET.default },
	{ name: '张三', net: 200, avatar: AVATAR_PRESET.win },
	{ name: '李四', net: -50, avatar: AVATAR_PRESET.lose },
	{ name: '王五', net: -90, avatar: AVATAR_PRESET.green }
])

/** @description 接收页面参数中的房号*/
onLoad((options) => {
	if (options && options.roomCode) {
		roomCode.value = options.roomCode
	}
})
</script>

<style lang="scss" scoped src="./style.scss"></style>
