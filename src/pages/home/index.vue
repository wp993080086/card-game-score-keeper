<template>
	<SafePageWrapper>
		<view class="home-page">
			<view class="user-section">
				<view class="avatar"></view>
				<text class="username" @click="() => {}">法外狂徒</text>
				<view class="summary">
					<text class="text">赢</text>
					<text class="green">&nbsp;3&nbsp;</text>
					<text class="text">次&nbsp;&nbsp;/&nbsp;&nbsp;输&nbsp;</text>
					<text class="warning">&nbsp;3&nbsp;</text>
					<text class="text">次&nbsp;&nbsp;/&nbsp;&nbsp;胜率&nbsp;</text>
					<text class="green">25%&nbsp;</text>
					<text class="red">&nbsp;&nbsp;战绩 ></text>
				</view>
			</view>
		</view>
	</SafePageWrapper>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import SafePageWrapper from '@/components/SafePageWrapper.vue'

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

<style lang="scss" scoped src="./style.scss"></style>
