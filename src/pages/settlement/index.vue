<template>
	<view class="settlement-page">
		<view class="screen-pad">
			<!-- MVP 区：头像 + 右上角皇冠角标 + 收益 -->
			<view class="mvp">
				<view class="avatar-wrap">
					<view class="g-avatar lg win-avatar">张</view>
				</view>
				<view class="earnings">
					<text class="label">MVP 收益</text>
					<text class="amount">+200 分</text>
				</view>
			</view>

			<!-- 结算方案 -->
			<view class="section-title">结算方案</view>
			<view class="plans">
				<view v-for="plan in planList" :key="`${plan.from}-${plan.to}`" class="plan-item">
					<view class="g-avatar xs" :style="avatarStyle(plan.fromAvatar)">{{ plan.from.charAt(0) }}</view>
					<view class="from">{{ plan.from }}</view>
					<view class="arrow">→</view>
					<view class="to">{{ plan.to }}</view>
					<view class="amount">{{ plan.amount }} 分</view>
				</view>
			</view>

			<!-- 功能区 -->
			<view class="section-title">更多</view>
			<view class="grid-2">
				<view class="action-card" @click="_openRanking">
					<view class="ico-wrap" style="background: #fff3e8">🏆</view>
					<view class="label">排行榜</view>
				</view>
				<view class="action-card" @click="_openRecords">
					<view class="ico-wrap" style="background: #e8f5e9">📋</view>
					<view class="label">流水明细</view>
				</view>
				<view class="action-card" @click="_openManual">
					<view class="ico-wrap" style="background: #e3f2fd">📖</view>
					<view class="label">使用手册</view>
				</view>
				<view class="action-card danger" @click="_openDissolve">
					<view class="ico-wrap" style="background: #fff1ed; color: #f76565">✕</view>
					<view class="label">退出房间</view>
				</view>
			</view>
		</view>

		<!-- 底部操作栏 -->
		<view class="share-bar">
			<button class="btn outline" @click="_shareResult">📤 分享战绩图</button>
			<button class="btn primary" @click="_confirmSettle">确认结算</button>
		</view>

		<!-- 解散房间确认弹窗：对齐 design/confirm-dialog.html（房主点退出） -->
		<view v-if="showDissolve" class="mask" @click="_closeDissolve">
			<view class="confirm-dialog" @click.stop>
				<view class="ico">⚠</view>
				<view class="title">解散房间</view>
				<view class="desc">
					<text>你是房主，退出将解散房间，</text>
					<text>所有成员将被清出。</text>
				</view>
				<view class="dialog-btns">
					<button class="btn outline" @click="_closeDissolve">取消</button>
					<button class="btn danger-solid" @click="_confirmDissolve">解散房间</button>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineOptions({
	name: 'Settlement'
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

/** @description 最少转账方案（mock，云开发接入后由 settle 云函数贪心计算）*/
const planList = ref<I_PlanItem[]>([
	{ from: '王五', to: '张三', amount: 90, fromAvatar: AVATAR_PRESET.green },
	{ from: '法外狂徒', to: '张三', amount: 60, fromAvatar: AVATAR_PRESET.default },
	{ from: '李四', to: '张三', amount: 50, fromAvatar: AVATAR_PRESET.lose }
])

/** @description 解散确认弹窗显隐*/
const showDissolve = ref(false)

/** @description 打开排行榜*/
const _openRanking = () => {
	uni.showToast({ title: '即将上线', icon: 'none' })
}

/** @description 打开流水明细*/
const _openRecords = () => {
	uni.showToast({ title: '即将上线', icon: 'none' })
}

/** @description 打开使用手册*/
const _openManual = () => {
	uni.navigateTo({ url: '/pages/manual/index' })
}

/** @description 分享战绩图（canvas 绘制待云开发接入后实现）*/
const _shareResult = () => {
	uni.showToast({ title: '即将上线', icon: 'none' })
}

/** @description 确认结算：写入结算快照后跳转对局详情（云开发接入后调 settle 云函数）*/
const _confirmSettle = () => {
	uni.navigateTo({ url: '/pages/room-detail/index?roomCode=mucj' })
}

/** @description 打开解散确认弹窗（房主点退出）*/
const _openDissolve = () => {
	showDissolve.value = true
}

/** @description 关闭解散确认弹窗*/
const _closeDissolve = () => {
	showDissolve.value = false
}

/** @description 确认解散：全员清出并回首页（云开发接入后置 status=dissolved）*/
const _confirmDissolve = () => {
	showDissolve.value = false
	uni.showToast({ title: '房间已解散', icon: 'none' })
	setTimeout(() => {
		uni.switchTab({ url: '/pages/home/index' })
	}, 600)
}
</script>

<style lang="scss" scoped src="./style.scss"></style>
