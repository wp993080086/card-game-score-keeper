# review：上线前优化三项改动

- 日期：2026-10-14
- 任务：自审 20261014-change-launch-polish.md 的改动
- 内容：
  - room/index.vue：`_reconnectWatch` 在 pageAlive=false 时直接返回（退出页面不重连）；setTimeout 回调二次校验 pageAlive；重连靠重建 watcher 重推 init 快照恢复一致（messages 重置为最新 50 条，与重新进页行为一致，可接受）；roomPrompted 提升后重连不再重复弹结算/解散弹窗；三个 watcher 仍由 onUnload 统一 close，无泄漏
  - getMyGames/index.js：`_fetchAll` 仍被 `_fetchByRoomIds` 使用未删；aggregate group 后 mine 结构由 `{roomId}` 变为 `{_id, lastJoinedAt}`，roomIds 取 `_id`、joinTs 取 `lastJoinedAt`，已同步改对；房间结构 { roomId, roomCode, count, net, memberCount, lastTime } 返回形状不变，前端 records 页无需改动
  - App.vue：onLaunch 的云初始化保留；home 扫码解析逻辑未动，仅删日志
- 结果：构建通过 + 产物抽查通过。遗留待办：① getMyGames 需重新部署云函数；② 数据库索引（room_members: roomId+active+joinedAt 等）与集合权限属控制台操作，须用户自行确认
