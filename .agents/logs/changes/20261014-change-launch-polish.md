# 上线前优化落地：watcher 重连 / 战绩聚合 / 日志收敛

- 日期：2026-10-14
- 任务：落地 20261014-plan-launch-polish.md 中的三项代码优化
- 内容：
  1. `src/pages/room/index.vue`：新增 `_reconnectWatch`（onError 延迟 3s 重建对应 watcher，重试上限 5 次，超限 toast「实时刷新已断开，请退出房间重新进入」）；三个 watcher 的 onError 接入重连。结算/解散弹窗「只提示一次」标记由 _watchRoom 闭包内 `prompted` 提升为模块级 `roomPrompted`，重连重建闭包后不会重复弹窗
  2. `cloudfunctions/getMyGames/index.js`：全量拉 `room_members`（openid 匹配的全部历史记录，退房重进会累积）改为 aggregate `match + group(_id=$roomId, lastJoinedAt=max($joinedAt))`，一个房间一条结果；joinTs 由 joinTsMap 取代原 filter+Math.max
  3. `src/App.vue`：删除三处开发期 console.log（onShow/onHide 因此为空钩子一并移除）；`src/pages/home/index.vue`：删除扫码原始结果 console.log 及其注释。console.error 按编码规范保留
- 结果：`npm run build:weixin` 通过；产物抽查 dist room 页含重连字符串字面量、home/app 无 console.log；getMyGames node 语法检查通过。getMyGames 需用户在开发者工具重新部署云函数
