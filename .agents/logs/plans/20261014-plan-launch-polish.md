# 上线前优化：watcher 重连 / 战绩聚合 / 日志收敛

- 日期：2026-10-14
- 任务：上线体检后剩余可代码化的优化项（控制台类项 3/4/5/6 中 4、5 须用户在云开发控制台/开发者工具操作，不在本次代码范围）
- 内容：
  1. room 页三个实时 watcher（members/messages/rooms）断线重连兜底：onError 延迟 3s 重建、上限 5 次、超限提示退出重进；room watcher 的「弹窗只提示一次」标记提升到外层，重连后不重复弹
  2. getMyGames 云函数性能：`_fetchAll('room_members', {openid})` 全量拉历史成员记录改为 aggregate match+group by roomId，一次拿每个房间的最新 joinedAt，消除随历史增长的传输量
  3. 日志收敛：删除开发期 console.log（App.vue 三处、home 扫码原始结果一处）；console.error 按编码规范保留
- 结果：待实施，完成后 build:weixin 验证 + 产物抽查
