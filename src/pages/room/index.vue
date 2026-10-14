<template>
	<view class="room-page">
		<!-- 公告条 -->
		<view class="notice">
			<text class="ico">ⓘ</text>
			<text>本平台不涉及赌博和金钱，具体请查看使用手册</text>
		</view>

		<!-- 成员条：真实成员（room_members watch）+ 邀请占位；头像用 wrapper 承担圆形与房主角标（image 自身 100% 填充 + border-radius 双保险） -->
		<view class="members-bar">
			<view v-for="member in memberList" :key="member.openid" class="m-item" :class="{ owner: member.isOwner }" @click="_onMemberTap(member)">
				<view class="g-avatar">
					<image
						v-if="member.avatarUrl"
						class="avatar-img"
						:src="avatarSrc(member.avatarUrl)"
						mode="aspectFill"
						@error="onAvatarError(member.avatarUrl)"
					/>
					<view v-else :style="avatarStyle(hashColor(member.nickname))">{{ member.nickname.charAt(0) }}</view>
				</view>
				<view class="name">{{ member.nickname }}</view>
			</view>
			<view v-for="i in inviteSlots" :key="`invite-${i}`" class="m-item" @click="_openQr">
				<view class="g-avatar invite">+</view>
				<view class="name">邀请</view>
			</view>
		</view>

		<!-- 点击提示：三句轮播（每句停 3s → 1s 左滑切下一句，循环） -->
		<view class="tap-hint">
			<view class="hint-viewport">
				<view class="hint-track" :class="{ animated: hintAnimated }" :style="{ transform: `translateX(-${hintIndex * 100}%)` }">
					<text v-for="(msg, i) in hintSlides" :key="i" class="hint-slide">{{ msg }}</text>
				</view>
			</view>
		</view>

		<!-- 消息流：watch 最近 50 条，滚到顶部加载更早 -->
		<scroll-view class="messages" scroll-y :scroll-into-view="scrollInto" upper-threshold="50" @scrolltoupper="_loadOlder">
			<view v-for="msg in messageList" :key="msg.id" class="msg-wrap">
				<!-- 系统消息 -->
				<view v-if="msg.type === 'system'" class="msg system">{{ msg.content }}</view>

				<!-- 转账动态 -->
				<view v-else-if="msg.type === 'payment'" class="msg system pay">
					<text>{{ msg.sender }}</text>
					<text class="arrow">→</text>
					<text>{{ msg.payTo }}</text>
					<text class="amount">{{ msg.amount }} 分</text>
				</view>

				<!-- 聊天气泡 -->
				<view v-else class="msg-row" :class="{ self: msg.senderOpenid === myOpenid }">
					<image v-if="msg.avatarUrl" class="g-avatar sm" :src="avatarSrc(msg.avatarUrl)" mode="aspectFill" @error="onAvatarError(msg.avatarUrl)" />
					<view v-else class="g-avatar sm" :style="avatarStyle(hashColor(msg.sender))">{{ msg.sender.charAt(0) }}</view>
					<view class="bubble">{{ msg.content }}</view>
				</view>
			</view>
			<!-- 滚动锚点 -->
			<view id="anchor-bottom"></view>
		</scroll-view>

		<!-- 底部操作栏 -->
		<view class="actions-bar">
			<button class="btn outline" @click="_goSettle">📋 对局详情</button>
			<button class="btn primary" @click="_openSheet">💬 快捷语句</button>
		</view>

		<!-- 房间二维码弹窗：对齐 design/qr-popup.html（常驻渲染 + .show 切换，进出场均有过渡） -->
		<view class="mask" :class="{ show: showQrPopup }" @touchmove.stop.prevent @click="_closeQr">
			<view class="popup" @click.stop>
				<view class="close" @click="_closeQr">✕</view>
				<view class="head">
					<view class="desc">请在小程序内扫码或输入房号</view>
					<view class="room-row">
						<text class="label">房号</text>
						<text class="code">{{ roomCode }}</text>
						<text class="copy" @click="_copyRoomCode">复制</text>
					</view>
					<view class="hint">微信扫一扫只能看到房号，不能直接进房</view>
				</view>
				<view class="qr-area">
					<!-- createRoom 生成的房间码普通二维码（rooms.qrFileID），空则显示占位 -->
					<image v-if="roomInfo?.qrFileID" class="qr-img" :src="roomInfo.qrFileID" mode="aspectFit" />
					<view v-else class="qr-placeholder">二维码</view>
				</view>
				<view class="tip">也可以 <text class="hl">转发</text> 给好友加入</view>
				<button class="share-btn" open-type="share">📤 转发给好友</button>
			</view>
		</view>

		<!-- 支出 dialog：对齐 design/transfer-input.html（数据 transferTarget 与显隐 showTransfer 分离，退场内容不闪空） -->
		<view class="mask" :class="{ show: showTransfer }" @touchmove.stop.prevent @click="_cancelTransfer">
			<view class="dialog" @click.stop>
				<view class="title">支出</view>
				<view class="subtitle">
					<text>给 </text>
					<text class="name">{{ transferTarget?.nickname }}</text>
				</view>
				<view class="input-wrap">
					<input v-model="transferAmount" class="amount-input" type="number" maxlength="6" placeholder="请输入积分" @confirm="_confirmTransfer" />
					<text class="suffix">分</text>
				</view>
				<view class="dialog-btns">
					<button class="btn ghost" @click="_cancelTransfer">取消</button>
					<button class="btn primary" :disabled="transferring" @click="_confirmTransfer">{{ transferring ? '转账中…' : '确定' }}</button>
				</view>
			</view>
		</view>

		<!-- 快捷语句面板：对齐 design/quick-phrases.html -->
		<view class="sheet-mask" :class="{ show: showSheet }" @touchmove.stop.prevent @click="_closeSheet">
			<view class="sheet" @click.stop>
				<view class="head">
					<view class="title">快捷语句</view>
					<view class="close" @click="_closeSheet">✕</view>
				</view>
				<!-- touchmove.stop：列表自己滚动时阻断冒泡，避免被遮罩的 preventDefault 杀掉触摸滚动 -->
				<scroll-view class="phrase-list" scroll-y @touchmove.stop>
					<view v-for="phrase in quickPhrases" :key="phrase" class="phrase-item" @click="_sendPhrase(phrase)">
						<text>{{ phrase }}</text>
						<text class="send">发送</text>
					</view>
				</scroll-view>
			</view>
		</view>

		<!-- 解散房间确认弹窗：见 settlement 页退出入口（design/confirm-dialog.html） -->
	</view>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { onLoad, onShareAppMessage, onUnload } from '@dcloudio/uni-app'
