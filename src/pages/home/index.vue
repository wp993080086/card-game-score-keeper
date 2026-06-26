<template>
	<view class="home-page">
		<!-- 导航栏 -->
		<view class="nav-bar">
			<text class="nav-title">打牌记账</text>
			<uni-icons type="settings" size="20" color="#1a1a1a" class="nav-settings"></uni-icons>
		</view>

		<!-- 用户信息 -->
		<view class="user-section" @click="handleUserProfile">
			<image class="user-avatar" src="/static/placeholder/avatar.png" mode="aspectFill"></image>
			<view class="user-info">
				<text class="user-name">我是一只鱼</text>
				<text class="user-subtitle">点击查看个人主页</text>
			</view>
			<uni-icons type="right" size="16" color="#cccccc"></uni-icons>
		</view>

		<!-- 快捷功能 4x1 -->
		<view class="quick-functions">
			<view class="func-item" @click="handleCreateRoom">
				<view class="func-icon" style="background: #ff7a45">
					<uni-icons type="plusempty" size="24" color="#ffffff"></uni-icons>
				</view>
				<text class="func-text">创建房间</text>
			</view>
			<view class="func-item" @click="handleJoinRoom">
				<view class="func-icon" style="background: #4caf50">
					<uni-icons type="search" size="24" color="#ffffff"></uni-icons>
				</view>
				<text class="func-text">加入房间</text>
			</view>
			<view class="func-item" @click="handleScoreKeeper">
				<view class="func-icon" style="background: #2196f3">
					<uni-icons type="calculator" size="24" color="#ffffff"></uni-icons>
				</view>
				<text class="func-text">记牌器</text>
			</view>
			<view class="func-item" @click="handleRecords">
				<view class="func-icon" style="background: #9c27b0">
					<uni-icons type="bars" size="24" color="#ffffff"></uni-icons>
				</view>
				<text class="func-text">战绩</text>
			</view>
		</view>

		<!-- 近期战绩 -->
		<view class="section-header">
			<text class="section-title">近期战绩</text>
			<view class="section-more" @click="handleViewAll">
				<text class="more-text">查看全部</text>
				<uni-icons type="arrowright" size="14" color="#999999"></uni-icons>
			</view>
		</view>

		<view class="records-list">
			<view v-for="(item, index) in records" :key="index" class="record-item">
				<text class="record-rank">{{ padRank(index + 1) }}</text>
				<view class="record-avatar" :style="{ background: item.avatarBg }">
					<text class="record-avatar-text">{{ item.avatarText }}</text>
				</view>
				<view class="record-info">
					<text class="record-name">{{ item.name }}</text>
					<text class="record-date">{{ item.date }}</text>
				</view>
				<text class="record-amount" :class="item.result === 'win' ? 'amount-win' : 'amount-lose'">
					{{ item.result === 'win' ? '+' : '-' }}{{ item.amount }}
				</text>
			</view>
		</view>

		<!-- 底部tab -->
		<view class="tab-bar">
			<view class="tab-item" @click="switchTab('')">
				<uni-icons type="wallet" size="20" color="#666666"></uni-icons>
				<text class="tab-text">支出</text>
			</view>
			<view class="tab-item" @click="switchTab('')">
				<uni-icons type="headphones" size="20" color="#666666"></uni-icons>
				<text class="tab-text">客服</text>
			</view>
			<view class="tab-item tab-active" @click="switchTab('home')">
				<uni-icons type="home" size="20" color="#ff7a45"></uni-icons>
				<text class="tab-text" style="color: #ff7a45">首页</text>
			</view>
			<view class="tab-item" @click="switchTab('room')">
				<uni-icons type="chat" size="20" color="#666666"></uni-icons>
				<text class="tab-text">消息</text>
			</view>
			<view class="tab-item" @click="switchTab('mine')">
				<uni-icons type="person" size="20" color="#666666"></uni-icons>
				<text class="tab-text">我的</text>
			</view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Record {
	name: string
	date: string
	amount: string
	result: 'win' | 'lose'
	avatarBg: string
	avatarText: string
}

