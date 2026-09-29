<template>
	<view class="room-page">
		<!-- 公告条 -->
		<view class="notice">
			<text class="ico">ⓘ</text>
			<text>本平台不涉及赌博和金钱，具体请查看使用手册</text>
		</view>

		<!-- 成员条 -->
		<view class="members-bar">
			<view v-for="member in memberList" :key="member.name" class="m-item" :class="{ owner: member.isOwner }" @click="_onMemberTap(member)">
				<view v-if="!member.isInvite" class="g-avatar" :style="avatarStyle(member.avatar)">
					{{ member.name.charAt(0) }}
				</view>
				<view v-else class="g-avatar invite">+</view>
				<view class="name">{{ member.isInvite ? '邀请' : member.name }}</view>
			</view>
		</view>

		<!-- 点击提示 -->
		<view class="tap-hint">
			<text class="ico">👆</text>
			<text>点击其他成员头像，向他支付积分</text>
		</view>

		<!-- 消息流 -->
		<scroll-view class="messages" scroll-y :scroll-into-view="scrollInto">
			<view v-for="(msg, index) in messageList" :key="index" class="msg-wrap">
				<!-- 系统消息 -->
				<view v-if="msg.type === 'system'" class="msg system">{{ msg.content }}</view>

				<!-- 转账动态 -->
				<view v-else-if="msg.type === 'pay'" class="msg system pay">
					<text>{{ msg.sender }}</text>
					<text class="arrow">→</text>
					<text>{{ msg.payTo }}</text>
					<text class="amount">{{ msg.amount }} 分</text>
				</view>

				<!-- 聊天气泡 -->
				<view v-else class="msg-row" :class="{ self: msg.isSelf }">
					<view class="g-avatar sm" :style="avatarStyle(msg.avatar)">{{ msg.sender.charAt(0) }}</view>
					<view class="bubble">{{ msg.content }}</view>
				</view>
			</view>
			<!-- 滚动锚点 -->
			<view id="anchor-bottom"></view>
		</scroll-view>

		<!-- 底部操作栏 -->
		<view class="actions-bar">
			<button class="btn primary block" @click="_openSheet">💬 快捷语句</button>
		</view>

		<!-- 房间二维码弹窗：对齐 design/qr-popup.html（常驻渲染 + .show 切换，进出场均有过渡） -->
		<view class="mask" :class="{ show: showQrPopup }" @touchmove.stop.prevent @click="_closeQr">
			<view class="popup" @click.stop>
				<view class="close" @click="_closeQr">✕</view>
				<view class="head">
					<view class="desc">微信扫描二维码加入</view>
					<view class="room-row">
						<text class="label">房号</text>
						<text class="code">{{ roomCode }}</text>
						<text class="copy" @click="_copyRoomCode">复制</text>
					</view>
					<view class="hint">邀请好友扫描以下二维码加入</view>
				</view>
				<view class="qr-area">
					<!-- 云开发接入后替换为 wxacode.getUnlimited 生成的真实小程序码 -->
					<view class="qr-placeholder">二维码</view>
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
					<text class="name">{{ transferTarget?.name }}</text>
				</view>
				<view class="input-wrap">
					<input v-model="transferAmount" class="amount-input" type="number" placeholder="请输入积分" @confirm="_confirmTransfer" />
					<text class="suffix">分</text>
				</view>
				<view class="dialog-btns">
					<button class="btn ghost" @click="_cancelTransfer">取消</button>
					<button class="btn primary" @click="_confirmTransfer">确定</button>
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
import { ref, nextTick } from 'vue'
import { onShareAppMessage } from '@dcloudio/uni-app'

defineOptions({
	name: 'Room'
})

/** @description 头像配色（背景 + 文字色）*/
interface I_Avatar {
	bg: string
	color: string
}

/** @description 房间成员*/
interface I_Member {
	name: string
	avatar: I_Avatar
	/** 是否房主 */
	isOwner: boolean
	/** 是否邀请占位 */
	isInvite: boolean
}

/** @description 消息类型：system=系统提示 / pay=转账动态 / chat=快捷语句聊天*/
type T_MsgType = 'system' | 'pay' | 'chat'

