# 「打牌好友记账」云开发接入方案（v2）

> 状态：待确认 | 2026-09-28 更新
> 已确认决策：微信云开发 / 按局记分 / 最少转账笔数 / 快捷语句聊天 / 积分单位 / 不支持撤销 / 4 人上限广告后扩 / 房主退出即解散

## 合规口径

- 单位统一**积分**，全站不出现 ¥ 符号、"元"字样与任何支付引导
- 聊天为预置快捷语句，无 UGC，内容安全无风险

## 一、页面结构调整（由"房主直接返回"推导，需确认）

原 3 tab（首页/房间/结算）改为 **2 tab**（微信 tabBar 最少 2 个）：

- **首页**：用户信息 + 创建房间/扫码进房 + **进行中的牌局卡片**（点击回房）+ 历史/战绩入口
- **战绩**：历史房间列表与战绩统计（原"历史房间"入口升级为 tab）
- **房间页、结算页**：改为 navigateTo 普通页面，从首页进入，可正常返回

房主退出语义：

- 结算页/房间页点**退出按钮** → 二次弹窗"你是房主，退出将解散房间" → 确认后 status=dissolved，全员清出
- **直接返回**到主页 → 房间不解散，主页显示"已有牌局正在进行中"，点击回到房间

## 二、数据模型（云数据库集合）

| 集合 | 关键字段 | 说明 |
|---|---|---|
| `users` | _openid, nickname, avatarUrl | 微信 openid 即身份 |
| `rooms` | roomCode(4位短码), ownerOpenid, status(gaming/settled/dissolved), maxMembers(默认4), adLevel(广告扩容等级，预留) | |
| `room_members` | roomId, openid, nickname, avatarUrl, joinedAt | watch 实时刷新 |
| `game_records` | roomId, scores[{openid, delta}], note, createdBy, createdAt | **append-only，无撤销字段**。一局记分 = 多元素数组；头像支付 = [{from,-x},{to,+x}] 两元素，同一套汇总逻辑 |
| `messages` | roomId, type(chat/system/payment/warning), senderOpenid, content, createdAt | chat 内容来自预置语句 |
| `settlements` | roomId, transfers[{fromOpenid, toOpenid, amount}], confirmedAt | 结算快照 |

累计净额由 `game_records` 实时汇总，不冗余存储。

## 三、云函数清单（2 个）

| 函数 | 职责 |
|---|---|
| `createRoom` | 生成不重复 4 位短码 → 建房间 + 房主入成员表 |
| `settle` | 汇总净额 → 贪心最少转账笔数 → 写 settlements + payment 系统消息 |

- ~~msgSecCheck~~：预置语句聊天，取消
- 小程序码：`wxacode.getUnlimited`（scene=roomCode）生成后存云存储，供房间二维码弹窗与战绩图使用
- 激励视频广告：本轮不接，`adLevel` 字段与 UI 占位按钮预留，等流量主开通后补（4→6→8）

## 四、页面改造点

**home**
- 头像昵称：官方「头像昵称填写能力」，头像传云存储
- 进行中的牌局卡片（含房主视角提示）
- 扫码进房 + 创建房间走真实数据

**room**
- 成员上限 4 人；成员条 watch 刷新；点击「邀请」弹出小程序码 + 转发双入口
- **点头像转分**：点自己头像 → 弹输入框 → 输入本局自己 +/- 分（输填负数、赢填正数）→ 落 records + payment 消息；底部不再保留"+记一局"按钮
- **快捷语句聊天**：点聊天按钮弹出 10 条预置语句面板（文案如"快点吧，我等到花儿都谢了"），点选发送，messages watch 实时显示
- 错误修正口径：不支持撤销，转错再反向转一次、记错再记一局

**settlement**
- 调 `settle` 展示最少转账方案，确认后房间置 settled
- MVP = 净额最高者；排行榜/流水明细从 records 汇总
- **分享战绩图**：canvas 绘制（净额排名 + MVP + 小程序码），保存相册/转发；仅 settled 后开放
- 分享房间：转发卡片 path 带 roomCode，好友点击直接进房

**guide**：静态页不动

## 五、默认假设（不同意请指出）

1. 已 dissolved 房间不可再进入；settled 房间只读可回看
2. 成员自由退出（非房主），退出后从成员表移除
3. 扫码/分享进入已满（4人）/已解散房间时明确提示
4. 分数一律正整数，数据库不存小数
5. 快捷语句 10 条文案由你提供或我拟初稿你改

## 六、实施顺序

1. 云开发 init + cloudfunctions 编译链路打通（uni-app 需自处理 cloudfunctionRoot，先验证）
2. 页面结构调整：2 tab + 房间/结算改普通页 + 首页进行中牌局卡片
3. users + 头像昵称
4. createRoom + 进房 + 小程序码/分享
5. room：成员列表 + 按局记分 + 点头像支付 + 快捷语句聊天
6. settle 结算 + settlement 页改造
7. 分享战绩图（canvas）
8. 广告扩容占位 + 边界场景补齐
