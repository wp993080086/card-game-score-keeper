<template>
	<view class="manual-page">
		<!-- 导航栏 -->
		<view class="nav-bar">
			<view class="nav-left" @click="goBack">
				<uni-icons type="left" size="20" color="#1a1a1a"></uni-icons>
			</view>
			<text class="nav-title">使用手册</text>
			<view class="nav-right">
				<uni-icons type="settings" size="20" color="#1a1a1a"></uni-icons>
			</view>
		</view>

		<scroll-view class="manual-content" scroll-y="true">
			<!-- 快速入门 -->
			<view class="manual-card">
				<text class="card-title">快速入门</text>

				<view class="step-item">
					<view class="step-dot" style="background: #a3d9a5">
						<text class="step-num">1</text>
					</view>
					<text class="step-text">点击「创建房间」创建新房间</text>
				</view>
				<view class="step-item">
					<view class="step-dot" style="background: #a3d9a5">
						<text class="step-num">2</text>
					</view>
					<text class="step-text">邀请好友加入房间</text>
				</view>
				<view class="step-item">
					<view class="step-dot" style="background: #a3d9a5">
						<text class="step-num">3</text>
					</view>
					<text class="step-text">开始游戏并记录输赢</text>
				</view>
			</view>

			<!-- 如何记账 -->
			<view class="manual-card">
				<view class="card-title-row">
					<uni-icons type="wallet" size="20" color="#ff7a45"></uni-icons>
					<text class="card-title">如何记账</text>
				</view>

				<view class="guide-item">
					<view class="guide-icon" style="background: #fff5f0">
						<uni-icons type="plus" size="16" color="#ff7a45"></uni-icons>
					</view>
					<view class="guide-texts">
						<text class="guide-label">赢钱记账</text>
						<text class="guide-desc">点击「+」按钮，输入金额</text>
					</view>
				</view>
				<view class="guide-item">
					<view class="guide-icon" style="background: #e8f5e9">
						<uni-icons type="minus" size="16" color="#4caf50"></uni-icons>
					</view>
					<view class="guide-texts">
						<text class="guide-label">输钱记账</text>
						<text class="guide-desc">点击「-」按钮，输入金额</text>
					</view>
				</view>
			</view>

			<!-- 房间管理 -->
			<view class="manual-card">
				<view class="card-title-row">
					<uni-icons type="person" size="20" color="#2196f3"></uni-icons>
					<text class="card-title">房间管理</text>
				</view>

				<view class="point-item">
					<view class="point-dot" style="background: #2196f3"></view>
					<text class="point-text">房主可以设置底注和封顶金额</text>
				</view>
				<view class="point-item">
					<view class="point-dot" style="background: #2196f3"></view>
					<text class="point-text">随时查看房间成员和战绩统计</text>
				</view>
				<view class="point-item">
					<view class="point-dot" style="background: #2196f3"></view>
					<text class="point-text">游戏结束后自动生成账单</text>
				</view>
			</view>

			<!-- 常见问题 -->
			<view class="manual-card">
				<view class="card-title-row">
					<uni-icons type="info" size="20" color="#ff9800"></uni-icons>
					<text class="card-title">常见问题</text>
				</view>

				<view class="faq-item">
					<text class="faq-q">Q: 如何邀请好友加入房间？</text>
					<text class="faq-a">A: 点击房间内的「+」按钮分享房间号</text>
				</view>
				<view class="faq-item">
					<text class="faq-q">Q: 记账错误可以修改吗？</text>
					<text class="faq-a">A: 可以，长按记录项即可编辑或删除</text>
				</view>
			</view>
		</scroll-view>
	</view>
</template>

<script setup lang="ts">
const goBack = () => uni.navigateBack()
</script>

<style lang="scss" scoped>
.manual-page {
	min-height: 100vh;
	background: #f8fafb;
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

.manual-content {
	padding: 16px;
}

.manual-card {
	background: #ffffff;
	border-radius: 12px;
	padding: 16px;
	margin-bottom: 16px;

	.card-title-row {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 12px;
	}

	.card-title {
		font-size: 16px;
		font-weight: 600;
		color: #333333;
		margin-bottom: 12px;
		display: block;
	}
}

.step-item {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-bottom: 12px;

	.step-dot {
		width: 20px;
		height: 20px;
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;

		.step-num {
			font-size: 12px;
			font-weight: 600;
			color: #ffffff;
		}
	}

	.step-text {
		font-size: 14px;
		color: #666666;
	}
}

.guide-item {
	display: flex;
	align-items: center;
	gap: 12px;
	margin-bottom: 12px;

	.guide-icon {
		width: 32px;
		height: 32px;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.guide-texts {
		display: flex;
		flex-direction: column;
		gap: 4px;

		.guide-label {
			font-size: 14px;
			font-weight: 500;
			color: #333333;
		}

		.guide-desc {
			font-size: 12px;
			color: #999999;
		}
	}
}

.point-item {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-bottom: 12px;

	.point-dot {
		width: 6px;
		height: 6px;
		border-radius: 3px;
		flex-shrink: 0;
	}

	.point-text {
		font-size: 14px;
		color: #666666;
	}
}

.faq-item {
	margin-bottom: 12px;

	.faq-q {
		font-size: 13px;
		font-weight: 500;
		color: #333333;
		display: block;
		margin-bottom: 4px;
	}

	.faq-a {
		font-size: 12px;
		color: #999999;
		display: block;
	}
}
</style>
