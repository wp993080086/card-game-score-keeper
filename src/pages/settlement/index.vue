<template>
	<view class="settlement-page">
		<!-- 导航栏 -->
		<view class="nav-bar">
			<view class="nav-left"></view>
			<text class="nav-title">结算</text>
			<view class="nav-right"></view>
		</view>

		<!-- MVP 区域 -->
		<view class="mvp-section">
			<view class="mvp-avatar-wrapper">
				<view class="mvp-crown">
					<uni-icons type="star" size="20" color="#FFD700"></uni-icons>
				</view>
				<view class="mvp-avatar">
					<text class="mvp-avatar-text">张</text>
				</view>
				<view class="mvp-badge">MVP</view>
			</view>
			<text class="mvp-name">张三</text>
			<view class="mvp-earnings">
				<text class="earnings-label">收益</text>
				<text class="earnings-amount">+¥888</text>
			</view>
		</view>

		<!-- 结算方案 -->
		<view class="settlement-plans">
			<view v-for="(plan, index) in plans" :key="index" class="plan-item">
				<text class="plan-from">{{ plan.from }}</text>
				<text class="plan-arrow">→</text>
				<text class="plan-to">{{ plan.to }}</text>
				<text class="plan-amount">¥{{ plan.amount }}</text>
			</view>
		</view>

		<!-- 功能区 -->
		<view class="action-grid">
			<view class="action-btn" @click="handleRanking">
				<view class="action-icon" style="background: #fff3e8">
					<uni-icons type="bars" size="24" color="#ff7a45"></uni-icons>
				</view>
				<text class="action-label">排行榜</text>
			</view>
			<view class="action-btn" @click="handleTransactions">
				<view class="action-icon" style="background: #e8f5e9">
					<uni-icons type="list" size="24" color="#4caf50"></uni-icons>
				</view>
				<text class="action-label">流水明细</text>
			</view>
			<view class="action-btn" @click="handleManual">
				<view class="action-icon" style="background: #e3f2fd">
					<uni-icons type="help" size="24" color="#2196f3"></uni-icons>
				</view>
				<text class="action-label">使用手册</text>
			</view>
			<view class="action-btn" @click="handleExitRoom">
				<view class="action-icon" style="background: #fce4ec">
					<uni-icons type="close" size="24" color="#f44336"></uni-icons>
				</view>
				<text class="action-label" style="color: #f44336">退出房间</text>
			</view>
		</view>
	</view>
</template>

<script setup lang="ts">
interface Plan {
	from: string
	to: string
	amount: number
}

const plans: Plan[] = [
	{ from: '张三', to: '李四', amount: 200 },
	{ from: '张三', to: '王五', amount: 150 },
	{ from: '王五', to: '李四', amount: 100 }
]

const handleRanking = () => {
	uni.showToast({ title: '排行榜功能即将上线', icon: 'none' })
}

const handleTransactions = () => {
	uni.showToast({ title: '流水明细功能即将上线', icon: 'none' })
}

const handleManual = () => {
	uni.navigateTo({ url: '/pages/manual/index' })
}

const handleExitRoom = () => {
	uni.showModal({
		title: '提示',
		content: '确定退出房间吗？',
		success: (res) => {
			if (res.confirm) {
				uni.showToast({ title: '已退出房间', icon: 'success' })
			}
		}
	})
}
</script>

<style lang="scss" scoped>
.settlement-page {
	min-height: 100vh;
	background-color: #f8fafb;
	padding-bottom: env(safe-area-inset-bottom);
}

// 导航栏
.nav-bar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	height: 44px;
	padding: 0 16px;
	background: #fff;
	padding-top: env(safe-area-inset-top);
	height: calc(44px + env(safe-area-inset-top));

	.nav-left {
		width: 80px;
	}

	.nav-title {
		font-size: 18px;
		font-weight: 600;
		color: #1a1a1a;
	}

	.nav-right {
		width: 80px;
	}
}

// MVP 区域
.mvp-section {
	background: linear-gradient(135deg, #fff8e1, #fff3e0);
	margin: 12px 16px;
	border-radius: 16px;
	padding: 24px 20px;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8px;

	.mvp-avatar-wrapper {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;

		.mvp-crown {
			position: absolute;
			top: -14px;
			z-index: 1;
		}

		.mvp-avatar {
			width: 72px;
			height: 72px;
			border-radius: 36px;
			border: 3px solid #ffd700;
			background: #ffcc02;
			display: flex;
			align-items: center;
			justify-content: center;

			.mvp-avatar-text {
				font-size: 28px;
				font-weight: 700;
				color: #fff;
			}
		}

		.mvp-badge {
			position: absolute;
			bottom: -8px;
			background: #ff5722;
			color: #fff;
			font-size: 11px;
			font-weight: 600;
			padding: 2px 8px;
			border-radius: 8px;
		}
	}

	.mvp-name {
		font-size: 16px;
		font-weight: 600;
		color: #333;
		margin-top: 4px;
	}

	.mvp-earnings {
		display: flex;
		align-items: center;
		gap: 6px;

		.earnings-label {
			font-size: 14px;
			color: #666;
		}

		.earnings-amount {
			font-size: 20px;
			font-weight: 700;
			color: #4caf50;
		}
	}
}

// 结算方案
.settlement-plans {
	background: #fff;
	margin: 0 16px;
	border-radius: 12px;
	padding: 4px 0;

	.plan-item {
		display: flex;
		align-items: center;
		padding: 14px 20px;
		border-bottom: 1px solid #f5f5f5;
		gap: 8px;

		&:last-child {
			border-bottom: none;
		}

		.plan-from {
			font-size: 15px;
			font-weight: 500;
			color: #333;
		}

		.plan-arrow {
			font-size: 16px;
			color: #999;
		}

		.plan-to {
			font-size: 15px;
			font-weight: 500;
			color: #333;
		}

		.plan-amount {
			margin-left: auto;
			font-size: 16px;
			font-weight: 600;
			color: #f44336;
		}
	}
}

// 功能区
.action-grid {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 12px;
	padding: 0 16px;
	margin-top: 16px;

	.action-btn {
		background: #fff;
		border-radius: 12px;
		padding: 20px 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;

		&:active {
			opacity: 0.7;
		}

		.action-icon {
			width: 48px;
			height: 48px;
			border-radius: 12px;
			display: flex;
			align-items: center;
			justify-content: center;
		}

		.action-label {
			font-size: 14px;
			font-weight: 500;
			color: #333;
		}
	}
}
</style>
