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
						<view v-for="item in group.list" :key="item.code" class="record-item" @click="_goDetail(item.code)">
							<view class="g-avatar" :style="avatarStyle(item.avatar)">房</view>
							<view class="meta">
								<view class="room">
									<text>牌局</text>
									<text class="code">{{ item.code }}</text>
								</view>
								<view class="sub">{{ item.members }} 人 · {{ item.timeLabel }} · 共 {{ item.count }} 笔</view>
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
import SafePageWrapper from '@/components/SafePageWrapper.vue'

defineOptions({
	name: 'Records'
})

/** @description 头像配色（背景 + 文字色）*/
interface I_Avatar {
	bg: string
	color: string
}

/** @description 单条历史牌局*/
interface I_RecordItem {
	code: string
	/** 参与人数 */
	members: number
	/** 展示用时间文案，如 "14:20"、"周三 19:00" */
	timeLabel: string
	/** 转账笔数 */
	count: number
	/** 本人净输赢 */
	net: number
	avatar: I_Avatar
}

/** @description 按日期归档的分组*/
interface I_RecordGroup {
	title: string
	list: I_RecordItem[]
}

/** @description 头像配色方案（对齐设计稿 mock）*/
const AVATAR_PRESET: TDict<I_Avatar> = {
	default: { bg: 'var(--primary-soft)', color: 'var(--primary-text)' },
	win: { bg: 'var(--win-soft)', color: 'var(--win-text)' },
	lose: { bg: 'var(--lose-soft)', color: 'var(--lose-text)' },
	green: { bg: '#e8f7ee', color: '#34a35b' },
	purple: { bg: '#f3e8ff', color: '#7c4dff' }
}

/** @description 拼接头像内联样式*/
const avatarStyle = (avatar: I_Avatar): string => {
	return `background:${avatar.bg};color:${avatar.color}`
}

/** @description 格式化净输赢展示（正数带 + 号）*/
const formatNet = (net: number): string => {
	return net >= 0 ? `+${net}` : `${net}`
}

/** @description 累计统计（mock，云开发接入后由 game_records 实时汇总）*/
const summary = ref({ total: 12, winRate: 58, net: 340 })

/** @description 按日期归档的历史牌局（mock，为空时展示空状态）*/
const groupList = ref<I_RecordGroup[]>([
	{
		title: '今天',
		list: [{ code: 'mucj', members: 4, timeLabel: '14:20', count: 5, net: -60, avatar: AVATAR_PRESET.default }]
	},
	{
		title: '昨天',
		list: [
			{ code: 'a8kp', members: 3, timeLabel: '21:05', count: 8, net: 150, avatar: AVATAR_PRESET.win },
			{ code: 'n2qx', members: 3, timeLabel: '15:30', count: 4, net: 50, avatar: AVATAR_PRESET.green }
		]
	},
	{
		title: '本周更早',
		list: [
			{ code: 't9me', members: 4, timeLabel: '周三 19:00', count: 6, net: -40, avatar: AVATAR_PRESET.lose },
			{ code: 'x7w2', members: 4, timeLabel: '周一 20:30', count: 9, net: 240, avatar: AVATAR_PRESET.purple }
		]
	}
])

/** @description 查看对局详情*/
const _goDetail = (code: string) => {
	uni.navigateTo({ url: `/pages/room-detail/index?roomCode=${code}` })
}

/** @description 去首页开局*/
const _goHome = () => {
	uni.switchTab({ url: '/pages/home/index' })
}
</script>

<style lang="scss" scoped src="./style.scss"></style>
