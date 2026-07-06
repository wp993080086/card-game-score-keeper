<template>
	<SafePageWrapper>
		<view class="room-page">
			<!-- 顶部公告 -->
			<view class="notification-wrapper" @click="_openQrCode">本平台不涉及赌博和金钱，具体请查看使用手册。</view>
			<!-- 顶部头像 -->
			<scroll-view class="avatar-wrapper" scroll-x="true">
				<!-- 用户 -->
				<view class="item user">
					<view class="avatar">
						<image class="icon" mode="aspectFit" src="../../static/images/avatar0.png" />
					</view>
					<view class="nickname">
						<text class="text">法外狂徒</text>
					</view>
				</view>
				<!-- 邀请 -->
				<view class="item invite">
					<view class="avatar">+</view>
					<view class="nickname">
						<text class="text">邀请</text>
					</view>
				</view>
			</scroll-view>
			<!-- 消息列表 -->
			<scroll-view class="message-wrapper" scroll-y="true">
				<view class="message-list">
					<template v-for="item in messageList">
						<!-- 各种消息 -->
						<view :class="[['self', 'other'].includes(item.type) ? 'message-item' : '', item.type]">
							<!-- 非聊天内容 -->
							<template v-if="['system', 'payment', 'warning'].includes(item.type)">
								<text class="text">{{ item.content }}</text>
							</template>
							<!-- 自己 -->
							<template v-else-if="['self'].includes(item.type)">
								<view class="content">{{ item.content }}</view>
							</template>
							<!-- 其他 -->
							<template v-else>
								<view class="avatar">
									<image class="icon" mode="aspectFit" :src="item.avatar || '../../static/images/avatar0.png'" />
								</view>
								<view class="content">{{ item.content }}</view>
							</template>
						</view>
					</template>
				</view>
			</scroll-view>
		</view>
		<!-- 分享弹窗 -->
		<uni-popup ref="qrPopup" type="center">
			<view class="popup-wrapper">
				<!-- 关闭按钮 -->
				<view class="close-btn" @click="_closeQrCode">✕</view>
				<!-- 标题区域 -->
				<view class="title-area">
					<text class="desc">微信扫描二维码加入</text>
					<view class="room-id">
						<text class="label">房号：</text>
						<text class="value">mucj</text>
					</view>
					<text class="hint">邀请好友扫描以下二维码加入房间</text>
				</view>
				<!-- 二维码区域 -->
				<view class="qr-area">
					<view class="qr-border">
						<view class="qr-placeholder" />
					</view>
				</view>
				<!-- 提示文字 -->
				<view class="tip-text">
					<text>也可以通过</text>
					<text class="highlight">转发</text>
					<text>让好友加入</text>
				</view>
				<!-- 转发按钮 -->
				<view class="share-btn">转发给好友</view>
			</view>
		</uni-popup>
	</SafePageWrapper>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import SafePageWrapper from '@/components/SafePageWrapper.vue'
import { I_MessageItem } from './room'

defineOptions({
	name: 'Room'
})

// mock数据
const _mockMessageList: I_MessageItem[] = [
	{
		type: 'system',
		content: '玩家张三加入房间',
		sender: '',
		avatar: '',
		timestamp: Date.now()
	},
	{
		type: 'self',
		content: '大家快些准备',
		sender: '张三',
		avatar: '../../static/images/avatar0.png',
		timestamp: Date.now()
	},
	{
		type: 'other',
		content: '开始开始',
		sender: '李四',
		avatar: '../../static/images/avatar1.png',
		timestamp: Date.now()
	},
	{
		type: 'payment',
		content: '张三向李四支付 100',
		sender: '',
		avatar: '',
		timestamp: Date.now()
	},
	{
		type: 'warning',
		content: '警告：请遵守游戏规则',
		sender: '',
		avatar: '',
		timestamp: Date.now()
	}
]

/** @description 消息列表 */
const messageList = ref<I_MessageItem[]>(_mockMessageList)

/** @description 弹窗ref*/
const qrPopup = ref<TAny>(null)

/** @description 打开扫码分享弹窗*/
const _openQrCode = () => {
	qrPopup.value.open()
}

/** @description 关闭扫码分享弹窗*/
const _closeQrCode = () => {
	qrPopup.value.close()
}
</script>
<style lang="scss" scoped src="./style.scss"></style>
