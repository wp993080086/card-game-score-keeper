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
				<!-- 加载骨架：灰圆+灰条占住卡片高度，避免空卡塌缩；数据到后原位替换 -->
				<template v-if="loading">
					<view v-for="i in 2" :key="`sk-p-${i}`" class="sk-row">
						<view class="sk-avatar"></view>
						<view class="sk-line"></view>
					</view>
				</template>
				<template v-else>
					<view v-for="plan in planList" :key="`${plan.fromOpenid}-${plan.toOpenid}`" class="plan-item">
						<!-- 头像：固定尺寸 g-avatar 包裹 + 内层 image 100%（对齐首页写法）；无头像/加载失败兜底默认头像 -->
						<view class="g-avatar sm">
							<image class="avatar-img" :src="avatarDisplaySrc(plan.fromAvatarUrl)" mode="aspectFill" @error="onAvatarError(plan.fromAvatarUrl)" />
						</view>
						<view class="from">{{ plan.from }}</view>
						<view class="arrow">→</view>
						<view class="to">{{ plan.to }}</view>
						<view class="amount">{{ plan.amount }} 分</view>
					</view>
					<view v-if="!loading && !planList.length" class="card-empty">
						<view class="ico">🃏</view>
						<view class="txt">{{ transferCount > 0 ? '本局已两清，无需再转' : '本局没有转账记录' }}</view>
					</view>
				</template>
			</view>

			<!-- 每人累计输赢 -->
			<view class="section-title">每人累计输赢</view>
			<view class="stats-card">
				<!-- 加载骨架：同结算方案卡 -->
				<template v-if="loading">
					<view v-for="i in 2" :key="`sk-s-${i}`" class="sk-row">
						<view class="sk-avatar"></view>
						<view class="sk-line"></view>
					</view>
				</template>
				<template v-else>
					<view v-for="stat in netScores" :key="stat.openid" class="stat-row">
						<!-- 头像：固定尺寸 g-avatar 包裹 + 内层 image 100%（对齐首页写法）；无头像/加载失败兜底默认头像 -->
						<view class="g-avatar sm">
							<image class="avatar-img" :src="avatarDisplaySrc(stat.avatarUrl)" mode="aspectFill" @error="onAvatarError(stat.avatarUrl)" />
						</view>
						<view class="name">{{ stat.name }}</view>
						<view class="val" :class="stat.net >= 0 ? 'win' : 'lose'">{{ formatNet(stat.net) }}</view>
					</view>
					<view v-if="!loading && !netScores.length" class="card-empty">
						<view class="ico">📊</view>
						<view class="txt">暂无输赢数据</view>
						<view class="sub">若长时间未显示，请返回重试</view>
					</view>
				</template>
			</view>

			<!-- 底部操作入口：2×2 对齐房间页按钮样式；未结算时战绩图两钮隐藏，流水+返回各半 -->
			<view class="entry-bar">
				<view v-if="settled" class="entry-btn" @click="_saveResult">📥 保存战绩图</view>
				<view v-if="settled" class="entry-btn" @click="_shareResult">📤 分享战绩图</view>
				<view class="entry-btn" @click="_goFlow">📋 查看流水明细</view>
				<!-- 栈根（结算完成 reLaunch 进入，无上一页）→ 回到首页；从战绩页 navigateTo 进入 → 返回上一页 -->
				<view class="entry-btn" @click="_goBackHome">{{ isStackRoot ? '🏠 回到首页' : '🔙 返回上一页' }}</view>
			</view>
		</template>

		<!-- 战绩图绘制画布（屏外渲染，仅用于生成图片；canvas 2d 无法离屏创建） -->
		<canvas id="poster" type="2d" class="poster-canvas"></canvas>
	</view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { settle } from '@/apis/room'
import { cloudErrMsg } from '@/apis/cloud'
import { useAvatarFallback, DEFAULT_AVATAR } from '@/utils/avatar'
import { generateResultPoster, savePosterToAlbum, openSharePanel } from '@/utils/poster'

defineOptions({
	name: 'RoomDetail'
})

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

/** @description 头像加载失败兜底（失败地址换本地 avatar.png 占位）*/
const { failed, onAvatarError } = useAvatarFallback()

