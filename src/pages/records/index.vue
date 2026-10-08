<template>
	<SafePageWrapper>
		<view class="records-page">
			<!-- 有历史：累计统计 + 按日归档 -->
			<template v-if="groupList.length > 0">
				<view class="summary">
					<view class="stat">
						<view class="num">{{ summary.total }}</view>
						<view class="label">总局数</view>
					</view>
					<view class="divider"></view>
					<view class="stat" :class="summary.winRate >= 50 ? 'win' : 'lose'">
						<view class="num">{{ summary.winRate }}%</view>
						<view class="label">胜率</view>
					</view>
					<view class="divider"></view>
					<view class="stat" :class="summary.net >= 0 ? 'win' : 'lose'">
						<view class="num">{{ formatNet(summary.net) }}</view>
						<view class="label">累计积分</view>
					</view>
				</view>

				<view v-for="group in groupList" :key="group.title">
					<view class="group-title">{{ group.title }}</view>
					<view class="record-list">
						<view v-for="item in group.list" :key="item.roomId" class="record-item" @click="_goDetail(item)">
							<view class="g-avatar" :style="avatarStyle(hashColor(item.roomCode))">房</view>
							<view class="meta">
								<view class="room">
									<text>牌局</text>
									<text class="code">{{ item.roomCode }}</text>
								</view>
								<view class="sub">{{ item.memberCount }} 人 · {{ item.timeLabel }} · 共 {{ item.count }} 笔</view>
							</view>
							<view class="amount" :class="item.net >= 0 ? 'text-win' : 'text-lose'">
								{{ formatNet(item.net) }}
							</view>
							<view class="arrow">›</view>
						</view>
					</view>
				</view>
			</template>

			<!-- 空状态：对齐 design/empty-records.html -->
			<view v-else class="empty">
				<view class="illus">🃏</view>
				<view class="title">还没有牌局记录</view>
				<view class="desc">
					<text>创建房间或扫码加入好友的牌局，</text>
					<text>打完自动生成战绩。</text>
				</view>
				<button class="btn primary" @click="_goHome">+ 去开局</button>
			</view>
		</view>
	</SafePageWrapper>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import SafePageWrapper from '@/components/SafePageWrapper.vue'
import { getMyGames } from '@/apis/game'
import type { I_GameItem } from '@/apis/game'

defineOptions({
	name: 'Records'
})

/** @description 头像配色（背景 + 文字色）*/
interface I_Avatar {
	bg: string
	color: string
}

/** @description 单条历史牌局（渲染模型）*/
interface I_RecordItem {
	roomId: string
	roomCode: string
	/** 参与人数 */
	memberCount: number
	/** 展示用时间文案，如 "14:20"、"周三 19:00" */
	timeLabel: string
	/** 转账笔数 */
	count: number
	/** 本人净输赢 */
	net: number
}

/** @description 按日期归档的分组*/
interface I_RecordGroup {
	title: string
	list: I_RecordItem[]
}

/** @description 一天的毫秒数（归档计算用）*/
const DAY_MS = 86400000

/** @description 头像配色方案（对齐设计稿 mock）*/
const AVATAR_PRESET: TDict<I_Avatar> = {
	default: { bg: 'var(--primary-soft)', color: 'var(--primary-text)' },
	win: { bg: 'var(--win-soft)', color: 'var(--win-text)' },
	lose: { bg: 'var(--lose-soft)', color: 'var(--lose-text)' },
	green: { bg: '#e8f7ee', color: '#34a35b' },
	purple: { bg: '#f3e8ff', color: '#7c4dff' }
}

/** @description 配色轮转顺序*/
const AVATAR_KEYS = ['default', 'win', 'lose', 'green', 'purple']

/** @description 拼接头像内联样式*/
const avatarStyle = (avatar: I_Avatar): string => {
	return `background:${avatar.bg};color:${avatar.color}`
}

/** @description 无头像房间按房号哈希取固定配色（同一局颜色稳定）*/
const hashColor = (roomCode: string): I_Avatar => {
	const sum = [...roomCode].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
	return AVATAR_PRESET[AVATAR_KEYS[sum % AVATAR_KEYS.length]]
}

/** @description 格式化净输赢展示（正数带 + 号）*/
const formatNet = (net: number): string => {
	return net >= 0 ? `+${net}` : `${net}`
}

/** @description 累计统计（已结算对局实时汇总）*/
const summary = ref({ total: 0, winRate: 0, net: 0 })

/** @description 按日期归档的历史牌局（为空时展示空状态）*/
const groupList = ref<I_RecordGroup[]>([])

/** @description 汇总累计统计：总局数 / 胜率（净额>0 记胜）/ 累计积分*/
const _buildSummary = (games: I_GameItem[]) => {
	const net = games.reduce((acc, g) => acc + g.net, 0)
	const wins = games.filter((g) => g.net > 0).length
	summary.value = {
		total: games.length,
		winRate: games.length ? Math.round((wins / games.length) * 100) : 0,
		net
	}
}

/** @description 按自然日归档分组（今天/昨天/本周更早/更早），周一为一周起点；时间文案本地时区*/
const _buildGroups = (games: I_GameItem[]): I_RecordGroup[] => {
	const now = new Date()
	const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
	const startOfWeek = startOfToday - ((now.getDay() + 6) % 7) * DAY_MS
	const pad = (n: number) => String(n).padStart(2, '0')
	const weekNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

	const map: TDict<I_RecordItem[]> = {}
	for (const g of games) {
		const d = new Date(g.lastTime)
		const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`
		let title = '更早'
		let timeLabel = `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hm}`
		if (g.lastTime >= startOfToday) {
			title = '今天'
			timeLabel = hm
		} else if (g.lastTime >= startOfToday - DAY_MS) {
			title = '昨天'
			timeLabel = hm
		} else if (g.lastTime >= startOfWeek) {
			title = '本周更早'
			timeLabel = `${weekNames[d.getDay()]} ${hm}`
		}
		if (!map[title]) map[title] = []
		map[title].push({
			roomId: g.roomId,
			roomCode: g.roomCode,
			memberCount: g.memberCount,
			timeLabel,
			count: g.count,
			net: g.net
		})
	}
	const order = ['今天', '昨天', '本周更早', '更早']
	return order.filter((t) => map[t] && map[t].length).map((t) => ({ title: t, list: map[t] }))
}

/** @description 拉取我的战绩并归档（tab 页 onShow 每次刷新）*/
const _fetchGames = () => {
	uni.showLoading({ title: '加载中…', mask: true })
	getMyGames()
		.then((res) => {
			const games = res.games || []
			_buildSummary(games)
			groupList.value = _buildGroups(games)
		})
		.catch((err) => {
			console.error('[records] 战绩加载失败:', err)
			uni.showToast({ title: `战绩加载失败：${err?.errMsg || err?.errMessage || err?.message || '未知错误'}`, icon: 'none' })
		})
		.finally(() => {
			uni.hideLoading()
		})
}

onShow(() => {
	_fetchGames()
})

/** @description 查看对局详情（携带真实 roomId，缺参防御由详情页兜底）*/
const _goDetail = (item: I_RecordItem) => {
	uni.navigateTo({ url: `/pages/room-detail/index?roomId=${item.roomId}&roomCode=${item.roomCode}` })
}

/** @description 去首页开局*/
const _goHome = () => {
	uni.switchTab({ url: '/pages/home/index' })
}
</script>

<style lang="scss" scoped src="./style.scss"></style>