import { getOngoingRoom, transfer } from '@/apis/room'
import { cloudErrMsg } from '@/apis/cloud'
import { useAvatarFallback } from '@/utils/avatar'

defineOptions({
	name: 'Room'
})

/** @description 头像配色（背景 + 文字色）*/
interface I_Avatar {
	bg: string
	color: string
}

/** @description 房间成员（room_members 活跃记录）*/
interface I_Member {
	openid: string
	nickname: string
	/** 云存储 fileID，未设置头像时为空串 */
	avatarUrl: string
	isOwner: boolean
}

/** @description 消息类型：system=进房动态 / payment=转账动态 / chat=快捷语句气泡*/
type T_MsgType = 'system' | 'payment' | 'chat'

/** @description 消息流渲染模型（messages 文档映射后）*/
interface I_Message {
	/** 消息 _id（去重/渲染 key） */
	id: string
	type: T_MsgType
	/** system/chat 为文案 */
	content: string
	/** 昵称（payment 为支出方） */
	sender: string
	senderOpenid: string
	/** payment 的收入方 */
	payTo: string
	/** payment 的积分额 */
	amount: number
	/** 支出方头像 fileID，未设置头像时为空串 */
	avatarUrl: string
}

/** @description 头像配色方案（无头像成员按昵称哈希取色）*/
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

/** @description 房间 id 与房号（建房/进房跳转带入）*/
const roomId = ref('')
const roomCode = ref('')

/** @description 房间文档（ownerOpenid/maxMembers/qrFileID 等）*/
const roomInfo = ref<TAny | null>(null)

