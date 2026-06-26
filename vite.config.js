import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [uni()],
	resolve: {
		alias: [{ find: '@', replacement: './src' }]
	},
	css: {
		preprocessorOptions: {
			scss: {
				api: 'modern-compiler',
				// 全局注入公共scss，所有页面自动加载
				additionalData: `@use "@/styles/common.scss" as *;`
			}
		}
	},
	// 过滤 uni 插件内部废弃 API 警告（上游依赖问题，项目无法控制）
	onwarn(warning, warn) {
		if (warning.plugin === 'uni:h5-css') return
		warn(warning)
	}
})
