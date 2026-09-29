<template>
	<SafePageWrapper>
		<view class="home-page">
			<!-- 用户卡 -->
			<view class="user-card">
				<view class="g-avatar lg" :style="avatarStyle(userInfo.avatar)">法</view>
				<view class="info">
					<view class="nick">{{ userInfo.name }}</view>
					<view class="sub">{{ userInfo.stats }}</view>
				</view>
				<view class="edit" @click="_editProfile">✎</view>
			</view>

			<!-- 进行中的牌局（无牌局时不渲染） -->
			<view v-if="ongoingRoom" class="ongoing" @click="_goRoom">
				<view class="label">
					<view class="dot"></view>
					<text>进行中的牌局</text>
				</view>
				<view class="room-id">{{ ongoingRoom.code }}</view>
				<view class="members">
					<view v-for="member in ongoingRoom.members" :key="member.name" class="g-avatar sm" :style="avatarStyle(member.avatar)">
						{{ member.name.charAt(0) }}
					</view>
				</view>
				<view class="cta">
					<text>继续对局</text>
					<text class="arr">›</text>
				</view>
			</view>

			<!-- 主要操作 -->
			<view class="actions">
				<button class="btn primary" @click="_createRoom">+ 创建房间</button>
				<button class="btn outline" @click="_scanJoin">扫码进房</button>
			</view>

			<!-- 快捷入口 -->
			<view class="quick">
				<button class="item" @click="_openManual">
					<view class="ico">📖</view>
					<view class="label">使用手册</view>
				</button>
				<button class="item" open-type="contact" @click="_contactSupport">
					<view class="ico">💬</view>
					<view class="label">联系客服</view>
				</button>
			</view>
		</view>
	</SafePageWrapper>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import SafePageWrapper from '@/components/SafePageWrapper.vue'

defineOptions({
	name: 'Home'
})

/** @description 头像配色（背景 + 文字色）*/
interface I_Avatar {
	bg: string
	color: string
}

/** @description 进行中牌局的成员*/
interface I_Member {
	name: string
	avatar: I_Avatar
}

/** @description 进行中的牌局*/
interface I_OngoingRoom {
	code: string
	members: I_Member[]
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

/** @description 当前用户信息（mock，云开发接入后从 users 集合读取）*/
const userInfo = ref<{ name: string; stats: string; avatar: I_Avatar }>({
	name: '法外狂徒',
	stats: '累计 12 场 · 胜率 58%',
	avatar: AVATAR_PRESET.default
})

/** @description 进行中的牌局（mock，无牌局时置 null 即不渲染卡片）*/
const ongoingRoom = ref<I_OngoingRoom | null>({
	code: 'mucj',
	members: [
		{ name: '法外狂徒', avatar: AVATAR_PRESET.default },
		{ name: '张三', avatar: AVATAR_PRESET.win },
		{ name: '李四', avatar: AVATAR_PRESET.lose },
		{ name: '王五', avatar: AVATAR_PRESET.green }
	]
})

/** @description 编辑资料*/
const _editProfile = () => {
	uni.showToast({ title: '即将上线', icon: 'none' })
}

/** @description 回到房间继续对局*/
const _goRoom = () => {
	uni.navigateTo({ url: '/pages/room/index' })
}

/** @description 创建房间（云开发接入后先调 createRoom 再进房）*/
const _createRoom = () => {
	uni.navigateTo({ url: '/pages/room/index' })
}

/** @description 扫码进房（解析小程序码 scene 中的房号）*/
const _scanJoin = () => {
	uni.scanCode({
		success: (res) => {
			uni.showToast({ title: `房号 ${res.result}`, icon: 'none' })
		},
		fail: () => {
			uni.showToast({ title: '已取消扫码', icon: 'none' })
		}
	})
}

/** @description 打开使用手册*/
const _openManual = () => {
	uni.navigateTo({ url: '/pages/manual/index' })
}

/** @description 联系客服（小程序内走 open-type=contact，H5 降级提示）*/
const _contactSupport = () => {
	// #ifndef MP-WEIXIN
	uni.showToast({ title: '即将上线', icon: 'none' })
	// #endif
}
</script>

<style lang="scss" scoped src="./style.scss"></style>
