<template>
	<view class="settlement-page">
		<view class="screen-pad">
			<!-- MVP 区：头像 + 右上角皇冠角标 + 收益（净额最高者） -->
			<view class="mvp">
				<view class="avatar-wrap">
					<image v-if="mvp?.avatarUrl" class="g-avatar lg win-avatar avatar-img" :src="mvp.avatarUrl" mode="aspectFill" />
					<view v-else class="g-avatar lg win-avatar">{{ mvp ? mvp.nickname.charAt(0) : '牌' }}</view>
				</view>
				<view class="earnings">
					<text class="label">MVP 收益</text>
					<text class="amount">{{ mvp ? `${mvp.delta >= 0 ? '+' : ''}${mvp.delta} 分` : '--' }}</text>
				</view>
			</view>

			<!-- 结算方案 -->
			<view class="section-title">结算方案</view>
			<view class="plans">
				<view v-for="plan in planList" :key="`${plan.fromOpenid}-${plan.toOpenid}`" class="plan-item">
					<image v-if="plan.fromAvatarUrl" class="g-avatar xs avatar-img" :src="plan.fromAvatarUrl" mode="aspectFill" />
					<view v-else class="g-avatar xs" :style="avatarStyle(hashColor(plan.from))">{{ plan.from.charAt(0) }}</view>
					<view class="from">{{ plan.from }}</view>
					<view class="arrow">→</view>
					<view class="to">{{ plan.to }}</view>
					<view class="amount">{{ plan.amount }} 分</view>
				</view>
				<view v-if="!previewing && !planList.length" class="card-empty">
					<view class="ico">🃏</view>
					<view class="txt">本局没有转账记录</view>
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
			<button class="btn outline" @click="_shareResult">📤 分享战绩图</button>
			<button v-if="isOwner && !settled" class="btn primary" :disabled="confirming" @click="_confirmSettle">
				{{ confirming ? '结算中…' : '确认结算' }}
			</button>
			<button v-else-if="settled" class="btn primary" @click="_goDetail">查看对局详情</button>
			<view v-else class="waiting">等待房主确认结算</view>
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
					<button class="btn danger-solid" :disabled="leaving" @click="_confirmDissolve">解散房间</button>
				</view>
			</view>
		</view>

		<!-- 战绩图绘制画布（屏外渲染，仅用于生成图片） -->
		<canvas id="poster" type="2d" class="poster-canvas"></canvas>
	</view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { leaveRoom, settle } from '@/apis/room'
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

/** @description 最少转账方案（昵称渲染模型）*/
const planList = ref<I_PlanItem[]>([])

/** @description 每人净额快照（降序，MVP 取首条）*/
const netScores = ref<I_NetScore[]>([])

/** @description 确认结算请求进行中*/
const confirming = ref(false)

/** @description 退出请求进行中*/
const leaving = ref(false)

/** @description 解散确认弹窗显隐*/
const showDissolve = ref(false)

/** @description MVP（净额最高者）*/
const mvp = computed(() => netScores.value[0] || null)

/** @description 是否房主*/
const isOwner = computed(() => !!roomInfo.value && roomInfo.value.ownerOpenid === myOpenid.value)

/** @description 提取云开发错误的关键信息用于提示*/
const _errMsg = (err: TAny): string => {
	return err?.errMsg || err?.errMessage || err?.message || '未知错误'
}

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
	settle(roomId.value, true)
		.then((res) => {
			settled.value = res.settled
			netScores.value = res.netScores || []
			homeQrFileID.value = res.homeQrFileID || ''
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
			uni.showToast({ title: `结算方案加载失败：${_errMsg(err)}`, icon: 'none' })
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
			uni.showToast({ title: '已结算', icon: 'success' })
			setTimeout(() => _goDetail(), 600)
		})
		.catch((err) => {
			console.error('[settlement] 确认结算失败:', err)
			uni.showToast({ title: `结算失败：${_errMsg(err)}`, icon: 'none' })
		})
		.finally(() => {
			confirming.value = false
		})
}

/** @description 前往对局详情*/
const _goDetail = () => {
	uni.navigateTo({ url: `/pages/room-detail/index?roomId=${roomId.value}&roomCode=${roomCode.value}` })
}

/** @description 退出入口：房主弹解散确认，成员直接软删退出*/
const _openLeave = () => {
	if (isOwner.value) {
		showDissolve.value = true
		return
	}
	_leave()
}

