<template>
	<view class="room-page">
		<!-- 导航栏 -->
		<view class="nav-bar">
			<view class="nav-left" @click="goBack">
				<uni-icons type="left" size="20" color="#1a1a1a"></uni-icons>
			</view>
			<text class="nav-title">房间聊天</text>
			<view class="nav-right"></view>
		</view>

		<!-- 成员头像区 -->
		<view class="members-section">
			<!-- 房主 -->
			<view class="member-item">
				<view class="member-avatar host-avatar">
					<uni-icons type="crown" size="16" color="#ffffff"></uni-icons>
				</view>
				<text class="member-name">房主</text>
			</view>
			<!-- 队友 -->
			<view v-for="(member, index) in members" :key="index" class="member-item">
				<view class="member-avatar" :style="{ background: member.color }">
					<uni-icons type="person" size="18" color="#ffffff"></uni-icons>
				</view>
				<text class="member-name">{{ member.name }}</text>
			</view>
			<!-- 邀请按钮 -->
			<view class="member-item" @click="handleInvite">
				<view class="member-avatar invite-avatar">
					<uni-icons type="plus" size="20" color="#999999"></uni-icons>
				</view>
				<text class="member-name invite-text">邀请</text>
			</view>
		</view>

		<!-- 聊天区域 -->
		<scroll-view class="chat-scroll" scroll-y="true">
			<!-- 置顶通知 -->
			<view class="pinned-notice">
				<uni-icons type="pin" size="14" color="#ff9800"></uni-icons>
				<text class="notice-text">本局底注 10 元，封顶 200 元</text>
			</view>

			<view v-for="(msg, idx) in messages" :key="idx" class="msg-row">
				<!-- 系统消息 -->
				<view v-if="msg.type === 'system'" class="msg-system">
					<view class="system-tag">{{ msg.content }}</view>
				</view>

				<!-- 他人消息 -->
				<view v-else-if="msg.side === 'left'" class="msg-left">
					<view class="msg-avatar" :style="{ background: msg.color }">
						<uni-icons type="person" size="18" color="#ffffff"></uni-icons>
					</view>
					<view class="msg-bubble left-bubble">{{ msg.content }}</view>
				</view>

				<!-- 自己消息 -->
				<view v-else class="msg-right">
					<view class="msg-bubble right-bubble">{{ msg.content }}</view>
				</view>
			</view>
		</scroll-view>

		<!-- 底部输入区 -->
		<view class="input-bar">
			<view class="input-wrapper">
				<input v-model="inputText" class="chat-input" placeholder="输入消息..." @confirm="sendMessage" />
				<view class="send-btn" @click="sendMessage">发送</view>
			</view>
		</view>

		<!-- 底部tab -->
		<view class="tab-bar">
			<view class="tab-item" @click="switchTab('expense')">
				<uni-icons type="wallet" size="20" color="#666666"></uni-icons>
				<text class="tab-text">支出</text>
			</view>
			<view class="tab-item" @click="switchTab('service')">
				<uni-icons type="headphones" size="20" color="#666666"></uni-icons>
				<text class="tab-text">客服</text>
			</view>
			<view class="tab-item" @click="switchTab('mine')">
				<view class="tab-icon-wrapper tab-active-icon">
					<uni-icons type="person" size="20" color="#ff7a45"></uni-icons>
				</view>
				<text class="tab-text" style="color: #ff7a45">我的</text>
			</view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Message {
	type: 'system' | 'normal'
	side?: 'left' | 'right'
	content: string
	color?: string
}

interface Member {
	name: string
	color: string
}

const members = ref<Member[]>([
	{ name: '张三', color: '#4caf50' },
	{ name: '李四', color: '#2196f3' },
	{ name: '王五', color: '#9c27b0' }
])

const messages = ref<Message[]>([
	{ type: 'system', content: '张三 加入了房间' },
	{ type: 'normal', side: 'left', content: '大家好，准备好了开始吧！', color: '#4caf50' },
	{ type: 'normal', side: 'right', content: '好的，开始吧！' },
	{ type: 'normal', side: 'left', content: '这把运气不错', color: '#2196f3' },
	{ type: 'normal', side: 'right', content: '哈哈，我也觉得' },
	{ type: 'system', content: '游戏正式开始' }
])

const inputText = ref('')

