<template>
	<view class="detail-page">
		<!-- 房间信息缺失空状态（进入来源未携带 roomId，如战绩列表占位数据） -->
		<view v-if="missingRoom" class="page-empty">
			<view class="ico">🃏</view>
			<view class="txt">房间信息缺失</view>
			<view class="sub">历史战绩接入后可正常查看详情</view>
			<button class="ghost-btn" @click="_goBack">返回</button>
		</view>

		<template v-else>
			<!-- 头部信息卡 -->
			<view class="head-info">
				<view class="top">
					<view>
						<view class="code">{{ roomCode }}</view>
						<view class="date">{{ dateLabel || '结算时间待补' }}</view>
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
					<text class="badge">{{ settled ? '已结算' : '未结算' }}</text>
				</view>
			</view>

			<!-- 结算方案 -->
			<view class="section-title">结算方案</view>
			<view class="plans-card">
				<view v-for="plan in planList" :key="`${plan.fromOpenid}-${plan.toOpenid}`" class="plan-item">
					<image v-if="plan.fromAvatarUrl" class="g-avatar xs avatar-img" :src="plan.fromAvatarUrl" mode="aspectFill" />
					<view v-else class="g-avatar xs" :style="avatarStyle(hashColor(plan.from))">{{ plan.from.charAt(0) }}</view>
					<view class="from">{{ plan.from }}</view>
					<view class="arrow">→</view>
					<view class="to">{{ plan.to }}</view>
					<view class="amount">{{ plan.amount }} 分</view>
				</view>
				<view v-if="!planList.length" class="card-empty">
					<view class="ico">🃏</view>
					<view class="txt">本局没有转账记录</view>
				</view>
			</view>

			<!-- 每人累计输赢 -->
			<view class="section-title">每人累计输赢</view>
			<view class="stats-card">
				<view v-for="stat in netScores" :key="stat.openid" class="stat-row">
					<image v-if="stat.avatarUrl" class="g-avatar sm avatar-img" :src="stat.avatarUrl" mode="aspectFill" />
					<view v-else class="g-avatar sm" :style="avatarStyle(hashColor(stat.name))">{{ stat.name.charAt(0) }}</view>
					<view class="name">{{ stat.name }}</view>
					<view class="val" :class="stat.net >= 0 ? 'win' : 'lose'">{{ formatNet(stat.net) }}</view>
				</view>
				<view v-if="!netScores.length" class="card-empty">
					<view class="ico">📊</view>
					<view class="txt">暂无输赢数据</view>
					<view class="sub">若长时间未显示，请返回重试</view>
				</view>
			</view>

			<!-- 流水明细入口 -->
			<view class="flow-entry" @click="_goFlow">
				<text>📋 查看流水明细</text>
				<text class="arrow">›</text>
			</view>
		</template>
	</view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { settle } from '@/apis/room'

defineOptions({
	name: 'RoomDetail'
})

/** @description 头像配色（背景 + 文字色）*/
interface I_Avatar {
	bg: string
	color: string
}

/** @description 最少转账方案条目（渲染模型：昵称 + 支出方头像）*/
interface I_PlanItem {
	fromOpenid: string
	toOpenid: string
	from: string
	to: string
	amount: number
	fromAvatarUrl: string
}

/** @description 每人累计输赢条目*/
interface I_StatItem {
	openid: string
	name: string
	net: number
	avatarUrl: string
}

/** @description 头像配色方案（对齐设计稿 mock）*/
const AVATAR_PRESET: TDict<I_Avatar> = {
	default: { bg: 'var(--primary-soft)', color: 'var(--primary-text)' },
	win: { bg: 'var(--win-soft)', color: 'var(--win-text)' },
	lose: { bg: 'var(--lose-soft)', color: 'var(--lose-text)' },
	green: { bg: '#e8f7ee', color: '#34a35b' }
}

/** @description 配色轮转顺序*/
const AVATAR_KEYS = ['default', 'win', 'lose', 'green']

/** @description 拼接头像内联样式*/
const avatarStyle = (avatar: I_Avatar): string => {
	return `background:${avatar.bg};color:${avatar.color}`
}

