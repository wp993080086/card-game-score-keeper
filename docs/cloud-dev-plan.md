# 「打牌好友记账」云开发接入方案（v3）

> 状态：待确认 | 2026-09-28 更新
> 已确认决策：微信云开发 / **纯转账流水**（按局记分已废弃）/ 最少转账笔数 / 快捷语句聊天 / 积分单位 / 不支持撤销 / 4 人上限广告后扩 / 房主退出即解散 / **仅房主可结算** / **成员退房软删** / **转账走 transfer 云函数** / **消息最近 50 条 + 分页**

## 合规口径

- 单位统一**积分**，全站不出现 ¥ 符号、"元"字样与任何支付引导
- 聊天为预置快捷语句（10 条），无 UGC，内容安全无风险

## 一、页面结构与交互模型

### 1.1 页面结构

原 3 tab（首页/房间/结算）改为 **2 tab**（微信 tabBar 最少 2 个）：

- **首页**：用户信息 + 创建房间/扫码进房 + **进行中的牌局卡片**（无进行中牌局时该卡片直接不渲染）+ 快捷入口（手册/客服）
- **战绩**：历史牌局按时间归档 + 累计统计（总局数/胜率/累计积分）
- **房间页、结算页**：navigateTo 普通页面，从首页进入，可正常返回
- **对局详情**：结算确认后跳转，只读回看

### 1.2 记账交互（纯转账流水模型）

- 点**其他成员**头像 → 支出 dialog（标题"支出"、副文案"给 xxx"、输入正整数、取消/确定）
- 只能表达"我向某人支出"，自己的赢利由对方点自己的头像产生
- 每笔转账落 `game_records`：`[{from, -x}, {to, +x}]` 两元素数组
- **不支持撤销**：转错了双方反向再转一次，账本 append-only
- 底部仅保留「快捷语句」按钮，无"记一局"入口

### 1.3 房主退出语义

- 结算页/房间页点**退出按钮** → 二次弹窗"你是房主，退出将解散房间" → 确认后 status=dissolved，全员清出
- **直接返回**到主页 → 房间不解散，主页显示"进行中的牌局"卡片，点击回房

## 二、数据模型（云数据库集合）

| 集合 | 关键字段 | 说明 |
|---|---|---|
| `users` | _openid, nickname, avatarUrl | 微信 openid 即身份 |
| `rooms` | roomCode(4位短码), ownerOpenid, status(gaming/settled/dissolved), maxMembers(默认4), adLevel(预留) | |
| `room_members` | roomId, openid, nickname, avatarUrl, joinedAt, **leftAt** | **软删**：退房写 leftAt，不删记录，保证历史统计完整 |
| `game_records` | roomId, scores[{openid, delta}], createdBy, createdAt | **append-only，纯转账**：每笔两元素 [{from,-x},{to,+x}]，仅由 transfer 云函数写入 |
| `messages` | roomId, type(chat/payment/system/warning), senderOpenid, content, createdAt | chat 仅预置语句 |
| `settlements` | roomId, transfers[{fromOpenid, toOpenid, amount}], confirmedAt | 结算快照 |

累计净额由 `game_records` 实时汇总，不冗余存储。

## 三、云函数清单（3 个）

| 函数 | 职责 |
|---|---|
| `createRoom` | 生成不重复 4 位短码（撞码重试）→ 建房间 + 房主入成员表 |
| `transfer` | **转账唯一入口**。服务端校验：金额为正整数、from=调用者、to 为在场成员、from≠to、房间 status=gaming → 落 game_records + 发 payment 消息。杜绝客户端直写伪造账目 |
| `settle` | **仅房主可调用** + 幂等校验（已 settled 拒绝）。汇总净额 → 贪心最少转账笔数 → 写 settlements + 置 status=settled + 发 payment 系统消息 |