/** @description cloud:// fileID → 临时链接解析结果缓存（'' 解析中，DEFAULT_AVATAR 解析失败）*/
const avatarUrls = ref<TDict<string>>({})

/** @description cloud fileID 转临时链接（一次性，结果缓存；读不到/失败兜底默认头像）*/
const _resolveCloudAvatar = (url: string) => {
	if (avatarUrls.value[url] !== undefined) return
	avatarUrls.value = { ...avatarUrls.value, [url]: '' }
	wx.cloud
		.getTempFileURL({ fileList: [url] })
		.then((res: TAny) => {
			const temp = res?.fileList?.[0]?.tempFileURL || ''
			avatarUrls.value = { ...avatarUrls.value, [url]: temp || DEFAULT_AVATAR }
		})
		.catch(() => {
			avatarUrls.value = { ...avatarUrls.value, [url]: DEFAULT_AVATAR }
		})
}

/** @description 头像实际渲染地址：无头像/解析失败 → 默认头像兜底；https 直用（加载失败走 @error）*/
const avatarDisplaySrc = (url: string): string => {
	if (!url || failed.value[url]) return DEFAULT_AVATAR
	if (!url.startsWith('cloud://')) return url
	_resolveCloudAvatar(url)
	return avatarUrls.value[url] || DEFAULT_AVATAR
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

/** @description 结算数据加载中（空态文案只在加载结束后才参与判断，避免先闪"无内容"再出数据）*/
const loading = ref(true)

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
const myNet = computed(() => netScores.value.find((s) => s.openid === myOpenid.value)?.net ?? 0)

/** @description 房间 id 缺失（进入来源未携带参数，如战绩列表占位数据）*/
const missingRoom = ref(false)

/** @description 是否页面栈根（reLaunch 清栈进入时无上一页，原生返回键不可用，需展示页内回首页入口）*/
const isStackRoot = ref(false)

/** @description 接收页面参数并拉取结算快照（缺 roomId 时不请求，直接展示空状态）*/
onLoad((options: TAny) => {
	isStackRoot.value = getCurrentPages().length <= 1
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

/** @description 末位入口：栈根（结算完成 reLaunch 进入，无上一页）回首页；从战绩页进来返回上一页（失败兜底回首页）*/
const _goBackHome = () => {
	if (isStackRoot.value) {
		uni.reLaunch({ url: '/pages/home/index' })
		return
	}
	uni.navigateBack({ fail: () => uni.reLaunch({ url: '/pages/home/index' }) })
}

/** @description 首页码 fileID（settle 快照带出，战绩图底部用）*/
const homeQrFileID = ref('')

/** @description 生成战绩图临时文件（查画布→绘制→导出；保存/分享共用）*/
const _ensurePoster = (): Promise<string> => {
	uni.showLoading({ title: '生成中…', mask: true })
	return generateResultPoster({
		canvasId: 'poster',
		roomCode: roomCode.value,
		rows: netScores.value.map((s) => ({ nickname: s.name, delta: s.net })),
		homeQrFileID: homeQrFileID.value
	}).finally(() => {
		uni.hideLoading()
	})
}

/** @description 战绩图生成失败统一提示*/
const _posterError = (err: TAny) => {
	console.error('[room-detail] 战绩图生成失败:', err)
	uni.showToast({ title: `生成失败：${cloudErrMsg(err)}`, icon: 'none' })
}

/** @description 保存战绩图到相册（回调精准：成功 toast「已保存到相册」；取消静默；授权被拒引导去设置）*/
const _saveResult = () => {
	_ensurePoster()
		.then((filePath) => savePosterToAlbum(filePath, '[room-detail]'))
		.catch(_posterError)
}

/** @description 分享战绩图：生成后直接弹系统转发面板（发送给朋友/收藏/下载），不做保存动作（保存走独立的「保存战绩图」按钮）*/
const _shareResult = () => {
	_ensurePoster()
		.then((filePath) => openSharePanel(filePath, '[room-detail]'))
		.catch(_posterError)
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
			homeQrFileID.value = res.homeQrFileID || ''
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
			uni.showToast({ title: `对局详情加载失败：${cloudErrMsg(err)}`, icon: 'none' })
		})
		.finally(() => {
			loading.value = false
		})
}
</script>

<style lang="scss" scoped src="./style.scss"></style>