/** @description 当前用户 openid 与资料（users 集合「仅创建者可读写」权限下 get 即自己的记录）*/
const myOpenid = ref('')
const myProfile = ref<{ nickname: string; avatarUrl: string } | null>(null)

/** @description 头像加载失败兜底（失败地址换本地 avatar.png 占位）*/
const { onAvatarError, avatarSrc } = useAvatarFallback()

/** @description 活跃成员原始文档（room_members watch 快照）*/
const rawMembers = ref<TAny[]>([])

/** @description 消息原始文档（messages watch 快照 + 分页历史，asc 排列）*/
const rawMessages = ref<TAny[]>([])

/** @description 成员渲染模型（同一 openid 只留一条，避免重复在场记录叠出两个头像）*/
const memberList = computed<I_Member[]>(() => {
	const map = new Map<string, I_Member>()
	for (const m of rawMembers.value) {
		const openid = m.openid || ''
		if (!openid) continue
		map.set(openid, {
			openid,
			nickname: m.nickname || '',
			avatarUrl: m.avatarUrl || '',
			isOwner: openid === roomInfo.value?.ownerOpenid
		})
	}
	return [...map.values()]
})

/** @description 邀请占位（产品约定：无论缺几人只显示 1 个加号；满员不显示）*/
const inviteSlots = computed(() => ((roomInfo.value?.maxMembers ?? 4) > memberList.value.length ? 1 : 0))

/** @description 消息渲染模型（文档 → 视图字段）*/
const messageList = computed<I_Message[]>(() =>
	rawMessages.value.map((doc) => ({
		id: doc._id,
		type: doc.type === 'payment' ? 'payment' : doc.type === 'system' ? 'system' : 'chat',
		content: doc.content || '',
		sender: doc.senderNickname || '',
		senderOpenid: doc.senderOpenid || '',
		payTo: doc.toNickname || '',
		amount: doc.amount || 0,
		avatarUrl: doc.senderAvatar || ''
	}))
)

/** @description 预置快捷语句（对齐 design/quick-phrases.html，10 条，无 UGC）*/
const quickPhrases = [
	'快点吧，我等到花儿都谢了',
	'好嘞，发牌发牌',
	'这把稳了 🎉',
	'大哥手下留情',
	'我先去趟洗手间',
	'输了输了，愿赌服输',
	'别慌，稳住',
	'今天手气不错 😎',
	'再来一把？',
	'散伙散伙，改天再战'
]

/** @description 消息流滚动锚点（发送/支出后跳到底部）*/
const scrollInto = ref('')

/** @description 二维码弹窗显隐*/
const showQrPopup = ref(false)

/** @description 快捷语句面板显隐*/
const showSheet = ref(false)

/** @description 当前支出目标成员（关闭弹窗不清空，保证退场动画期间内容不闪空）*/
const transferTarget = ref<I_Member | null>(null)

/** @description 支出弹窗显隐（与数据分离，驱动过渡动画）*/
const showTransfer = ref(false)

/** @description 支出积分输入值*/
const transferAmount = ref('')

/** @description 转账请求进行中（防重复提交）*/
const transferring = ref(false)

/** @description 成员/消息/房间实时监听器（onUnload 关闭）*/
let memberWatcher: { close(): void } | null = null
let messageWatcher: { close(): void } | null = null
let roomWatcher: { close(): void } | null = null

/** @description 页面还在时才开始成员监听（补标记的请求可能在离开页面后才回来）*/
let pageAlive = true

/** @description 监听断线重连上限（超限视为环境异常，提示退出重进，避免权限类错误无限重连）*/
const WATCH_RETRY_MAX = 5

/** @description 各监听器重连计数（key: members/messages/room）*/
const watchRetries: TDict<number> = {}

/** @description 监听断线兜底：延迟 3s 重建（watch 重建后会重推 init 快照，数据自动恢复一致）；超限提示退出重进*/
const _reconnectWatch = (key: string, start: () => void) => {
	if (!pageAlive) return
	const n = (watchRetries[key] || 0) + 1
	watchRetries[key] = n
	console.error(`[room] ${key} 实时监听断开，重连 ${n}/${WATCH_RETRY_MAX}`)
	if (n > WATCH_RETRY_MAX) {
		uni.showToast({ title: '实时刷新已断开，请退出房间重新进入', icon: 'none' })
		return
	}
	setTimeout(() => {
		if (pageAlive) start()
	}, 3000)
}