/** @description 无头像成员按昵称哈希取固定配色（同一人颜色稳定）*/
const hashColor = (name: string): I_Avatar => {
	const sum = [...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
	return AVATAR_PRESET[AVATAR_KEYS[sum % AVATAR_KEYS.length]]
}

/** @description 格式化净输赢展示（正数带 + 号）*/
const formatNet = (net: number): string => {
	return net >= 0 ? `+${net}` : `${net}`
}

/** @description 格式化结算时间（ISO → 本地时区 YYYY-MM-DD · HH:mm）*/
const formatTime = (iso?: string | null): string => {
	if (!iso) return ''
	const d = new Date(iso)
	const pad = (n: number) => String(n).padStart(2, '0')
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} · ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** @description 房间 id 与房号（结算页跳转携带）*/
const roomId = ref('')
const roomCode = ref('')

/** @description 当前用户 openid（users「仅创建者可读写」权限下 get 即自己的记录）*/
const myOpenid = ref('')

/** @description 房间是否已结算*/
const settled = ref(false)

/** @description 结算时间文案（settlements 快照 confirmedAt）*/
const settledAt = ref<string | null>(null)

/** @description 转账流水笔数（game_records 条数）*/
const transferCount = ref(0)

/** @description 每人净额快照（降序）*/
const netScores = ref<I_StatItem[]>([])

/** @description 最少转账方案（昵称渲染模型）*/
const planList = ref<I_PlanItem[]>([])

/** @description 牌局时间文案*/
const dateLabel = computed(() => formatTime(settledAt.value))

/** @description 参与人数*/
const memberCount = computed(() => netScores.value.length)

/** @description 你的净输赢（快照里按 openid 匹配，无记录视为 0）*/
const myNet = computed(() => netScores.value.find((s) => s.openid === myOpenid.value)?.delta ?? 0)

/** @description 房间 id 缺失（进入来源未携带参数，如战绩列表占位数据）*/
const missingRoom = ref(false)

/** @description 接收页面参数并拉取结算快照（缺 roomId 时不请求，直接展示空状态）*/
onLoad((options: TAny) => {
	roomId.value = options?.roomId || ''
	roomCode.value = options?.roomCode || ''
	if (!roomId.value) {
		missingRoom.value = true
		return
	}
	_fetchSelf()
	_fetchSettlement()
})

/** @description 返回上一页（无页面栈时兜底回首页）*/
const _goBack = () => {
	uni.navigateBack({
		fail: () => uni.reLaunch({ url: '/pages/home/index' })
	})
}

/** @description 查看本房间流水明细*/
const _goFlow = () => {
	uni.navigateTo({ url: `/pages/flow/index?roomId=${roomId.value}&roomCode=${roomCode.value}` })
}

/** @description 拉取自己资料（依赖 users「仅创建者可读写」权限：get 过滤后只返回自己的记录）*/
const _fetchSelf = () => {
	wx.cloud
		.database()
		.collection('users')
		.limit(1)
		.get()
		.then((res) => {
			const doc = res.data[0]
			if (doc) {
				myOpenid.value = doc._openid || ''
			}
		})
		.catch((err) => {
			console.error('[room-detail] 拉取个人资料失败:', err)
		})
}

/** @description 拉取结算快照（settle preview 模式：已结算返回落库快照，未结算返回实时试算）*/
const _fetchSettlement = () => {
	settle(roomId.value, true)
		.then((res) => {
			settled.value = res.settled
			settledAt.value = res.settledAt || null
			transferCount.value = res.recordCount || 0
			netScores.value = (res.netScores || []).map((s) => ({
				openid: s.openid,
				name: s.nickname,
				net: s.delta,
				avatarUrl: s.avatarUrl || ''
			}))
			planList.value = (res.transfers || []).map((t) => {
				const from = res.netScores.find((s) => s.openid === t.fromOpenid)
				const to = res.netScores.find((s) => s.openid === t.toOpenid)
				return {
					fromOpenid: t.fromOpenid,
					toOpenid: t.toOpenid,
					from: from?.nickname || '牌友',
					to: to?.nickname || '牌友',
					amount: t.amount,
					fromAvatarUrl: from?.avatarUrl || ''
				}
			})
		})
		.catch((err) => {
			console.error('[room-detail] 结算数据加载失败:', err)
			uni.showToast({ title: `对局详情加载失败：${err?.errMsg || err?.errMessage || err?.message || '未知错误'}`, icon: 'none' })
		})
}
</script>

<style lang="scss" scoped src="./style.scss"></style>