const records = ref<Record[]>([
	{ name: '欢乐斗地主', date: '03-15 14:30', amount: '200', result: 'win', avatarBg: '#ffe0e0', avatarText: '欢' },
	{ name: '德州扑克', date: '03-14 20:00', amount: '150', result: 'lose', avatarBg: '#e0f0ff', avatarText: '德' },
	{ name: '跑得快', date: '03-12 21:30', amount: '80', result: 'lose', avatarBg: '#e8ffe8', avatarText: '跑' }
])

const padRank = (n: number) => (n < 10 ? '0' + n : String(n))

const handleUserProfile = () => uni.showToast({ title: '个人主页功能即将上线', icon: 'none' })
const handleCreateRoom = () => uni.navigateTo({ url: '/pages/room/index' })
const handleJoinRoom = () => uni.showToast({ title: '输入房间码加入', icon: 'none' })
const handleScoreKeeper = () => uni.showToast({ title: '记牌器功能即将上线', icon: 'none' })
const handleRecords = () => uni.showToast({ title: '战绩功能即将上线', icon: 'none' })
const handleViewAll = () => uni.showToast({ title: '查看全部战绩', icon: 'none' })
const switchTab = (tab: string) => {
	if (tab === 'room') uni.navigateTo({ url: '/pages/room/index' })
}
</script>

<style lang="scss" scoped>
.home-page {
	min-height: 100vh;
	background: #f8fafb;
	padding-bottom: env(safe-area-inset-bottom);
}

.nav-bar {
	display: flex;
	align-items: center;
	justify-content: center;
	height: 56px;
	background: #ffffff;
	position: relative;

	.nav-title {
		font-size: 18px;
		font-weight: 600;
		color: #1a1a1a;
	}

	.nav-settings {
		position: absolute;
		right: 16px;
		top: 18px;
	}
}

.user-section {
	display: flex;
	align-items: center;
	gap: 12px;
	margin: 16px;
	padding: 16px;
	background: #ffffff;
	border-radius: 12px;

	.user-avatar {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: #f0f0f0;
	}

	.user-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 4px;

		.user-name {
			font-size: 16px;
			font-weight: 600;
			color: #1a1a1a;
		}
		.user-subtitle {
			font-size: 12px;
			color: #999999;
		}
	}
}

.quick-functions {
	display: flex;
	justify-content: space-around;
	padding: 20px 16px;
	margin: 0 16px 20px;
	background: #ffffff;
	border-radius: 12px;

	.func-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;

		.func-icon {
			width: 44px;
			height: 44px;
			border-radius: 12px;
			display: flex;
			align-items: center;
			justify-content: center;
		}
		.func-text {
			font-size: 12px;
			font-weight: 500;
			color: #333333;
		}
	}
}

.section-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0 16px 12px;

	.section-title {
		font-size: 18px;
		font-weight: 600;
		color: #1a1a1a;
	}
	.section-more {
		display: flex;
		align-items: center;
		gap: 2px;
		.more-text {
			font-size: 13px;
			color: #999999;
		}
	}
}

.records-list {
	margin: 0 16px;
	background: #ffffff;
	border-radius: 12px;

	.record-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px 16px;

		& + .record-item {
			border-top: 1px solid #f5f5f5;
		}

		.record-rank {
			font-size: 12px;
			font-weight: 600;
			color: #999999;
			width: 20px;
		}
		.record-avatar {
			width: 36px;
			height: 36px;
			border-radius: 50%;
			display: flex;
			align-items: center;
			justify-content: center;
			.record-avatar-text {
				font-size: 14px;
				font-weight: 600;
				color: #333333;
			}
		}
		.record-info {
			flex: 1;
			display: flex;
			flex-direction: column;
			gap: 2px;
			.record-name {
				font-size: 14px;
				font-weight: 500;
				color: #333333;
			}
			.record-date {
				font-size: 12px;
				color: #999999;
			}
		}
		.record-amount {
			font-size: 16px;
			font-weight: 600;
			&.amount-win {
				color: #ff4d4f;
			}
			&.amount-lose {
				color: #4caf50;
			}
		}
	}
}

/* 底部tab */
.tab-bar {
	position: fixed;
	bottom: 0;
	left: 0;
	right: 0;
	height: 64px;
	background: #ffffff;
	border-top: 1px solid #f0f0f0;
	display: flex;
	align-items: center;
	justify-content: space-around;
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

		&.tab-active {
			.tab-text {
				color: #ff7a45;
			}
		}
	}
}
</style>