/** @description 加载更早消息进行中（防 scrolltoupper 连续触发）*/
const loadingOlder = ref(false)

/** @description 是否还有更早消息（一批取满 50 视为还有）*/
const hasMoreMessages = ref(true)

/** @description 提示轮播文案（尾部复制第一句用于"最后→第一句"的无缝左滑）*/
const HINTS = ['点击其他成员头像，向ta支付积分', '转错了？本平台不支持撤销，让对方反向转一次即可修正', '打完后房主点结算，自动算最少转账方案']
const hintSlides = [...HINTS, HINTS[0]]

/** @description 当前滑动到第几张（=HINTS.length 时为尾部克隆帧，播完瞬间无动画跳回 0）*/
const hintIndex = ref(0)

/** @description 是否带左滑过渡（跳回 0 的瞬间要关掉，避免倒放）*/
const hintAnimated = ref(true)

/** @description 轮播定时器（onUnload 清除）*/
let hintTimer: ReturnType<typeof setTimeout> | null = null

/** @description 轮播节拍：停 3s → 1s 左滑到下一句 → 若滑到克隆帧则无动画跳回第一句 → 循环*/
const _nextHint = () => {
	hintTimer = setTimeout(() => {
		hintIndex.value += 1
		hintTimer = setTimeout(() => {
			if (hintIndex.value >= HINTS.length) {
				hintAnimated.value = false
				hintIndex.value = 0
				// 跳回渲染完成后下一帧再恢复过渡，保证下一轮滑动有动画
				setTimeout(() => {
					hintAnimated.value = true
					_nextHint()
				}, 50)
				return
			}
			_nextHint()
		}, 1000)
	}, 3000)
}
_nextHint()

/** @description 接收跳转参数并初始化房间数据*/
onLoad((options: TAny) => {
	roomId.value = options?.roomId || ''
	roomCode.value = options?.roomCode || ''
	if (!roomId.value) {
		// 异常进入（无参直达）兜底，正常路径不会出现
		uni.showToast({ title: '房间参数缺失', icon: 'none' })
		setTimeout(() => uni.navigateBack(), 800)
		return
	}
	_fetchRoomInfo()
	_fetchSelf()
	_watchMessages()
	_watchRoom()
	// 旧成员记录没有 active。先等云函数补上在场标记再监听，否则成员条会是空的
	getOngoingRoom()
		.catch((err) => {
			console.error('[room] 补齐在场成员失败:', err)
		})
		.finally(() => {
			if (!pageAlive) return
			_watchMembers()
		})
})

/** @description 离开页面关闭实时监听与轮播*/
onUnload(() => {
	pageAlive = false
	memberWatcher?.close()
	messageWatcher?.close()
	roomWatcher?.close()
	if (hintTimer) clearTimeout(hintTimer)
})

/** @description 拉取房间文档（房主/上限/小程序码 fileID）*/
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
			console.error('[room] 拉取房间信息失败:', err)
		})
}

/** @description 拉取自己资料（依赖 users「仅创建者可读写」权限：get 过滤后只返回自己的记录，_openid 即自身身份）*/
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
				myProfile.value = { nickname: doc.nickname || '', avatarUrl: doc.avatarUrl || '' }
			}
		})
		.catch((err) => {
			console.error('[room] 拉取个人资料失败:', err)
		})
}

/** @description 只监听在场成员。历史全量监听超过默认 100 条时，后加入的人会消失。
 *   条件是 roomId + active + joinedAt，云数据库需有这条组合索引 */
const _watchMembers = () => {
	const db = wx.cloud.database()
	memberWatcher = db
		.collection('room_members')
		.where({ roomId: roomId.value, active: true })
		.orderBy('joinedAt', 'asc')
		.watch({
			onChange: (snapshot) => {
				rawMembers.value = snapshot.docs
			},
			onError: (err) => {
				console.error('[room] 成员实时监听失败:', err)
				_reconnectWatch('members', _watchMembers)
			}
		})
}

