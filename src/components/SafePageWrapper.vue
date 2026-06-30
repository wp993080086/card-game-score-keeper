<template>
	<view class="safe-page-wrapper">
		<slot />
	</view>
</template>

<style lang="scss" scoped>
.safe-page-wrapper {
	width: 100%;
	height: 100%;
	background-color: #f8fafb;
	/* 兼容老iOS */
	padding-top: constant(safe-area-inset-top);
	padding-top: env(safe-area-inset-top);
	padding-bottom: env(safe-area-inset-bottom);
}
</style>
