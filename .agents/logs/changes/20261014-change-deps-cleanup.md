# 依赖清理与 CHANGELOG 初始化

- 日期：2026-10-14
- 任务：清理未使用依赖与冗余配置，建立 CHANGELOG
- 内容：
  - `prettier.config.js`：用户自行删除（无效配置，实际生效 `.prettierrc.js`，已用 --find-config-path 验证过）
  - `@dcloudio/uni-ui`：用户已卸载（package.json / node_modules 均无）；我补删 `src/pages.json` easycom 的 custom 映射规则，保留 `autoscan: true`
  - `CHANGELOG.md`：原为空文件，按 Keep a Changelog 格式写入 [1.0.0] - 2026-10-14 首条（提审基线：房间/记账/结算/战绩/上线加固/工程化）
- 结果：build:weixin 通过，dist 产物 grep 无 uni-ui 残留。工作区现有改动（README/.prettierrc.js/package.json/lock/pages.json/CHANGELOG + D prettier.config.js）由用户确认后自行提交
