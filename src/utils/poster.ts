/**
 * 战绩图生成与分享（settlement / room-detail 两页共用）
 * canvas 2d 无法离屏创建：调用页模板需放置 <canvas id="poster" type="2d" class="poster-canvas" />
 */

import { cloudErrMsg } from '@/apis/cloud'

/** @description 战绩图硬编码配色（canvas 不认 CSS 变量，取设计变量同款色值；win/lose 为净额数字色，对齐页面 --up/--down 红涨绿跌）*/
const POSTER_COLOR = {
	title: '#1f2329',
	sub: '#86909c',
	primary: '#4a78d9',
	primarySoft: '#edf2fc',
	win: '#e64340',
	lose: '#34a35b',
	divider: '#edf0f5'
}

/** @description 战绩图头像配色（与页面头像 preset 同观感的具体色值）*/
const POSTER_AVATAR_COLORS: TDict<{ bg: string; color: string }> = {
	default: { bg: '#edf2fc', color: '#4a78d9' },
	win: { bg: '#fff3e8', color: '#d96a1f' },
	lose: { bg: '#fff1ed', color: '#d63a3a' },
	green: { bg: '#e8f7ee', color: '#34a35b' }
}

/** @description 头像配色轮转顺序*/
const AVATAR_KEYS = ['default', 'win', 'lose', 'green']

