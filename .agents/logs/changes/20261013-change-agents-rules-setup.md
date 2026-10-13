# 搭建 .agents/rules 项目规则体系

- 日期：2026-10-13
- 任务：参考 web_live 项目的 AGENTS.md 模式，为本项目总结规则落进 `.agents/rules/`，并修正与本项目不符的 `00-agent-行为规范.md`
- 内容：
  - `00-agent-行为规范.md`：保留跨项目通用核心（沟通/思考/简洁/精准/验证），去掉引用了本项目不存在内容的表述（「01~11 技术规范」改为实际 01~06）；新增「大段删改后先核对再验证」一节（结算页截断误删 style 行的教训）；禁止项按本项目口径改写（AppID/环境 ID 属公开标识符不算密钥）
  - 新建 `01-项目概述`（技术栈钉版本、命令、硬约束）、`02-编码规范`（组合式 API、TS、云调用、cloudErrMsg）、`03-项目结构`（目录/页面/云函数地图、design 同步）、`04-样式规范`（tokens、头像、弹窗、红涨绿跌）、`05-云函数规范`（数据语义、错误约定、部署）、`06-构建与平台限制`（构建链路、微信平台坑）
  - 新建 `rules/README.md` 索引（场景路由表）；创建 `.agents/logs/{plans,changes,reviews}/`（.gitkeep）
  - 重写根 `AGENTS.md`：对齐 web_live 结构（规则加载路由表 + 硬约束 + 禁止 + 提交前检查），替换掉失效的 openspec/project.md 引用
  - 规则内容来源：.workbuddy/memory 沉淀的项目约定 + 本会话踩坑 + 实际代码核查（package.json / vite.config / eslint.config / tsconfig / common.scss / cloud.ts 等）
- 结果：规则文件就绪；lint 脚本已坏的事实已写入规则（验证以 build:weixin 为准）；待用户审阅确认
