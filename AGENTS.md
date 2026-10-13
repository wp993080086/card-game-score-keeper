# AGENTS.md

打牌好友记账微信小程序（uni-app Vue 3 + TS + 微信云开发，仅 mp-weixin）。

## 规则加载（必须遵守）

项目规范在 `.agents/rules/`。**编码前必须按下面的路由表加载对应规则文件**，不确定就先读 `.agents/rules/README.md`：

| 场景（碰到就加载） | 规则文件 |
|---|---|
| 任何编码任务开始前（必读） | `rules/00-agent-行为规范.md` |
| 写任何组件/页面代码（必读） | `rules/01-项目概述.md` + `rules/02-编码规范.md` |
| 写 `<style>`、主题色/净额配色、头像、弹窗动画 | `rules/04-样式规范.md` |
| 新增页面/路由、新文件归属、云函数清单 | `rules/03-项目结构.md` |
| 新增/修改云函数、云数据库集合、云函数部署 | `rules/05-云函数规范.md` |
| 构建/编译验证、微信平台限制（扫码/分享面板/canvas） | `rules/06-构建与平台限制.md` |

## 最高优先级硬约束（违反即返工）

1. Vue 3 组合式 API，页面/组件一律 `<script setup lang="ts">`，禁止 Options API（唯一例外：`src/App.vue` 承载 uni 应用生命周期）；复用逻辑写成 `useXxx` composable
2. 云调用统一走 `src/apis/`（`callCloud`），组件里禁止直接 `wx.cloud.callFunction` / 直接操作机密集合（room_members / game_records / settlements）
3. 样式：unocss 已彻底移除，语义 class + scoped SCSS（扁平命名、无语法糖）；颜色一律取 CSS 变量，与 `design/common.css` 对齐；头像规则与弹窗动画规则见 04（均踩过坑）
4. 净额数值正数红（`--up`）负数绿（`--down`，红涨绿跌）；`--win/--lose` 仅用于成功/失败语义
5. `@dcloudio/*` 全家桶钉在 `3.0.0-5000720260410001`、vite 5，勿升级；不新增第三方业务库（经用户确认除外）
6. 不对编译产物 dist/ 做外部脚本后处理注入（会与开发者工具文件监听形成乒乓死循环）
7. 微信 AppID 与云开发环境 ID 属公开标识符，按约定直接写死（`src/manifest.json` / `src/App.vue`），不进 .env
8. 执行计划 / 修改代码 / review 代码时，必须在 `.agents/logs/` 对应目录（plans / changes / reviews）按 `YYYYMMDD-<type>-<slug>.md` 格式创建记录，详见 `rules/00-agent-行为规范.md`
9. 改动页面 UI 后必须同步更新 `design/` 静态设计稿

## 禁止

1. 主动 commit（改动保留在工作区，用户确认后自行提交）
2. 引入不存在的库 / 新增第三方业务库
3. 暴露密钥（私密 key / 密码；AppID 与云环境 ID 不算密钥）

跨项目通用的行为规范（编码前思考、简洁实现、精准改动、验证循环、日志记录）见 `.agents/rules/00-agent-行为规范.md`，同样必须遵守。

## 提交前检查

```bash
npm run build:weixin
```

husky + lint-staged 会在 commit 时自动跑 eslint --fix 与 prettier。