const goBack = () => uni.navigateBack()
const handleInvite = () => uni.showToast({ title: '邀请功能即将上线', icon: 'none' })

const sendMessage = () => {
	const text = inputText.value.trim()
	if (!text) return
	messages.value.push({ type: 'normal', side: 'right', content: text })
	inputText.value = ''
	setTimeout(() => {
		uni.pageScrollTo({ scrollTop: 99999 })
	}, 50)
}

const switchTab = (tab: string) => {
	if (tab === 'expense') uni.showToast({ title: '支出功能即将上线', icon: 'none' })
}
</script>

<style lang="scss" scoped>
.room-page {
	display: flex;
	flex-direction: column;
	height: 100vh;
	background: #f8fafb;
	padding-bottom: env(safe-area-inset-bottom);
}

.nav-bar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	height: 56px;
	padding: 0 16px;
	background: #ffffff;

	.nav-left {
		width: 40px;
	}
	.nav-title {
		font-size: 18px;
		font-weight: 600;
		color: #1a1a1a;
	}
	.nav-right {
		width: 40px;
	}
}

/* 成员头像区 */
.members-section {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 16px;
	padding: 16px 12px;
	background: #ffffff;

	.member-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;

		.member-avatar {
			width: 48px;
			height: 48px;
			border-radius: 50%;
			display: flex;
			align-items: center;
			justify-content: center;

			&.host-avatar {
				width: 56px;
				height: 56px;
				background: #ff7a45;
			}

			&.invite-avatar {
				background: transparent;
				border: 2px dashed #cccccc;
			}
		}

		.member-name {
			font-size: 11px;
			color: #666666;

			&.invite-text {
				color: #999999;
			}
		}

		&:first-child .member-name {
			color: #ff7a45;
			font-weight: 500;
		}
	}
}

/* 聊天区域 */
.chat-scroll {
	flex: 1;
	padding: 12px;
	background: #f5f5f5;
}

.pinned-notice {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 6px;
	padding: 8px 16px;
	margin-bottom: 12px;
	background: #fff8e1;
	border: 1px solid #ffe082;
	border-radius: 18px;

	.notice-text {
		font-size: 13px;
		font-weight: 500;
		color: #f57c00;
	}
}

.msg-row {
	margin-bottom: 12px;
}

.msg-system {
	display: flex;
	justify-content: center;

	.system-tag {
		padding: 4px 10px;
		background: #9e9e9e;
		border-radius: 10px;
		font-size: 11px;
		color: #ffffff;
	}
}

.msg-left {
	display: flex;
	align-items: flex-start;
	gap: 8px;

	.msg-avatar {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.msg-bubble {
		padding: 10px 14px;
		background: #ffffff;
		border: 1px solid #e8e8e8;
		border-radius: 4px 16px 16px 16px;
		font-size: 14px;
		color: #333333;
		max-width: 70%;
		word-break: break-all;
	}
}

.msg-right {
	display: flex;
	justify-content: flex-end;

	.msg-bubble {
		padding: 10px 14px;
		background: #ff7a45;
		border-radius: 16px 4px 16px 16px;
		font-size: 14px;
		color: #ffffff;
		max-width: 70%;
		word-break: break-all;
	}
}

/* 输入区 */
.input-bar {
	padding: 12px;
	background: #ffffff;
	border-top: 1px solid #f0f0f0;

	.input-wrapper {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.chat-input {
		flex: 1;
		height: 40px;
		padding: 0 12px;
		background: #f5f5f5;
		border-radius: 20px;
		font-size: 14px;
		color: #333333;
	}

	.send-btn {
		padding: 8px 16px;
		background: #ff7a45;
		border-radius: 20px;
		font-size: 14px;
		font-weight: 500;
		color: #ffffff;

		&:active {
			opacity: 0.8;
		}
	}
}

/* 底部tab */
.tab-bar {
	display: flex;
	align-items: center;
	justify-content: space-around;
	height: 56px;
	background: #ffffff;
	border-top: 1px solid #f0f0f0;
	padding-bottom: env(safe-area-inset-bottom);

	.tab-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;

		.tab-text {
			font-size: 10px;
			color: #666666;
		}

		.tab-active-icon {
			background: #fff5f0;
			border-radius: 8px;
			padding: 4px 12px;
		}
	}
}
</style>
