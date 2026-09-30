import { cpSync, existsSync, readdirSync, rmSync, watch } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

/** @description 云函数源目录（微信开发者工具从产物里识别并手动上传） */
const CF_SRC_DIR = 'cloudfunctions'

/** @description uni 双模式产物中的云函数目标目录 */
const CF_OUT_DIRS = {
	dev: 'dist/dev/mp-weixin/cloudfunctions',
	build: 'dist/build/mp-weixin/cloudfunctions'
}

/**
 * @description 把根目录 cloudfunctions 同步进 uni 产物目录
 * - 一次性 build：writeBundle 拷贝一次
 * - dev watch：writeBundle 拷贝一次 + 监听源目录，变更防抖后重同步
 * 说明：uni 与微信开发者工具均只读取该产物目录、不写入，因此无写入乒乓
 */
function cloudfunctionsSyncPlugin() {
	const src = resolve(process.cwd(), CF_SRC_DIR)
	if (!existsSync(src)) return null
	// uni dev 命令无 build 字样，一次性 build 为 "uni build -p mp-weixin"
	const isBuild = process.argv.includes('build')
	const outDir = resolve(process.cwd(), isBuild ? CF_OUT_DIRS.build : CF_OUT_DIRS.dev)
	let watched = false
	const sync = () => {
		try {
			// 覆盖式拷贝（不整树删除重建）；仅清理源里已删除的孤儿目录，避免产物残留
			cpSync(src, outDir, { recursive: true })
			const srcNames = new Set(readdirSync(src))
			for (const name of readdirSync(outDir)) {
				if (!srcNames.has(name)) {
					rmSync(resolve(outDir, name), { recursive: true, force: true })
				}
			}
			console.log(`[cloudfunctions] 已同步 -> ${outDir}`)
		} catch (e) {
			console.warn('[cloudfunctions] 同步失败:', e.message)
		}
	}
	return {
		name: 'cloudfunctions-sync',
		writeBundle() {
			sync()
			if (isBuild || watched) return
			watched = true
			let timer = null
			try {
				watch(src, { recursive: true }, () => {
					// 云函数包含多个文件，防抖合并一次拷贝
					clearTimeout(timer)
					timer = setTimeout(sync, 300)
				})
				console.log('[cloudfunctions] 源目录监听已启动')
			} catch (e) {
				console.warn('[cloudfunctions] 源目录监听失败:', e.message)
			}
		}
	}
}

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [uni(), cloudfunctionsSyncPlugin()],
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
