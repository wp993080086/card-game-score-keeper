# 错误文案审查：toast 与接口报错链路

- 日期：2026-10-14
- 任务：审查全部 toast / cloudErrMsg / 云函数 throw 文案，修复发现的问题
- 内容：
  - 审查范围：src 全部 showToast 调用点（约 30 处）+ 9 个云函数全部 throw（约 50 条）
  - 结论：绝大多数正常——云函数文案全中文可读、前端统一 `xx失败：${cloudErrMsg(err)}`、poster 保存已区分取消/授权拒绝/其他
  - 修复 1：`src/pages/flow/index.vue` 流水加载失败未走 cloudErrMsg（手写 fallback 会把云函数业务错误的整串 errMsg 连堆栈刷进 toast），改为与其他页一致的 cloudErrMsg
  - 修复 2：`src/apis/cloud.ts` cloudErrMsg 兜底分支加固：兜底原文压缩空白 + 限长 80，网络类错误不再可能刷出多行英文日志
  - 修复 3：`cloudfunctions/createRoom/index.js` 占用房号失败不再把数据库内部错误原文透传（`房号分配失败：${_errText(err)}` → 固定文案「房号分配繁忙，请重试」）；服务端 console.error 保留原文，排查不受影响
- 结果：createRoom 语法检查通过；build:weixin 通过；dist 产物抽查 flow 页已引用 cloudErrMsg。遗留：createRoom 需重新部署云函数
