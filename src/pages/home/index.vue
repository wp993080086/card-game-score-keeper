<template>
	<SafePageWrapper>
		<view class="home-page">
			<!-- 用户卡（整卡可点：打开完善资料弹窗） -->
			<view class="user-card" @click="_openProfile">
				<image v-if="userInfo?.avatarUrl" class="g-avatar lg avatar-img" :src="userInfo.avatarUrl" mode="aspectFill" />
				<view v-else class="g-avatar lg" :style="avatarStyle(AVATAR_PRESET.default)">
					{{ avatarText }}
				</view>
				<view class="info">
					<view class="nick">{{ displayNickname }}</view>
				</view>
				<view class="edit">✎</view>
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

			<!-- 完善资料弹窗（首次无资料自动弹出，点编辑笔再次打开；一次填完头像+昵称） -->
			<view class="profile-mask" :class="{ show: showProfile }" @touchmove.stop.prevent @click="_closeProfile">
				<view class="profile-dialog" @click.stop>
					<view class="close" @click="_closeProfile">✕</view>
					<view class="title">完善资料</view>
					<view class="desc">头像与昵称将展示给房间内的其他成员</view>
					<!-- 头像：微信官方 chooseAvatar 能力，保存时才上传云存储 -->
					<button class="avatar-picker" open-type="chooseAvatar" @chooseavatar="_onChooseAvatar">
						<image v-if="profileDraft.avatar" class="ph" :src="profileDraft.avatar" mode="aspectFill" />
						<view v-else class="ph">📷</view>
						<view class="badge">✎</view>
					</button>
					<!-- 昵称：微信官方 nickname 键盘，可快捷填入微信昵称 -->
					<view class="field">
						<input type="nickname" placeholder="请输入昵称" maxlength="20" :value="profileDraft.nickname" @input="_onNickInput" @blur="_onNickBlur" />
					</view>
					<button class="btn primary save" :disabled="saving" @click="_saveProfile">
						{{ saving ? '保存中…' : '保存' }}
					</button>
				</view>
			</view>
		</view>
	</SafePageWrapper>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import SafePageWrapper from '@/components/SafePageWrapper.vue'
import { fetchUserProfile, saveUserProfile, uploadAvatar } from '@/apis/user'
import type { I_UserProfile } from '@/apis/user'

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

/** @description 当前用户资料（users 集合，用户主动完善过才有记录；null 表示未完善）*/
const userInfo = ref<I_UserProfile | null>(null)

/** @description 默认昵称（时间戳 36 进制尾部 4 位：唯一且简短；进页面时固定一次，完善资料后即不再展示）*/
const defaultNickname = `牌友${Date.now().toString(36).slice(-4)}`

/** @description 展示昵称：已完善显示真实昵称，未完善显示默认昵称*/
const displayNickname = computed(() => userInfo.value?.nickname || defaultNickname)

/** @description 头像兜底文字：已完善取昵称首字，未完善固定「牌」*/
const avatarText = computed(() => userInfo.value?.nickname?.charAt(0) || '牌')

/** @description 进行中的牌局（mock，第 4 步接入 createRoom 后取真实数据）*/
const ongoingRoom = ref<I_OngoingRoom | null>({
	code: 'mucj',
	members: [
		{ name: '法外狂徒', avatar: AVATAR_PRESET.default },
		{ name: '张三', avatar: AVATAR_PRESET.win },
		{ name: '李四', avatar: AVATAR_PRESET.lose },
		{ name: '王五', avatar: AVATAR_PRESET.green }
	]
})

/** @description 资料弹窗显隐*/
const showProfile = ref(false)

/** @description 弹窗草稿（头像临时路径 / fileID + 昵称，保存时才上传）*/
const profileDraft = ref<{ avatar: string; nickname: string }>({ avatar: '', nickname: '' })

/** @description 保存中（防重复提交）*/
const saving = ref(false)

/** @description users 集合当前记录 id（有则更新、无则新增）*/
let userDocId = ''

/** @description 提取云开发错误的关键信息用于提示*/
const _errMsg = (err: TAny): string => {
	return err?.errMsg || err?.errMessage || err?.message || '未知错误'
}

/** @description 资料完善后待续跑的动作（建房/进房）*/
let pendingAction: (() => void) | null = null

