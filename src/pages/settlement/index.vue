<template>
	<view class="settlement-page">
		<view class="screen-pad">
			<!-- MVP 区：头像 + 右上角皇冠角标 + 收益（净额最高者） -->
			<view class="mvp">
				<view class="avatar-wrap">
					<image
						v-if="mvp?.avatarUrl"
						class="g-avatar lg win-avatar avatar-img"
						:src="avatarSrc(mvp.avatarUrl)"
						mode="aspectFill"
						@error="onAvatarError(mvp.avatarUrl)"
					/>
					<view v-else class="g-avatar lg win-avatar">{{ mvp ? mvp.nickname.charAt(0) : '牌' }}</view>
				</view>
				<view class="earnings">
					<text class="label">{{ mvp ? `${mvp.nickname || '牌友'} MVP` : '--' }}</text>
					<text class="amount">{{ mvp ? `${mvp.delta >= 0 ? '+' : ''}${mvp.delta} 分` : '--' }}</text>
				</view>
			</view>

			<!-- 结算方案：加载中 / 失败可重试 / 真无转账，三态区分（失败不再误显示"没有转账记录"） -->
			<view class="section-title">结算方案</view>
			<view class="plans">
				<view v-for="plan in planList" :key="`${plan.fromOpenid}-${plan.toOpenid}`" class="plan-item">
					<image
						v-if="plan.fromAvatarUrl"
						class="g-avatar sm avatar-img"
						:src="avatarSrc(plan.fromAvatarUrl)"
						mode="aspectFill"
						@error="onAvatarError(plan.fromAvatarUrl)"
					/>
					<view v-else class="g-avatar sm" :style="avatarStyle(hashColor(plan.from))">{{ plan.from.charAt(0) }}</view>
					<view class="from">{{ plan.from }}</view>
					<view class="arrow">→</view>
					<view class="to">{{ plan.to }}</view>
					<view class="amount">{{ plan.amount }} 分</view>
				</view>
				<view v-if="previewing" class="card-empty">
					<view class="txt">结算方案计算中…</view>
				</view>
				<view v-else-if="loadError" class="card-empty" @click="_fetchPreview">
					<view class="ico">⚠️</view>
					<view class="txt">结算方案加载失败，点击重试</view>
				</view>
				<view v-else-if="!planList.length" class="card-empty">
					<view class="ico">🃏</view>
					<view class="txt">{{ recordCount > 0 ? '本局已两清，无需再转' : '本局没有转账记录' }}</view>
				</view>
			</view>

			<!-- 功能区 -->
			<view class="section-title">更多</view>
			<view class="grid-3">
				<view class="action-card" @click="_openRecords">
					<view class="ico-wrap" style="background: #e8f5e9">📋</view>
					<view class="label">流水明细</view>
				</view>
				<view class="action-card" @click="_openManual">
					<view class="ico-wrap" style="background: #e3f2fd">📖</view>
					<view class="label">使用手册</view>
				</view>
				<view class="action-card danger" @click="_openLeave">
					<view class="ico-wrap" style="background: #fff1ed; color: #f76565">✕</view>
					<view class="label">退出房间</view>
				</view>
			</view>
		</view>

		<!-- 底部操作栏：已结算查看详情；房主可确认；成员等待房主 -->
		<view class="share-bar">
			<button v-if="isOwner && !settled" class="btn primary" :disabled="confirming" @click="_openSettleConfirm">
				{{ confirming ? '结算中…' : '确认结算' }}
			</button>
			<button v-else-if="settled" class="btn primary" @click="_goDetail">查看对局详情</button>
			<view v-else class="waiting">等待房主确认结算</view>
		</view>

		<!-- 退出/解散确认弹窗：对齐 design/confirm-dialog.html（房主=解散 / 成员=退出，文案随身份切换） -->
		<view v-if="showLeave" class="mask" @click="_closeLeave">
			<view class="confirm-dialog" @click.stop>
				<view class="ico">⚠</view>
				<view class="title">{{ leaveTitle }}</view>
				<view class="desc">
					<text v-if="isOwner">你是房主，退出将解散房间，</text>
					<text v-if="isOwner">所有成员将被清出。</text>
					<text v-if="isOwner && recordCount > 0">未结算积分不会进入战绩。</text>
					<text v-if="!isOwner">确定要退出本房间吗？退出后可重新进房。</text>
				</view>
				<view class="dialog-btns">
					<button class="btn outline" @click="_closeLeave">取消</button>
					<button class="btn danger-solid" :disabled="leaving" @click="_leave">{{ leaveTitle }}</button>
				</view>
			</view>
		</view>

		<!-- 确认结算弹窗：结算落库不可修改且全员清出，二次确认防误触 -->
		<view v-if="showSettleConfirm" class="mask" @click="_closeSettleConfirm">
			<view class="confirm-dialog" @click.stop>
				<view class="ico">⚠</view>
				<view class="title">确认结算</view>
				<view class="desc">
					<text>结算后本局账目定格，</text>
					<text>所有成员将被清出房间。</text>
				</view>
				<view class="dialog-btns">
					<button class="btn outline" @click="_closeSettleConfirm">取消</button>
					<button class="btn danger-solid" :disabled="confirming" @click="_confirmSettle">确认结算</button>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { leaveRoom, settle } from '@/apis/room'