/** @description 房间内消息*/
interface I_Message {
	type: T_MsgType
	/** system/pay 为标题文案，chat 为气泡内容 */
	content: string
	/** 发送者昵称（pay 为支出方） */
	sender: string
	/** pay 的收入方 */
	payTo: string
	/** pay 的积分额 */
	amount: number
	isSelf: boolean
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

/** @description 房号（mock，云开发接入后由 createRoom 生成）*/
const roomCode = 'mucj'

/** @description 当前用户昵称（mock，用于区分自己/他人气泡）*/
const selfName = '法外狂徒'

/** @description 成员列表（mock，上限 4 人 + 邀请占位）*/
const memberList = ref<I_Member[]>([
	{ name: selfName, avatar: AVATAR_PRESET.default, isOwner: true, isInvite: false },
	{ name: '张三', avatar: AVATAR_PRESET.win, isOwner: false, isInvite: false },
	{ name: '李四', avatar: AVATAR_PRESET.lose, isOwner: false, isInvite: false },
	{ name: '王五', avatar: AVATAR_PRESET.green, isOwner: false, isInvite: false },
	{ name: '邀请', avatar: AVATAR_PRESET.default, isOwner: false, isInvite: true }
])

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

/** @description 消息列表（mock，云开发接入后 watch 最近 50 条 + 上拉分页）*/
const messageList = ref<I_Message[]>([
	{ type: 'system', content: '张三 加入房间', sender: '', payTo: '', amount: 0, isSelf: false, avatar: AVATAR_PRESET.default },
	{ type: 'chat', content: '快点吧，我等到花儿都谢了', sender: selfName, payTo: '', amount: 0, isSelf: true, avatar: AVATAR_PRESET.default },
	{ type: 'chat', content: '好嘞，发牌发牌', sender: '张三', payTo: '', amount: 0, isSelf: false, avatar: AVATAR_PRESET.win },
	{ type: 'pay', content: '', sender: selfName, payTo: '李四', amount: 50, isSelf: false, avatar: AVATAR_PRESET.default },
	{ type: 'chat', content: '这把稳了 🎉', sender: '王五', payTo: '', amount: 0, isSelf: false, avatar: AVATAR_PRESET.green }
])

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
	uni.setClipboardData({ data: roomCode })
}

/** @description 成员头像点击：邀请占位开二维码，其他成员开支出弹窗，自己无响应*/
const _onMemberTap = (member: I_Member) => {
	if (member.isInvite) {
		_openQr()
		return
	}
	if (member.name === selfName) return
	transferAmount.value = ''
	transferTarget.value = member
	showTransfer.value = true
}

/** @description 取消支出（仅收起弹窗，保留目标数据供退场动画渲染）*/
const _cancelTransfer = () => {
	showTransfer.value = false
}

/** @description 确认支出：校验正整数，落一条 pay 动态（云开发接入后改调 transfer 云函数）*/
const _confirmTransfer = () => {
	const amount = Number(transferAmount.value)
	if (!Number.isInteger(amount) || amount <= 0) {
		uni.showToast({ title: '请输入正整数积分', icon: 'none' })
		return
	}
	if (!transferTarget.value) return
	messageList.value.push({
		type: 'pay',
		content: '',
		sender: selfName,
		payTo: transferTarget.value.name,
		amount,
		isSelf: false,
		avatar: AVATAR_PRESET.default
	})
	showTransfer.value = false
	_scrollToBottom()
}

/** @description 打开快捷语句面板*/
const _openSheet = () => {
	showSheet.value = true
}

/** @description 关闭快捷语句面板*/
const _closeSheet = () => {
	showSheet.value = false
}

/** @description 发送快捷语句：追加自己的聊天气泡并收起面板（云开发接入后写 messages 集合）*/
const _sendPhrase = (phrase: string) => {
	messageList.value.push({
		type: 'chat',
		content: phrase,
		sender: selfName,
		payTo: '',
		amount: 0,
		isSelf: true,
		avatar: AVATAR_PRESET.default
	})
	showSheet.value = false
	_scrollToBottom()
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

/** @description 好友转发卡片：path 带房号（云开发接入后扫码 scene 同源）*/
onShareAppMessage(() => {
	return { title: `来打牌，房号 ${roomCode}`, path: `/pages/room/index?roomCode=${roomCode}` }
})
</script>

<style lang="scss" scoped src="./style.scss"></style>
