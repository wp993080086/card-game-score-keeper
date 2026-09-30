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
					<view v-for="member in ongoingRoom.members" :key="member.openid" class="g-avatar sm">
						<image v-if="member.avatarUrl" class="avatar-img" :src="member.avatarUrl" mode="aspectFill" />
						<view v-else :style="avatarStyle(hashColor(member.nickname))">{{ member.nickname.charAt(0) }}</view>
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
import { onLoad, onShow } from '@dcloudio/uni-app'
import SafePageWrapper from '@/components/SafePageWrapper.vue'
import { fetchUserProfile, saveUserProfile, uploadAvatar } from '@/apis/user'
import type { I_UserProfile } from '@/apis/user'
import { createRoom, joinRoom } from '@/apis/room'

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
	openid: string
	nickname: string
	/** 云存储头像 fileID，未设置头像时为空串 */
	avatarUrl: string
}

/** @description 进行中的牌局*/
interface I_OngoingRoom {
	roomId: string
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

/** @description 配色轮转顺序*/
const AVATAR_KEYS = ['default', 'win', 'lose', 'green']

/** @description 无头像成员按昵称哈希取固定配色（同一人颜色稳定）*/
const hashColor = (name: string): I_Avatar => {
	const sum = [...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
	return AVATAR_PRESET[AVATAR_KEYS[sum % AVATAR_KEYS.length]]
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

/** @description 进行中的牌局（room_members/rooms 实查，null 表示无进行中房间）*/
const ongoingRoom = ref<I_OngoingRoom | null>(null)

/** @description 资料弹窗显隐*/
const showProfile = ref(false)

/** @description 建房请求进行中（防重复点击）*/
const creating = ref(false)

/** @description 进房请求进行中（防重复点击）*/
const joining = ref(false)

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

/** @description 冷启动携带的待进房号（扫小程序码 scene / 转发卡片 roomCode），资料就绪后消费*/
let pendingJoinCode = ''

/** @description 解析冷启动参数中的房号（扫码进首页 scene 为 URL 编码；转发卡片直接带 roomCode），待资料就绪后自动进房*/
onLoad((options: TAny) => {
	const scene = options?.scene ? decodeURIComponent(options.scene) : ''
	pendingJoinCode = String(scene || options?.roomCode || '')
		.trim()
		.toUpperCase()
})

/** @description 进入页面拉取资料与进行中房间（不自动弹窗；未完善时用户卡展示默认资料，进房前才引导完善）*/
onShow(() => {
	fetchUserProfile()
		.then((profile) => {
			userDocId = profile?._id || ''
			userInfo.value = profile
			if (profile) {
				_fetchOngoingRoom(profile)
			} else {
				ongoingRoom.value = null
			}
		})
		.catch((err) => {
			// 拉取失败不阻断浏览；错误打日志便于排查
			console.error('[home] 拉取用户资料失败:', _errMsg(err))
		})
		.finally(() => {
			// 资料（或失败结果）就绪后再进房，避免 onShow 拉取期间误弹完善资料窗
			if (pendingJoinCode) {
				const code = pendingJoinCode
				pendingJoinCode = ''
				_joinByCode(code)
			}
		})
})

/** @description 拉取进行中的牌局：自己的活跃成员记录 → 房间 status=gaming 才展示 → 活跃成员列表；无/已结束则清空卡片*/
const _fetchOngoingRoom = (profile: I_UserProfile) => {
	const db = wx.cloud.database()
	const dbCmd = db.command
	db.collection('room_members')
		.where({ openid: profile._openid || '', leftAt: dbCmd.exists(false) })
		.orderBy('joinedAt', 'desc')
		.limit(1)
		.get()
		.then((res) => {
			const mine = res.data[0]
			if (!mine) {
				ongoingRoom.value = null
				return
			}
			return db
				.collection('rooms')
				.doc(mine.roomId)
				.get()
				.then((roomRes) => {
					const room = roomRes.data
					if (!room || room.status !== 'gaming') {
						ongoingRoom.value = null
						return
					}
					return db
						.collection('room_members')
						.where({ roomId: mine.roomId, leftAt: dbCmd.exists(false) })
						.orderBy('joinedAt', 'asc')
						.get()
						.then((memRes) => {
							ongoingRoom.value = {
								roomId: mine.roomId,
								code: room.roomCode || '',
								members: memRes.data.map((m) => ({
									openid: m.openid || '',
									nickname: m.nickname || '',
									avatarUrl: m.avatarUrl || ''
								}))
							}
						})
				})
		})
		.catch((err) => {
			console.error('[home] 拉取进行中房间失败:', err)
			ongoingRoom.value = null
		})
}

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
	const room = ongoingRoom.value
	if (!room) return
	uni.navigateTo({ url: `/pages/room/index?roomId=${room.roomId}&roomCode=${room.code}` })
}

/** @description 进房类操作前确保资料已完善：未完善先弹窗引导，保存成功后自动继续*/
const _ensureProfileThen = (action: () => void) => {
	if (userInfo.value) {
		action()
		return
	}
	pendingAction = action
	_openProfile()
}

/** @description 按房号进房：joinRoom 校验并登记成员 → 进房间页；未完善资料先引导完善*/
const _joinByCode = (roomCode: string) => {
	_ensureProfileThen(() => {
		if (joining.value) return
		joining.value = true
		uni.showLoading({ title: '进入中…', mask: true })
		joinRoom(roomCode)
			.then((res) => {
				uni.hideLoading()
				uni.navigateTo({ url: `/pages/room/index?roomId=${res.roomId}&roomCode=${res.roomCode}` })
			})
			.catch((err) => {
				// 开发期把真实错误亮出来，便于定位（房间不存在/已满/权限等问题）
				console.error('[home] 进房失败:', err)
				uni.hideLoading()
				uni.showToast({ title: `进房失败：${_errMsg(err)}`, icon: 'none' })
			})
			.finally(() => {
				joining.value = false
			})
	})
}

/** @description 创建房间：云函数分配短码建档 → 携带 roomId/roomCode 进房间页；未完善资料先引导完善*/
const _createRoom = () => {
	// 已在进行中的牌局：直接提示不发请求（云函数同样有拦截兜底）
	if (ongoingRoom.value) {
		uni.showToast({ title: '你已在牌局中，请先结算或退出', icon: 'none' })
		return
	}
	_ensureProfileThen(() => {
		if (creating.value) return
		creating.value = true
		uni.showLoading({ title: '创建中…', mask: true })
		createRoom()
			.then((res) => {
				uni.hideLoading()
				uni.navigateTo({ url: `/pages/room/index?roomId=${res.roomId}&roomCode=${res.roomCode}` })
			})
			.catch((err) => {
				// 开发期把真实错误亮出来，便于定位（云函数/权限/环境等问题）
				console.error('[home] 创建房间失败:', err)
				uni.hideLoading()
				uni.showToast({ title: `创建失败：${_errMsg(err)}`, icon: 'none' })
			})
			.finally(() => {
				creating.value = false
			})
	})
}

/** @description 扫码进房：真机扫小程序码 result 为空，码内房号在 path 的 scene 参数里（工具模拟扫码走 result）*/
const _scanJoin = () => {
	uni.scanCode({
		success: (res: TAny) => {
			const match = /scene=([^&]+)/.exec(res.path || '')
			const roomCode = match ? decodeURIComponent(match[1]) : res.result
			if (!roomCode) {
				uni.showToast({ title: '未识别到房号', icon: 'none' })
				return
			}
			_joinByCode(String(roomCode).toUpperCase())
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
