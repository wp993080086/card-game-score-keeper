<template>
	<SafePageWrapper>
		<view class="home-page">
			<!-- 信息 -->
			<view class="info-content">
				<!-- 用户 -->
				<view class="user-section">
					<view class="avatar">
						<image class="icon" mode="aspectFit" src="../../static/images/avatar0.png" />
					</view>
					<text class="username" @click="() => {}">法外狂徒</text>
					<view class="summary">
						<text class="text">赢</text>
						<text class="green">&nbsp;3&nbsp;</text>
						<text class="text">次&nbsp;&nbsp;/&nbsp;&nbsp;输&nbsp;</text>
						<text class="warning">&nbsp;3&nbsp;</text>
						<text class="text">次&nbsp;&nbsp;/&nbsp;&nbsp;胜率&nbsp;</text>
						<text class="green">25%&nbsp;</text>
						<text class="text">&nbsp;&nbsp;战绩</text>
						<image class="icon" mode="aspectFit" src="../../static/icon/more.png" />
					</view>
				</view>
				<!-- 按钮 -->
				<view class="button-section">
					<button class="button full" @click="_createRoom">创建房间</button>
					<button class="button plain" @click="_joinRoom">扫码进房</button>
				</view>
			</view>
			<!-- 操作 -->
			<view class="operate-content">
				<button class="button" @click="_updateProfile">更新头像昵称</button>
				<button class="button" @click="_usageGuide">说明书</button>
				<button class="button" @click="_contactSupport">联系客服</button>
			</view>
		</view>
	</SafePageWrapper>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import SafePageWrapper from '@/components/SafePageWrapper.vue'

/** @description 创建房间*/
const _createRoom = () => {
	uni.navigateTo({ url: '/pages/room/index' })
}

/** @description 扫码进房*/
const _joinRoom = () => {
	uni.showToast({ title: '即将上线', icon: 'none' })
}

/** @description 更新头像昵称*/
const _updateProfile = () => {
	uni.showToast({ title: '即将上线', icon: 'none' })
}

/** @description 使用手册*/
const _usageGuide = () => {
	uni.navigateTo({ url: '/pages/manual/index' })
}

/** @description 联系客服*/
const _contactSupport = () => {
	uni.showToast({ title: '即将上线', icon: 'none' })
}
</script>

<style lang="scss" scoped src="./style.scss"></style>