/** @description 结算/解散弹窗只提示一次（重连重建监听后也不重复弹，标记放外层跨闭包共享）*/
let roomPrompted = false

/** @description 监听房间状态。解散时所有人确认后再离开。结算时房主由结算页自己跳转，其他人点「看战绩」再去对局详情 */
const _watchRoom = () => {
	roomWatcher = wx.cloud
		.database()
		.collection('rooms')
		.where({ _id: roomId.value })
		.watch({
			onChange: (snapshot) => {
				const room = snapshot.docs[0]
				if (!room) return
				// 房间文档有变就同步进 roomInfo（含初始快照）：createRoom 的二维码是异步生成回填
				// rooms.qrFileID 的，弹窗早退拦掉更新会导致弹窗里永远显示"二维码"占位
				roomInfo.value = room
				// settling 是结算落库中的中间态，还没结束，不能当成解散把人带离
				if (room.status === 'gaming' || room.status === 'settling' || roomPrompted) return
				roomPrompted = true
				const settled = room.status === 'settled'
				// 房主在结算页确认后会自己跳到对局详情。这里再弹，会被那次跳转马上关掉
				if (settled && room.ownerOpenid && room.ownerOpenid === myOpenid.value) return
				uni.showModal({
					title: settled ? '本局已结算' : '房间已解散',
					content: settled ? '去看看对局战绩' : '房主已解散房间',
					showCancel: false,
					confirmText: settled ? '看战绩' : '知道了',
					success: (res) => {
						if (!res.confirm) return
						uni.reLaunch({
							url: settled ? `/pages/room-detail/index?roomId=${roomId.value}&roomCode=${roomCode.value}` : '/pages/home/index'
						})
					}
				})
			},
			onError: (err) => {
				console.error('[room] 房间状态监听失败:', err)
				_reconnectWatch('room', _watchRoom)
			}
		})
}

/** @description 监听消息：初始快照取最新 50 条（desc 拉取后反转），增量 add 追加尾部（_id 去重）*/
const _watchMessages = () => {
	messageWatcher = wx.cloud
		.database()
		.collection('messages')
		.where({ roomId: roomId.value })
		.orderBy('createdAt', 'desc')
		.limit(50)
		.watch({
			onChange: (snapshot) => {
				if (snapshot.type === 'init') {
					rawMessages.value = [...snapshot.docs].reverse()
					_scrollToBottom()
					return
				}
				snapshot.docChanges.forEach((change) => {
					if (change.dataType === 'add' && !rawMessages.value.some((m) => m._id === change.doc._id)) {
						rawMessages.value.push(change.doc)
						_scrollToBottom()
					}
				})
			},
			onError: (err) => {
				// 常见于集合权限未放开读，控制台排查看这里
				console.error('[room] 消息实时监听失败:', err)
				_reconnectWatch('messages', _watchMessages)
			}
		})
}

/** @description 滚到顶部加载更早消息（skip 已加载条数，desc 取 50 后反转前置）*/
const _loadOlder = () => {
	if (!hasMoreMessages.value || loadingOlder.value) return
	loadingOlder.value = true
	wx.cloud
		.database()
		.collection('messages')
		.where({ roomId: roomId.value })
		.orderBy('createdAt', 'desc')
		.skip(rawMessages.value.length)
		.limit(50)
		.get()
		.then((res) => {
			if (res.data.length < 50) {
				hasMoreMessages.value = false
			}
			rawMessages.value = [...res.data.reverse(), ...rawMessages.value]
		})
		.catch((err) => {
			console.error('[room] 加载更早消息失败:', err)
			uni.showToast({ title: '加载失败，请重试', icon: 'none' })
		})
		.finally(() => {
			loadingOlder.value = false
		})
}

/** @description 打开二维码弹窗（点邀请占位）*/
const _openQr = () => {
	showQrPopup.value = true
}

/** @description 关闭二维码弹窗*/
const _closeQr = () => {
	showQrPopup.value = false
}

/** @description 复制房号*/
const _copyRoomCode = () => {
	uni.setClipboardData({ data: roomCode.value })
}