import { cloudErrMsg } from '@/apis/cloud'
import { useAvatarFallback } from '@/utils/avatar'
import type { I_NetScore, I_TransferItem } from '@/apis/room'

defineOptions({
	name: 'Settlement'
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

/** @description 房间 id 与房号（跳转带入）*/
const roomId = ref('')
const roomCode = ref('')

/** @description 房间文档（ownerOpenid 判断房主身份）*/
const roomInfo = ref<TAny | null>(null)

/** @description 当前用户 openid（users「仅创建者可读写」权限下 get 即自己的记录）*/
const myOpenid = ref('')

/** @description 房间是否已结算落库*/
const settled = ref(false)

/** @description 方案计算中（settle 预览请求）*/
const previewing = ref(true)

/** @description 方案加载失败（与"真无转账"区分开，支持点击重试）*/
const loadError = ref(false)

/** @description 头像加载失败兜底（失败地址换本地 avatar.png 占位）*/
const { onAvatarError, avatarSrc } = useAvatarFallback()

/** @description 最少转账方案（昵称渲染模型）*/
const planList = ref<I_PlanItem[]>([])

/** @description 本局流水笔数（方案为空但笔数大于 0 时是互相转平，不是没打过）*/
const recordCount = ref(0)

/** @description 每人净额快照（降序，MVP 取首条）*/
const netScores = ref<I_NetScore[]>([])

/** @description 确认结算请求进行中*/
const confirming = ref(false)

/** @description 退出请求进行中*/
const leaving = ref(false)

/** @description 退出/解散确认弹窗显隐（文案随身份切换）*/
const showLeave = ref(false)

/** @description 弹窗标题：房主=解散房间，成员=退出房间*/
const leaveTitle = computed(() => (isOwner.value ? '解散房间' : '退出房间'))

/** @description 确认结算弹窗显隐（结算不可逆，二次确认防误触）*/
const showSettleConfirm = ref(false)

/** @description MVP（净额最高者）*/
const mvp = computed(() => netScores.value[0] || null)

/** @description 是否房主*/
const isOwner = computed(() => !!roomInfo.value && roomInfo.value.ownerOpenid === myOpenid.value)

/** @description 接收跳转参数并拉取结算数据*/
onLoad((options: TAny) => {
	roomId.value = options?.roomId || ''
	roomCode.value = options?.roomCode || ''
	_fetchRoomInfo()
	_fetchSelf()
	_fetchPreview()
})

/** @description 拉取房间文档（判房主）*/
const _fetchRoomInfo = () => {
	wx.cloud
		.database()
		.collection('rooms')
		.doc(roomId.value)
		.get()
		.then((res) => {
			roomInfo.value = res.data
		})
		.catch((err) => {
			console.error('[settlement] 拉取房间信息失败:', err)
		})
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
			console.error('[settlement] 拉取个人资料失败:', err)
		})
}

