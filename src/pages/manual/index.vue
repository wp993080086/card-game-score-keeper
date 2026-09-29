<template>
	<view class="manual-page">
		<!-- 快速入门 -->
		<view class="manual-card first">
			<view class="title">
				<view class="ico" style="background: #e8f7ee; color: #34a35b">🚀</view>
				<text>快速入门</text>
			</view>
			<view v-for="step in quickSteps" :key="step.num" class="step">
				<view class="num">{{ step.num }}</view>
				<view class="text">{{ step.text }}</view>
			</view>
		</view>

		<!-- 如何记账 -->
		<view class="manual-card">
			<view class="title">
				<view class="ico" style="background: #fff3e8; color: #d96a1f">📝</view>
				<text>如何记账</text>
			</view>
			<view class="guide-item">
				<view class="ico" style="background: #e3f2fd">→</view>
				<view class="body">
					<view class="h">点头像支付</view>
					<view class="d">点其他成员头像，输入正整数（&gt;0）向他支付积分</view>
				</view>
			</view>
			<view class="guide-item">
				<view class="ico" style="background: #fff1ed">!</view>
				<view class="body">
					<view class="h">转错了</view>
					<view class="d">本平台不支持撤销，让对方反向转一次即可修正</view>
				</view>
			</view>
		</view>

		<!-- 常见问题 -->
		<view class="manual-card">
			<view class="title">
				<view class="ico" style="background: #f3e8ff; color: #7c4dff">?</view>
				<text>常见问题</text>
			</view>
			<view v-for="item in faqList" :key="item.q" class="faq-item">
				<view class="row">
					<view class="badge q">Q</view>
					<view class="q-text">{{ item.q }}</view>
				</view>
				<view class="row">
					<view class="badge a">A</view>
					<view class="a-text">{{ item.a }}</view>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup lang="ts">
defineOptions({
	name: 'Manual'
})

/** @description 快速入门步骤*/
interface I_Step {
	num: number
	text: string
}

/** @description 常见问题条目*/
interface I_FaqItem {
	q: string
	a: string
}

/** @description 快速入门步骤文案（对齐 design/manual.html，静态内容）*/
const quickSteps: I_Step[] = [
	{ num: 1, text: '点击首页「创建房间」，生成 4 位房号' },
	{ num: 2, text: '邀请好友扫码加入（最多 4 人）' },
	{ num: 3, text: '点击成员头像向他支付积分（仅本人向他人支出）' },
	{ num: 4, text: '打完后点结算，自动算最少转账方案' }
]

/** @description 常见问题文案（对齐 design/manual.html，静态内容）*/
const faqList: I_FaqItem[] = [
	{ q: '平台会收取费用吗？', a: '完全免费，无任何抽成。' },
	{ q: '积分能换成钱吗？', a: '本平台只做记账工具，转账由好友间自行完成。' },
	{ q: '房间人数能扩容吗？', a: '房主可看广告将上限提升至 6 人或 8 人。' }
]
</script>

<style lang="scss" scoped src="./style.scss"></style>