/** @description 战绩图头像配色哈希（同一人颜色稳定）*/
const posterHashColor = (name: string): { bg: string; color: string } => {
	const sum = [...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
	return POSTER_AVATAR_COLORS[AVATAR_KEYS[sum % AVATAR_KEYS.length]]
}

/** @description 战绩图画布逻辑宽度与行高*/
const POSTER_W = 375
const POSTER_ROW_H = 44
const POSTER_ROW_TOP = 132

/** @description 画布内一行数据（净额排名）*/
export interface I_PosterRow {
	nickname: string
	delta: number
}

/** @description 生成参数（canvasId 对应调用页模板里的 canvas 节点 id）*/
export interface I_PosterOptions {
	canvasId: string
	roomCode: string
	rows: I_PosterRow[]
	homeQrFileID?: string
}

/** @description 查询画布节点（canvas 2d 不可离屏，节点须在调用页 DOM 中；不缓存跨页复用，避免拿到已销毁页面的节点）*/
const _queryCanvas = (canvasId: string): Promise<TAny> =>
	new Promise((resolve, reject) => {
		uni
			.createSelectorQuery()
			.select(`#${canvasId}`)
			.fields({ node: true, size: true }, (res: TAny) => {
				if (!res?.node) {
					reject(new Error('画布初始化失败'))
					return
				}
				resolve(res.node)
			})
			.exec()
	})

/** @description 首页码 fileID → 本地临时路径（fileID → 临时 URL → 下载）；失败返回空串，战绩图降级为无码*/
const _loadHomeQr = (fileID: string): Promise<string> => {
	if (!fileID) return Promise.resolve('')
	return new Promise((resolve) => {
		wx.cloud
			.getTempFileURL({ fileList: [fileID] })
			.then((res: TAny) => {
				const url = res?.fileList?.[0]?.tempFileURL
				if (!url) {
					resolve('')
					return
				}
				uni.downloadFile({
					url,
					success: (d) => resolve(d.statusCode === 200 ? d.tempFilePath : ''),
					fail: () => resolve('')
				})
			})
			.catch(() => resolve(''))
	})
}

/** @description 绘制战绩图：标题/房号 + 净额排名（MVP 皇冠）+ 底部首页码，高度随人数自适应*/
const _drawPoster = (node: TAny, qrPath: string, opts: I_PosterOptions): Promise<void> => {
	return new Promise((resolve, reject) => {
		const list = opts.rows.slice(0, 8)
		const qrY = POSTER_ROW_TOP + list.length * POSTER_ROW_H + 24
		const posterH = qrY + (qrPath ? 96 + 46 : 56)
		const dpr = uni.getSystemInfoSync().pixelRatio || 2

		node.width = POSTER_W * dpr
		node.height = posterH * dpr
		const ctx = node.getContext('2d')
		// 重复生成时 scale 会叠乘，先重置再按像素比缩放
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

		// 背景
		ctx.fillStyle = '#ffffff'
		ctx.fillRect(0, 0, POSTER_W, posterH)

		// 标题与房号
		ctx.textAlign = 'center'
		ctx.fillStyle = POSTER_COLOR.title
		ctx.font = 'bold 22px sans-serif'
		ctx.fillText('打牌好友记账', POSTER_W / 2, 48)
		ctx.fillStyle = POSTER_COLOR.sub
		ctx.font = '14px sans-serif'
		ctx.fillText(`房号 ${opts.roomCode} · 牌局结算`, POSTER_W / 2, 74)

		// 分割线
		ctx.strokeStyle = POSTER_COLOR.divider
		ctx.lineWidth = 1
		ctx.beginPath()
		ctx.moveTo(24, 96)
		ctx.lineTo(POSTER_W - 24, 96)
		ctx.stroke()

		// 排名列表（旧快照可能缺昵称，兜底避免 [...undefined] 报 not iterable）
		list.forEach((s, i) => {
			const nick = s.nickname || '牌友'
			const y = POSTER_ROW_TOP + i * POSTER_ROW_H
			// 冠军皇冠 / 序号
			ctx.textAlign = 'left'
			ctx.fillStyle = POSTER_COLOR.title
			ctx.font = i === 0 ? '16px sans-serif' : '14px sans-serif'
			ctx.fillText(i === 0 ? '👑' : `${i + 1}`, 24, y + 2)
			// 圆头像（配色底 + 昵称首字）
			const c = posterHashColor(nick)
			ctx.beginPath()
			ctx.arc(68, y - 4, 16, 0, Math.PI * 2)
			ctx.fillStyle = c.bg
			ctx.fill()
			ctx.fillStyle = c.color
			ctx.font = 'bold 13px sans-serif'
			ctx.textAlign = 'center'
			ctx.fillText(nick.charAt(0), 68, y + 1)
			// 昵称
			ctx.fillStyle = POSTER_COLOR.title
			ctx.font = '16px sans-serif'
			ctx.textAlign = 'left'
			ctx.fillText(nick.length > 8 ? `${nick.slice(0, 8)}…` : nick, 96, y + 2)
			// 净额
			ctx.fillStyle = s.delta >= 0 ? POSTER_COLOR.win : POSTER_COLOR.lose
			ctx.font = 'bold 17px sans-serif'
			ctx.textAlign = 'right'
			ctx.fillText(`${s.delta >= 0 ? '+' : ''}${s.delta} 分`, POSTER_W - 24, y + 2)
		})

		const finish = () => resolve()
		if (qrPath) {
			// 首页小程序码
			const img = node.createImage()
			img.onload = () => {
				ctx.drawImage(img, (POSTER_W - 96) / 2, qrY, 96, 96)
				ctx.fillStyle = POSTER_COLOR.sub
				ctx.font = '12px sans-serif'
				ctx.textAlign = 'center'
				ctx.fillText('扫码记牌，理清账目', POSTER_W / 2, qrY + 118)
				finish()
			}
			img.onerror = () => {
				// 码图加载失败降级为纯文字底部
				ctx.fillStyle = POSTER_COLOR.sub
				ctx.font = '12px sans-serif'
				ctx.textAlign = 'center'
				ctx.fillText('—— 打牌好友记账 ——', POSTER_W / 2, qrY + 24)
				finish()
			}
			img.src = qrPath
		} else {
			ctx.fillStyle = POSTER_COLOR.sub
			ctx.font = '12px sans-serif'
			ctx.textAlign = 'center'
			ctx.fillText('—— 打牌好友记账 ——', POSTER_W / 2, qrY + 12)
			finish()
		}
	})
}

/** @description 导出画布为临时图片（宽高用画布像素尺寸，否则真机导出的图是坏的）*/
const _exportPoster = (node: TAny): Promise<string> => {
	const width = node.width
	const height = node.height
	return new Promise((resolve, reject) => {
		wx.canvasToTempFilePath({
			canvas: node,
			x: 0,
			y: 0,
			width,
			height,
			destWidth: width,
			destHeight: height,
			fileType: 'png',
			success: (res) => resolve(res.tempFilePath),
			fail: reject
		})
	})
}

/** @description 分享面板读不到 http://tmp 时会显示裂图，先拷到用户目录 */
const _toSharePath = (tempPath: string): string => {
	try {
		const fs = wx.getFileSystemManager()
		const dest = `${wx.env.USER_DATA_PATH}/result-poster.png`
		try {
			fs.unlinkSync(dest)
		} catch (err) {
			// 第一次分享还没有旧文件
		}
		fs.copyFileSync(tempPath, dest)
		return dest
	} catch (err) {
		console.error('[poster] 复制分享图失败:', err)
		return tempPath
	}
}

/** @description 生成战绩图临时文件（查画布→绘制→导出）；loading 由调用页自行控制*/
export const generateResultPoster = async (opts: I_PosterOptions): Promise<string> => {
	const node = await _queryCanvas(opts.canvasId)
	const qrPath = await _loadHomeQr(opts.homeQrFileID || '')
	await _drawPoster(node, qrPath, opts)
	return _exportPoster(node)
}

/** @description 弹系统图片分享面板（发送给朋友/收藏/下载；面板内保存无回调，精准反馈走「保存战绩图」入口）*/
export const openSharePanel = (filePath: string, tag = '[poster]') => {
	wx.showShareImageMenu({
		path: _toSharePath(filePath),
		fail: (err) => {
			// 用户取消不算错误
			if (err?.errMsg && String(err.errMsg).includes('cancel')) return
			console.error(`${tag} 分享面板调起失败:`, err)
		}
	})
}

/** @description 保存失败的统一处理（取消静默 / 授权被拒引导去设置 / 其余报错 toast）*/
const _handleSaveError = (err: TAny, tag: string) => {
	const msg = String(err?.errMsg || '')
	if (msg.includes('cancel')) return
	if (msg.includes('auth deni') || msg.includes('authorize')) {
		uni.showModal({
			title: '需要相册权限',
			content: '请在设置中开启「添加到相册」权限后重试',
			confirmText: '去设置',
			success: (res: TAny) => {
				if (res.confirm) wx.openSetting()
			}
		})
		return
	}
	console.error(`${tag} 保存战绩图失败:`, err)
	uni.showToast({ title: `保存失败：${cloudErrMsg(err)}`, icon: 'none' })
}

/** @description 仅保存战绩图到相册（saveImageToPhotosAlbum 回调精准：成功 toast；错误自行消化，恒 resolve）*/
export const savePosterToAlbum = (filePath: string, tag = '[poster]'): Promise<void> =>
	new Promise((resolve) => {
		wx.saveImageToPhotosAlbum({
			filePath,
			success: () => {
				uni.showToast({ title: '已保存到相册', icon: 'success' })
				resolve()
			},
			fail: (err) => {
				_handleSaveError(err, tag)
				resolve()
			}
		})
	})