/** @description 成员头像点击：自己无响应，其他成员开支出弹窗*/
const _onMemberTap = (member: I_Member) => {
	if (member.openid === myOpenid.value) return
	transferAmount.value = ''
	transferTarget.value = member
	showTransfer.value = true
}

/** @description 取消支出（仅收起弹窗，保留目标数据供退场动画渲染）*/
const _cancelTransfer = () => {
	showTransfer.value = false
}

/** @description 确认支出：校验正整数 → 先收弹窗再后台调 transfer 落账。
 *   转账是低频小操作，不等云函数回包（用户感知就是点完即关）；失败仅弹 toast，账没记上可直接重试；
 *   成功后 payment 消息由 watch 推送进消息流，即到账反馈 */
const _confirmTransfer = () => {
	const amount = Number(transferAmount.value)
	if (!Number.isSafeInteger(amount) || amount < 1 || amount > 999999) {
		uni.showToast({ title: '请输入 1 到 999999 的整数', icon: 'none' })
		return
	}
	if (!transferTarget.value) return
	if (transferring.value) {
		// 上一笔还在途：明确提示而不是静默吞掉点击
		uni.showToast({ title: '上一笔转账处理中，请稍候', icon: 'none' })
		return
	}
	const target = transferTarget.value
	transferring.value = true
	showTransfer.value = false
	transferAmount.value = ''
	transfer({ roomId: roomId.value, toOpenid: target.openid, amount })
		.then(() => {
			_scrollToBottom()
		})
		.catch((err) => {
			// 开发期把真实错误亮出来，便于定位（不在场/已结束/权限等问题）
			console.error('[room] 转账失败:', err)
			uni.showToast({ title: `转账失败：${cloudErrMsg(err)}`, icon: 'none' })
		})
		.finally(() => {
			transferring.value = false
		})
}

/** @description 打开快捷语句面板*/
const _openSheet = () => {
	showSheet.value = true
}

/** @description 前往结算页（按钮文案展示为「对局详情」，实际仍进结算页：含实时结算方案、退出/解散入口）*/
const _goSettle = () => {
	uni.navigateTo({ url: `/pages/settlement/index?roomId=${roomId.value}&roomCode=${roomCode.value}` })
}

/** @description 关闭快捷语句面板*/
const _closeSheet = () => {
	showSheet.value = false
}

/** @description 发送快捷语句：写 messages 集合（预置语句无 UGC 风险），成功后本地插入 + watch 推送 _id 去重兜底*/
const _sendPhrase = (phrase: string) => {
	showSheet.value = false
	const doc = {
		roomId: roomId.value,
		type: 'chat',
		senderOpenid: myOpenid.value,
		senderNickname: myProfile.value?.nickname || '',
		senderAvatar: myProfile.value?.avatarUrl || '',
		content: phrase,
		createdAt: wx.cloud.database().serverDate()
	}
	wx.cloud
		.database()
		.collection('messages')
		.add({ data: doc })
		.then((res) => {
			if (!rawMessages.value.some((m) => m._id === res._id)) {
				rawMessages.value.push({ ...doc, _id: res._id })
				_scrollToBottom()
			}
		})
		.catch((err) => {
			console.error('[room] 发送快捷语句失败:', err)
			uni.showToast({ title: `发送失败：${cloudErrMsg(err)}`, icon: 'none' })
		})
}

/** @description 滚动消息流到底部（先清空再赋值触发 scroll-into-view）*/
const _scrollToBottom = () => {
	nextTick(() => {
		scrollInto.value = ''
		nextTick(() => {
			scrollInto.value = 'anchor-bottom'
		})
	})
}

/** @description 好友转发卡片：自定义封面图替代页面快照，path 指首页（统一走资料拦截 + joinRoom），房号随 query 传递*/
onShareAppMessage(() => {
	return {
		title: `来打牌，房号 ${roomCode.value}`,
		path: `/pages/home/index?roomCode=${roomCode.value}`,
		imageUrl: '/static/share-cover.jpg'
	}
})
</script>

<style lang="scss" scoped src="./style.scss"></style>