/** @description 执行退出/解散：leaveRoom 云函数 → 清栈回首页*/
const _leave = () => {
	if (leaving.value) return
	leaving.value = true
	uni.showLoading({ title: '处理中…', mask: true })
	leaveRoom(roomId.value)
		.then((res) => {
			uni.hideLoading()
			showDissolve.value = false
			uni.showToast({ title: res.dissolved ? '房间已解散' : '已退出房间', icon: 'none' })
			setTimeout(() => {
				uni.reLaunch({ url: '/pages/home/index' })
			}, 600)
		})
		.catch((err) => {
			console.error('[settlement] 退出失败:', err)
			uni.hideLoading()
			uni.showToast({ title: `退出失败：${_errMsg(err)}`, icon: 'none' })
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

/** @description 分享战绩图（canvas 绘制第 7 步实现）*/
const _shareResult = () => {
	if (!settled.value) {
		uni.showToast({ title: '请先完成结算', icon: 'none' })
		return
	}
	uni.showLoading({ title: '生成中…', mask: true })
	_getPosterNode()
		.then((node) => _loadHomeQr().then((qrPath) => _drawPoster(node, qrPath)))
		.then(() => _exportPoster())
		.then((filePath) => {
			uni.hideLoading()
			// 系统图片面板自带「发送给朋友 / 保存图片」，一个入口覆盖转发与存相册
			wx.showShareImageMenu({
				path: filePath,
				fail: (err) => {
					// 用户取消不算错误
					if (err?.errMsg && String(err.errMsg).includes('cancel')) return
					console.error('[settlement] 分享面板调起失败:', err)
				}
			})
		})
		.catch((err) => {
			uni.hideLoading()
			console.error('[settlement] 战绩图生成失败:', err)
			uni.showToast({ title: `生成失败：${_errMsg(err)}`, icon: 'none' })
		})
}

/** @description 战绩图硬编码配色（canvas 不认 CSS 变量，取设计变量同款色值）*/
const POSTER_COLOR = {
	title: '#1f2329',
	sub: '#86909c',
	primary: '#4a78d9',
	primarySoft: '#edf2fc',
	win: '#ff8a3d',
	lose: '#f76565',
	divider: '#edf0f5'
}

/** @description 战绩图头像配色（与页面 AVATAR_PRESET 同观感的具体色值）*/
const POSTER_AVATAR_COLORS: TDict<{ bg: string; color: string }> = {
	default: { bg: '#edf2fc', color: '#4a78d9' },
	win: { bg: '#fff3e8', color: '#d96a1f' },
	lose: { bg: '#fff1ed', color: '#d63a3a' },
	green: { bg: '#e8f7ee', color: '#34a35b' }
}

/** @description 战绩图头像配色哈希*/
const posterHashColor = (name: string): { bg: string; color: string } => {
	const sum = [...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
	return POSTER_AVATAR_COLORS[AVATAR_KEYS[sum % AVATAR_KEYS.length]]
}

/** @description 战绩图画布逻辑宽度与行高*/
const POSTER_W = 375
const POSTER_ROW_H = 44
const POSTER_ROW_TOP = 132

/** @description 画布节点缓存（canvas 2d 不可离屏，重复生成复用节点）*/
let posterNode: TAny = null

/** @description 查询画布节点并按 dpr 初始化*/
const _getPosterNode = (): Promise<TAny> => {
	if (posterNode) return Promise.resolve(posterNode)
	return new Promise((resolve, reject) => {
		uni
			.createSelectorQuery()
			.select('#poster')
			.fields({ node: true, size: true }, (res: TAny) => {
				if (!res?.node) {
					reject(new Error('画布初始化失败'))
					return
				}
				posterNode = res.node
				resolve(posterNode)
			})
			.exec()
	})
}

/** @description 首页码 fileID（settle 快照带出）*/
const homeQrFileID = ref('')

/** @description 首页码转本地临时路径（fileID → 临时 URL → 下载）；失败返回空串，战绩图降级为无码*/
const _loadHomeQr = (): Promise<string> => {
	if (!homeQrFileID.value) return Promise.resolve('')
	return new Promise((resolve) => {
		wx.cloud
			.getTempFileURL({ fileList: [homeQrFileID.value] })
			.then((res: TAny) => {
				const url = res?.fileList?.[0]?.tempFileURL
				if (!url) {
					resolve('')
					return
				}
				uni.downloadFile({
					url,
					success: (d) => resolve(d.statusCode === 200 ? d.tempFilePath : ''),
					fail: () => resolve('')
				})
			})
			.catch(() => resolve(''))
	})
}

/** @description 绘制战绩图：标题/房号 + 净额排名（MVP 皇冠）+ 底部首页码，高度随人数自适应*/
const _drawPoster = (node: TAny, qrPath: string): Promise<void> => {
	return new Promise((resolve, reject) => {
		const list = netScores.value.slice(0, 8)
		const qrY = POSTER_ROW_TOP + list.length * POSTER_ROW_H + 24
		const posterH = qrY + (qrPath ? 96 + 46 : 56)
		const dpr = uni.getSystemInfoSync().pixelRatio || 2

		node.width = POSTER_W * dpr
		node.height = posterH * dpr
		const ctx = node.getContext('2d')
		ctx.scale(dpr, dpr)

		// 背景
		ctx.fillStyle = '#ffffff'
		ctx.fillRect(0, 0, POSTER_W, posterH)

		// 标题与房号
		ctx.textAlign = 'center'
		ctx.fillStyle = POSTER_COLOR.title
		ctx.font = 'bold 22px sans-serif'
		ctx.fillText('打牌好友记账', POSTER_W / 2, 48)
		ctx.fillStyle = POSTER_COLOR.sub
		ctx.font = '14px sans-serif'
		ctx.fillText(`房号 ${roomCode.value} · 牌局结算`, POSTER_W / 2, 74)

		// 分割线
		ctx.strokeStyle = POSTER_COLOR.divider
		ctx.lineWidth = 1
		ctx.beginPath()
		ctx.moveTo(24, 96)
		ctx.lineTo(POSTER_W - 24, 96)
		ctx.stroke()

		// 排名列表
		list.forEach((s, i) => {
			const y = POSTER_ROW_TOP + i * POSTER_ROW_H
			// 冠军皇冠 / 序号
			ctx.textAlign = 'left'
			ctx.fillStyle = POSTER_COLOR.title
			ctx.font = i === 0 ? '16px sans-serif' : '14px sans-serif'
			ctx.fillText(i === 0 ? '👑' : `${i + 1}`, 24, y + 2)
			// 圆头像（配色底 + 昵称首字）
			const c = posterHashColor(s.name)
			ctx.beginPath()
			ctx.arc(68, y - 4, 16, 0, Math.PI * 2)
			ctx.fillStyle = c.bg
			ctx.fill()
			ctx.fillStyle = c.color
			ctx.font = 'bold 13px sans-serif'
			ctx.textAlign = 'center'
			ctx.fillText(s.name.charAt(0), 68, y + 1)
			// 昵称
			ctx.fillStyle = POSTER_COLOR.title
			ctx.font = '16px sans-serif'
			ctx.textAlign = 'left'
			ctx.fillText(s.name.length > 8 ? `${s.name.slice(0, 8)}…` : s.name, 96, y + 2)
			// 净额
			ctx.fillStyle = s.delta >= 0 ? POSTER_COLOR.win : POSTER_COLOR.lose
			ctx.font = 'bold 17px sans-serif'
			ctx.textAlign = 'right'
			ctx.fillText(`${s.delta >= 0 ? '+' : ''}${s.delta} 分`, POSTER_W - 24, y + 2)
		})

		const finish = () => resolve()
		if (qrPath) {
			// 首页小程序码
			const img = node.createImage()
			img.onload = () => {
				ctx.drawImage(img, (POSTER_W - 96) / 2, qrY, 96, 96)
				ctx.fillStyle = POSTER_COLOR.sub
				ctx.font = '12px sans-serif'
				ctx.textAlign = 'center'
				ctx.fillText('扫码记牌，理清账目', POSTER_W / 2, qrY + 118)
				finish()
			}
			img.onerror = () => {
				// 码图加载失败降级为纯文字底部
				ctx.fillStyle = POSTER_COLOR.sub
				ctx.font = '12px sans-serif'
				ctx.textAlign = 'center'
				ctx.fillText('—— 打牌好友记账 ——', POSTER_W / 2, qrY + 24)
				finish()
			}
			img.src = qrPath
		} else {
			ctx.fillStyle = POSTER_COLOR.sub
			ctx.font = '12px sans-serif'
			ctx.textAlign = 'center'
			ctx.fillText('—— 打牌好友记账 ——', POSTER_W / 2, qrY + 12)
			finish()
		}
	})
}

/** @description 导出画布为临时图片*/
const _exportPoster = (): Promise<string> => {
	return new Promise((resolve, reject) => {
		wx.canvasToTempFilePath({
			canvas: posterNode,
			success: (res) => resolve(res.tempFilePath),
			fail: reject
		})
	})
}

/** @description 关闭解散确认弹窗*/
const _closeDissolve = () => {
	showDissolve.value = false
}

/** @description 确认解散（房主）：走 leaveRoom 全员清出*/
const _confirmDissolve = () => {
	_leave()
}
</script>

<style lang="scss" scoped src="./style.scss"></style>
