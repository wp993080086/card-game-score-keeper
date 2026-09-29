<script>
export default {
	onLaunch: function () {
		console.log('App Launch')
	},
	onShow: function () {
		console.log('App Show')
	},
	onHide: function () {
		console.log('App Hide')
	}
}
</script>

<style lang="scss">
@use '@/styles/reset.scss' as *;

/* 设计 tokens —— 严格对齐 design/common.css，所有页面通过 CSS 变量取色 */
page {
	/* 主色（青蓝） */
	--primary: #4a78d9;
	--primary-hover: #3d68c4;
	--primary-soft: #edf2fc;
	--primary-text: #2e5aac;

	/* 浅橙（赢） */
	--win: #ff8a3d;
	--win-soft: #fff3e8;
	--win-text: #d96a1f;

	/* 浅红（输） */
	--lose: #f76565;
	--lose-soft: #fff1ed;
	--lose-text: #d63a3a;

	/* 背景与文字 */
	--bg: #ffffff;
	--bg-2: #f7f8fa;
	--bg-3: #f0f1f4;
	--text-1: #1f2329;
	--text-2: #4e5969;
	--text-3: #86909c;
	--text-4: #c9cdd4;

	/* 边框分隔线 */
	--border: #f0f1f4;
	--divider: #f0f0f5;

	/* 阴影与圆角 */
	--shadow-card: 0 4rpx 16rpx rgba(31, 35, 41, 0.04);
	--shadow-pop: 0 16rpx 48rpx rgba(31, 35, 41, 0.08);
	--radius-sm: 16rpx;
	--radius-md: 24rpx;
	--radius-lg: 32rpx;

	width: 100%;
	height: 100%;
	font-size: 28rpx;
	color: var(--text-1);
	background-color: var(--bg);
	font-feature-settings: 'tnum';
}

/* 通用头像（对齐 design/common.css 的 .avatar） */
.g-avatar {
	@include flex_center;
	width: 80rpx;
	height: 80rpx;
	border-radius: 50%;
	font-size: 32rpx;
	font-weight: 600;
	flex-shrink: 0;
	overflow: hidden;
}
.g-avatar.lg {
	width: 112rpx;
	height: 112rpx;
	font-size: 44rpx;
}
.g-avatar.sm {
	width: 64rpx;
	height: 64rpx;
	font-size: 26rpx;
}
.g-avatar.xs {
	width: 48rpx;
	height: 48rpx;
	font-size: 22rpx;
}

/* #ifdef H5 */
/* H5 导航栏底部投影：与页面内容分层（小程序端为原生导航栏，无投影 API，无法定制） */
uni-page-head .uni-page-head {
	box-shadow: 0 2rpx 12rpx rgba(31, 35, 41, 0.08);
}
/* H5 底部 tabBar 上方投影：与页面内容分层（小程序端已由 borderStyle: black 分隔线承担） */
uni-tabbar .uni-tabbar {
	box-shadow: 0 -2rpx 12rpx rgba(31, 35, 41, 0.06);
}
/* #endif */
</style>
