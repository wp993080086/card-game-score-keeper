<template>
	<view class="flow-page">
		<!-- 房间信息缺失空状态（进入来源未携带 roomId） -->
		<view v-if="missingRoom" class="page-empty">
			<view class="ico">🃏</view>
			<view class="txt">房间信息缺失</view>
			<view class="sub">请从结算页或对局详情进入查看流水</view>
			<button class="ghost-btn" @click="_goBack">返回</button>
		</view>

		<template v-else>
			<!-- 顶部汇总条 -->
			<view class="head-bar">
				<view class="code">{{ roomCode || '本局' }}</view>
				<view class="total">共 {{ flowList.length }} 笔转账</view>
			</view>

			<!-- 按日分组流水（新的在前） -->
			<view v-for="group in groups" :key="group.title">
				<view class="group-title">{{ group.title }}</view>
				<view class="flow-card">
					<view v-for="item in group.list" :key="item.id" class="flow-item">
						<view class="time">{{ item.timeLabel }}</view>
						<view class="who">{{ item.from }} → {{ item.to }}</view>
						<view class="amount">{{ item.amount }} 分</view>
					</view>
				</view>
			</view>

			<!-- 无流水空状态 -->
			<view v-if="!loading && !flowList.length" class="card-empty">
				<view class="ico">🃏</view>
				<view class="txt">本局没有转账记录</view>
				<view class="sub">大家打了平局，无需互相转账</view>
			</view>
		</template>
	</view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getRoomFlow } from '@/apis/game'
import type { I_FlowItem } from '@/apis/game'

defineOptions({
	name: 'Flow'
})

/** @description 单条流水渲染模型（ts 供分组/排序，timeLabel 供展示）*/
interface I_FlowRow {
	id: string
	from: string
	to: string
	amount: number
	/** 时间戳（毫秒） */
	ts: number
	timeLabel: string
}

/** @description 按日期归档的分组*/
interface I_FlowGroup {
	title: string
	list: I_FlowRow[]
}

/** @description 一天的毫秒数（归档计算用）*/
const DAY_MS = 86400000

/** @description 房间 id 缺失（进入来源未携带参数）*/
const missingRoom = ref(false)

/** @description 拉取进行中（防空状态闪烁）*/
const loading = ref(true)

/** @description 房号（顶部汇总条展示）*/
const roomCode = ref('')

/** @description 本房间全部流水（时间倒序）*/
const flowList = ref<I_FlowRow[]>([])

/** @description 按日归档分组（今天/昨天/M月D日，云函数已按时间倒序返回，分组内保持原序）*/
const groups = computed<I_FlowGroup[]>(() => {
	const now = new Date()
	const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
	const map: TDict<I_FlowRow[]> = {}
	for (const item of flowList.value) {
		let title = `${new Date(item.ts).getMonth() + 1}月${new Date(item.ts).getDate()}日`
		if (item.ts >= startOfToday) title = '今天'
		else if (item.ts >= startOfToday - DAY_MS) title = '昨天'
		if (!map[title]) map[title] = []
		map[title].push(item)
	}
	return Object.keys(map).map((t) => ({ title: t, list: map[t] }))
})

/** @description 接收页面参数并拉取流水（缺 roomId 时不请求，直接展示空状态）*/
onLoad((options: TAny) => {
	roomCode.value = options?.roomCode || ''
	const roomId = options?.roomId || ''
	if (!roomId) {
		missingRoom.value = true
		loading.value = false
		return
	}
	_fetchFlow(roomId)
})

/** @description 拉取本房间全部流水*/
const _fetchFlow = (roomId: string) => {
	uni.showLoading({ title: '加载中…', mask: true })
	getRoomFlow(roomId)
		.then((res) => {
			roomCode.value = res.roomCode || roomCode.value
			const pad = (n: number) => String(n).padStart(2, '0')
			flowList.value = (res.flow || []).map((f: I_FlowItem) => {
				const d = f.createdAt ? new Date(f.createdAt) : null
				const ts = d && !Number.isNaN(d.getTime()) ? d.getTime() : 0
				return {
					id: f.id,
					from: f.from,
					to: f.to,
					amount: f.amount,
					ts,
					timeLabel: ts ? `${pad(d!.getHours())}:${pad(d!.getMinutes())}` : '--:--'
				}
			})
		})
		.catch((err) => {
			console.error('[flow] 流水加载失败:', err)
			uni.showToast({ title: `流水加载失败：${err?.errMsg || err?.errMessage || err?.message || '未知错误'}`, icon: 'none' })
		})
		.finally(() => {
			loading.value = false
			uni.hideLoading()
		})
}

/** @description 返回上一页（无页面栈时兜底回首页）*/
const _goBack = () => {
	uni.navigateBack({
		fail: () => uni.reLaunch({ url: '/pages/home/index' })
	})
}
</script>

<style lang="scss" scoped src="./style.scss"></style>
