# 按风险审查修复权限、结算互斥和战绩口径

- 日期：2026-10-13
- 任务：按 `20261013-review-project-audit.md` 的 10 条及文末复核意见改完
- 内容：
  - 第 1、3 条是控制台和云存储，代码改不了。目标权限已写进 `.agents/rules/02-编码规范.md`、`05-云函数规范.md`。用户需在微信云开发控制台改完后再发版验证
  - 第 2 条：`settle` 先确认调用者在 `room_members` 里有记录（含已退出），确认落库仍只允许房主
  - 第 4 条按复核改为条件更新：settle 把 `gaming` 改成 `settling`，transfer 写流水前要求房间仍是 `gaming`。卡在 `settling` 时房主可再次确认。房间页遇到 `settling` 不把人带离
  - 第 5 条：单笔 1–999999 且必须是安全整数；同一人同一房间每分钟 20 笔；单房超过 800 笔拒绝并提示先结算。房间页输入框 `maxlength="6"`，提交时同样校验
  - 第 6 条：成员文档增加 `active`。在场查询 `active == true` 且 `limit(1)`。退出、解散、结算把 `active` 改为 false。房间页只 watch 在场记录。旧数据在相关云函数里补 `active`，同一人多条未退出记录只留 `joinedAt` 最新的一条
  - 第 7 条：房间维护 `memberCount`，进房用 `memberCount < 上限` 的条件更新占名额。`room_codes` 的文档 id 就是房号，结算或解散时删除。进房失败按 openid 每分钟 10 次
  - 第 8 条：`settle/config.json` 声明 `wxacode.getUnlimited`。首页码写入 `app_config/home_qr`，之后只读
  - 第 9 条：战绩只读 `settlements`，同一房间多份快照按 `confirmedAt` 留最新。无快照时间时用 `joinedAt`。流水昵称按 `joinedAt` 升序分页，后写覆盖
  - 第 10 条：结算页和对局详情在有流水但方案为空时显示「本局已两清，无需再转」。邀请文案改为小程序内扫码或手输。有流水时，房主解散确认写明未结算积分不进战绩。流水页那句不改
- 结果：`node --check` 通过；`npm run build:weixin` 通过。产物里能看到新文案、`maxlength="6"`、`settling`、`settle/config.json` 的 openapi。控制台权限、云存储、索引和云函数部署尚未在真机执行
- 复查补丁：房间页先等 `getOngoingRoom` 补上 `active` 再监听成员；结算中房主不能解散、成员可以退出；已结束房间若还占着房号，下次进房失败时删掉。再次 `node --check` 与 `npm run build:weixin` 通过
- 建房报「房号分配繁忙」：占位写入的任何失败都被当成撞号。改为文档 id 用 `rc`+房号，集合不存在时先建集合，其它错误把原文抛出。需再上传 `createRoom`、`joinRoom`、`leaveRoom`、`settle`
- 建房 -502005：`room_codes` 不存在，add 不会自动建表。createRoom 改为先 `db.createCollection`，并一并创建 `rate_limits`、`app_config`。需再上传 `createRoom`