- ~~msgSecCheck~~：预置语句聊天，取消
- 小程序码：`wxacode.getUnlimited`（scene=roomCode）生成后存云存储，供房间二维码弹窗使用；**分享战绩图**用首页码（房间已结算，进房码无意义）
- 激励视频广告：本轮不接，`adLevel` 字段与 UI 占位预留，等流量主开通后补（4→6→8）

## 四、页面改造点

**home**
- 头像昵称：官方「头像昵称填写能力」，头像传云存储
- 进行中的牌局卡片（无牌局时隐藏）
- 扫码进房 + 创建房间走真实数据；进已满/已解散房间明确提示

**room**
- 成员上限 4 人；成员条 watch 刷新；点「邀请」弹小程序码 + 转发双入口
- **点其他成员头像 → 支出 dialog**（正整数）→ 调 transfer 云函数
- **快捷语句面板**：底部弹出 10 条预置语句，点选发送
- **消息流：watch 只拉最近 50 条，上拉加载更早（分页）**
- 成员主动退出（非房主）：写 leftAt 软删 + system 消息

**settlement**
- **仅房主可见「确认结算」按钮**（其他成员看到只读方案或"等待房主结算"提示）
- 调 settle 展示最少转账方案，确认后房间置 settled，跳转对局详情
- 退出按钮：房主=解散确认弹窗；成员=直接退出（软删）
- **分享战绩图**：canvas 绘制（净额排名 + 皇冠 MVP + 首页小程序码），保存相册/转发；仅 settled 后开放
- 分享房间：转发卡片 path 带 roomCode

**records**
- 累计统计（总局数/胜率/累计积分）+ 按日期归档历史牌局
- 单位口径："共 N 笔"（转账笔数），不再有"局"内局数
- 空状态：无历史时展示引导插画 + "去开局"按钮

**guide**：静态页，广告扩容 FAQ 保留在此

## 五、默认假设（不同意请指出）

1. 已 dissolved 房间不可再进入；settled 房间只读可回看（transfer/settle 云函数双重锁）
2. 成员自由退出（非房主），软删写 leftAt
3. 扫码/分享进入已满（4人）/已解散房间时明确提示
4. 分数一律正整数，数据库不存小数
5. 快捷语句 10 条文案见设计稿 quick-phrases.html，可后续替换

## 六、设计稿清单（design/）

| 文件 | 内容 |
|---|---|
| home.html | 首页（用户卡/进行中牌局/创建/扫码/快捷入口） |
| records.html | 战绩 tab（累计统计 + 按日归档） |
| room.html | 房间页（成员条/消息流/快捷语句按钮） |
| qr-popup.html | 房间二维码弹窗 |
| transfer-input.html | 支出 dialog（点头像） |
| quick-phrases.html | 快捷语句面板（10 条） |
| confirm-dialog.html | 房主解散确认弹窗 |
| settlement.html | 结算页（MVP 皇冠角标/最少转账方案/功能格） |
| room-detail.html | 对局详情（高亮头卡/结算方案/累计输赢） |
| empty-records.html | 战绩空状态 |
| manual.html | 使用手册 |
| index.html | 总览页 |

统一 mock 数据：法外狂徒 -60 / 张三 +200（MVP）/ 李四 -50 / 王五 -90，结算方案 = 王→张 90、法→张 60、李→张 50（3 笔）。

## 七、实施顺序

1. 云开发 init + cloudfunctions 编译链路打通（uni-app 需自处理 cloudfunctionRoot，先验证）
2. 页面结构调整：2 tab + 房间/结算改普通页 + 首页进行中牌局卡片
3. users + 头像昵称
4. createRoom + 进房 + 小程序码/分享
5. room：成员列表（watch 50 条分页）+ transfer 转账 + 支出 dialog + 快捷语句
6. settle 结算（仅房主+幂等）+ settlement 页 + 对局详情
7. 分享战绩图（canvas）
8. 广告扩容占位 + 边界场景补齐（满员/解散/软删成员的展示）
