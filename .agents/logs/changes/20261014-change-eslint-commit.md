# 修提交前的 eslint 报错

- 日期：2026-10-14
- 任务：husky 预提交被 preserve-caught-error 和 no-useless-assignment 拦住
- 内容：
  - `createRoom` 里两处 `throw new Error` 补上 `{ cause: err }`
  - `joinRoom` 的 `memberId` 去掉用不到的空串初值
- 结果：`npx eslint --fix` 对这两个文件通过
- 建房不再靠错误文案判断表在不在：`createCollection` 失败后读一次这张表，读得到就说明表已在，直接建房；读不到才把创建失败抛出去。需再上传 `createRoom`