/** @description 进房类操作前确保资料已完善：未完善先弹窗引导，保存成功后自动继续*/
const _ensureProfileThen = (action: () => void) => {
	if (userInfo.value) {
		action()
		return
	}
	pendingAction = action
	_openProfile()
}

/** @description 进入页面拉取资料（不自动弹窗；未完善时用户卡展示默认资料，进房前才引导完善）*/
onShow(() => {
	fetchUserProfile()
		.then((profile) => {
			userDocId = profile?._id || ''
			userInfo.value = profile
		})
		.catch((err) => {
			// 拉取失败不阻断浏览；错误打日志便于排查
			console.error('[home] 拉取用户资料失败:', _errMsg(err))
		})
})

/** @description 打开资料弹窗并带入当前资料*/
const _openProfile = () => {
	profileDraft.value = {
		avatar: userInfo.value?.avatarUrl || '',
		nickname: userInfo.value?.nickname || ''
	}
	showProfile.value = true
}

/** @description 关闭资料弹窗（点遮罩）*/
const _closeProfile = () => {
	if (saving.value) return
	showProfile.value = false
}

/** @description 选择微信头像（open-type=chooseAvatar 回调，暂存临时路径）*/
const _onChooseAvatar = (e: TAny) => {
	profileDraft.value.avatar = e.detail.avatarUrl
}

/** @description 昵称输入*/
const _onNickInput = (e: TAny) => {
	profileDraft.value.nickname = e.detail.value
}

/** @description 昵称失焦兜底（type=nickname 快捷填入的最终值）*/
const _onNickBlur = (e: TAny) => {
	profileDraft.value.nickname = e.detail.value
}

/** @description 保存资料：换了头像先上传云存储 → 写库 → 更新展示*/
const _saveProfile = () => {
	const nickname = profileDraft.value.nickname.trim()
	if (!nickname) {
		uni.showToast({ title: '请输入昵称', icon: 'none' })
		return
	}
	if (saving.value) return
	saving.value = true
	// 头像未更换则沿用旧 fileID，不重复上传
	const oldAvatar = userInfo.value?.avatarUrl || ''
	const upload = profileDraft.value.avatar
		? profileDraft.value.avatar === oldAvatar
			? Promise.resolve(oldAvatar)
			: uploadAvatar(profileDraft.value.avatar)
		: Promise.resolve('')
	upload
		.then((avatarUrl) => saveUserProfile({ nickname, avatarUrl }, userDocId || undefined))
		.then((docId) => {
			userDocId = docId
			// avatarUrl 为上传后的 fileID（或沿用旧值/空串），临时路径不能长期展示
			userInfo.value = { _id: docId, nickname, avatarUrl: profileDraft.value.avatar ? profileDraft.value.avatar : '' }
			showProfile.value = false
			uni.showToast({ title: '已保存', icon: 'success' })
			// 若是进房前补完善，保存成功后自动继续刚才的操作
			if (pendingAction) {
				const act = pendingAction
				pendingAction = null
				act()
			}
		})
		.catch((err) => {
			// 开发期把真实错误亮出来，便于定位（权限/上传/环境等问题）
			console.error('[home] 保存资料失败:', err)
			uni.showToast({ title: `保存失败：${_errMsg(err)}`, icon: 'none' })
		})
		.finally(() => {
			saving.value = false
		})
}

/** @description 回到房间继续对局*/
const _goRoom = () => {
	uni.navigateTo({ url: '/pages/room/index' })
}

/** @description 创建房间（第 4 步接入 createRoom 云函数后先建房再进房）；未完善资料先引导完善*/
const _createRoom = () => {
	_ensureProfileThen(() => {
		uni.navigateTo({ url: '/pages/room/index' })
	})
}

/** @description 扫码进房（解析小程序码 scene 中的房号）；未完善资料先引导完善*/
const _scanJoin = () => {
	uni.scanCode({
		success: (res) => {
			const roomCode = res.result
			_ensureProfileThen(() => {
				// 第 4 步接入后携带 roomCode 进房
				uni.showToast({ title: `房号 ${roomCode}`, icon: 'none' })
			})
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

/** @description 联系客服（小程序内走 open-type=contact）*/
const _contactSupport = () => {}
</script>

<style lang="scss" scoped src="./style.scss"></style>
