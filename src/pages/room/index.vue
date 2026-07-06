<template>
	<SafePageWrapper>
		<view class="room-page">
			<!-- 顶部公告 -->
			<view class="notification-wrapper">本平台不涉及赌博和金钱，具体请查看使用手册。</view>
			<!-- 顶部头像 -->
			<view class="avatar-wrapper">
				<!-- 用户 -->
				<view class="item user">
					<view class="avatar">
						<image class="icon" mode="aspectFit" src="../../static/images/avatar0.png" />
					</view>
					<text class="nickname">张三</text>
				</view>
				<!-- 邀请 -->
				<view class="item invite">
					<view class="avatar">+</view>
					<text>邀请</text>
				</view>
			</view>
			<!-- 消息列表 -->
			<view class="message-wrapper">
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
		</view>
	</SafePageWrapper>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import SafePageWrapper from '@/components/SafePageWrapper.vue'
import { I_MessageItem } from './room'

defineOptions({
	name: 'Room'
})

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

const messageList = ref<I_MessageItem[]>(_mockMessageList)
</script>

<style lang="scss" scoped src="./style.scss"></style>
