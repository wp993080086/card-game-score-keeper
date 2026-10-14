# messages 惰性清理：房间结束 5 分钟后删除消息

- 日期：2026-10-14
- 任务：messages 集合此前只增不减（结算/解散后无任何代码读取，属遗留数据）；实现结束房间后延迟 5 分钟清理
- 内容：
  - 背景决策：云函数 return 后进程冻结，无法 setTimeout 延迟；定时触发器需新增函数+控制台配置，偏重。采用惰性清理：结束时房间打 endedAt，getOngoingRoom（每次打开首页必调）顺手删"结束超 5 分钟"房间的消息
  - `cloudfunctions/settle/index.js`：_ensureClosed 的 rooms 更新加 `endedAt: db.serverDate()`（覆盖结算落库与重入收尾两条路径）
  - `cloudfunctions/leaveRoom/index.js`：房主解散的 rooms 条件更新加 `endedAt: db.serverDate()`
  - `cloudfunctions/getOngoingRoom/index.js`：新增 `_cleanEndedMessages`——查 status in [settled,dissolved] 且 endedAt < now-5min 的房间（limit 20），按 roomId in 批量删 messages；try/catch 静默失败不阻塞主流程；main 开头调用
  - 安全性：删除发生在房间终结 5 分钟后，最终"已结算"动态有回看窗口；对局详情/流水走 settlements/game_records 不受影响；成员正常退房不触发（房间未终结）
  - 存量兼容：历史已结束房间无 endedAt 字段，不会被清理匹配——随本次清库手动删掉即可
- 结果：三个云函数语法检查通过。新增运维项：① rooms 集合补索引 `status + endedAt`（都升序）；② 部署清单增至 5 个云函数：getOngoingRoom / settle / leaveRoom / getMyGames / createRoom