/** @description 预览结算方案（settle preview 模式全员可调；已结算返回落库快照）*/
const _fetchPreview = () => {
	previewing.value = true
	loadError.value = false
	settle(roomId.value, true)
		.then((res) => {
			settled.value = res.settled
			recordCount.value = res.recordCount || 0
			netScores.value = res.netScores || []
			planList.value = (res.transfers || []).map((t: I_TransferItem) => {
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
			console.error('[settlement] 结算方案计算失败:', err)
			loadError.value = true
			uni.showToast({ title: `结算方案加载失败：${cloudErrMsg(err)}`, icon: 'none' })
		})
		.finally(() => {
			previewing.value = false
		})
}

/** @description 确认结算：settle 落库（仅房主）→ 跳对局详情*/
const _confirmSettle = () => {
	if (confirming.value) return
	confirming.value = true
	settle(roomId.value, false)
		.then(() => {
			settled.value = true
			showSettleConfirm.value = false
			// 通知首页清掉该房间的进行中卡片（首页实例常驻时，避免返回后短暂显示已结束的牌局）
			uni.$emit('room:settled', roomId.value)
			uni.showToast({ title: '已结算', icon: 'success' })
			// 结算完成自动跳转：reLaunch 清栈进入对局详情（栈根 → 页内展示「回到首页」）
			setTimeout(() => {
				uni.reLaunch({ url: `/pages/room-detail/index?roomId=${roomId.value}&roomCode=${roomCode.value}` })
			}, 600)
		})
		.catch((err) => {
			console.error('[settlement] 确认结算失败:', err)
			uni.showToast({ title: `结算失败：${cloudErrMsg(err)}`, icon: 'none' })
		})
		.finally(() => {
			confirming.value = false
		})
}

/** @description 前往对局详情：navigateTo 保留返回路径（对局详情页第 4 个按钮展示「返回上一页」）*/
const _goDetail = () => {
	uni.navigateTo({ url: `/pages/room-detail/index?roomId=${roomId.value}&roomCode=${roomCode.value}` })
}

/** @description 退出入口：已结算直接回首页（成员已被结算清出，退出必报「已不在房间」）；否则弹退出/解散二次确认*/
const _openLeave = () => {
	if (settled.value) {
		uni.reLaunch({ url: '/pages/home/index' })
		return
	}
	showLeave.value = true
}

/** @description 关闭退出/解散确认弹窗（请求进行中不可关，避免重复点）*/
const _closeLeave = () => {
	if (leaving.value) return
	showLeave.value = false
}

/** @description 打开确认结算弹窗*/
const _openSettleConfirm = () => {
	showSettleConfirm.value = true
}

/** @description 关闭确认结算弹窗（结算请求进行中不可关，避免重复点）*/
const _closeSettleConfirm = () => {
	if (confirming.value) return
	showSettleConfirm.value = false
}

/** @description 执行退出/解散：leaveRoom 云函数 → 清栈回首页*/
const _leave = () => {
	if (leaving.value) return
	leaving.value = true
	uni.showLoading({ title: '处理中…', mask: true })
	leaveRoom(roomId.value)
		.then((res) => {
			uni.hideLoading()
			showLeave.value = false
			uni.showToast({ title: res.dissolved ? '房间已解散' : '已退出房间', icon: 'none' })
			setTimeout(() => {
				uni.reLaunch({ url: '/pages/home/index' })
			}, 600)
		})
		.catch((err) => {
			console.error('[settlement] 退出失败:', err)
			uni.hideLoading()
			uni.showToast({ title: `退出失败：${cloudErrMsg(err)}`, icon: 'none' })
		})
		.finally(() => {
			leaving.value = false
		})
}

/** @description 打开流水明细（本房间原始转账流水）*/
const _openRecords = () => {
	uni.navigateTo({ url: `/pages/flow/index?roomId=${roomId.value}&roomCode=${roomCode.value}` })
}

/** @description 打开使用手册*/
const _openManual = () => {
	uni.navigateTo({ url: '/pages/manual/index' })
}
</script>

<style lang="scss" scoped src="./style.scss"></style>
