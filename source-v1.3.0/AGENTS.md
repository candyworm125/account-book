# 精简记账 PWA - 需求拆解文档

## 产品概述

- **产品类型**: 手机端记账工具应用（PWA）
- **场景类型**: <scene_type>prototype-app</scene_type>
- **目标用户**: 需要快速记账的手机用户，追求极简操作、语音输入便捷性
- **核心价值**: 一句话/一句话音即可完成记账，智能解析金额与分类，数据本地安全存储
- **界面语言**: 中文
- **主题偏好**: user_specified（暖白纸质账本风格，分类色彩标识）
- **导航模式**: 路径导航
- **导航布局**: 底部 Tab 导航（移动端优先，3 个 Tab：记账/明细/我的）

---

## 页面结构总览

| 页面名称 | 文件名 | 路由 | 页面类型 | 入口来源 |
|---------|-------|------|---------|---------|
| 记账页 | `RecordPage.tsx` | `/` | 一级 | 底部 Tab「记账」 |
| 明细页 | `HistoryPage.tsx` | `/history` | 一级 | 底部 Tab「明细」 |
| 我的页 | `ProfilePage.tsx` | `/profile` | 一级 | 底部 Tab「我的」 |

> **页面类型说明**：
> - **一级页面**：出现在底部 Tab 导航中，用户可直接切换访问
> - 本应用共 3 页，均为一级页面，与用户明确要求的底部 Tab 导航（记账/明细/我的）完全对应

---

## 页面布局建议

### 记账页 (RecordPage)

- **布局模式**: 单栏纵向布局（移动端优先）—— [理由：手机端单手操作，输入区在中上部便于触达，结果预览在下方滚动查看]
- **视觉重心**: 输入区（麦克风 + 文字输入框）—— [理由：核心操作是输入，首屏即应突出两种输入方式]
- **结果承载区**: 解析预览卡片列表区；初始态为 **空状态提示**（"点击麦克风说话，或输入一笔消费"），解析后展示可编辑卡片 + 「保存记账」按钮
- **关键元素**: 顶部标题栏 + 语音输入大按钮（≥44px）+ 文字输入框 + 解析预览卡片区 + 底部操作按钮

### 明细页 (HistoryPage)

- **布局模式**: 单栏列表布局 —— [理由：按日期分组的账单列表，纵向滚动是最自然的浏览方式]
- **视觉重心**: 记录列表 —— [理由：页面核心目标是查看历史记录]
- **结果承载区**: 日期分组列表 + 每日合计；无记录时展示空状态插画 + 引导文案
- **关键元素**: 顶部标题栏 + 日期分组列表（每组含日期+当日合计+记录条目）+ 左滑/点击删除

### 我的页 (ProfilePage)

- **布局模式**: 单栏卡片式布局 —— [理由：信息型页面，用卡片区分数据概览和导出功能]
- **视觉重心**: 数据概览卡片（累计支出、累计记录数）—— [理由：用户打开「我的」首先想知道总花费情况]
- **结果承载区**: 数据概览区 + 功能操作区（导出按钮）；数据实时从 localStorage 计算
- **关键元素**: 顶部标题栏 + 数据概览卡片 + 导出功能区（CSV 导出 + JSON 导出）+ 底部版本信息

---

## 导航配置

- **导航布局**: 底部 Tab Bar（移动端优先，固定底部，适配 iPhone 安全区域）
- **导航项**（仅一级页面）:

| 导航文字 | 路由 | 图标 |
|---------|------|------|
| 记账 | `/` | 记账/铅笔图标 |
| 明细 | `/history` | 列表/日历图标 |
| 我的 | `/profile` | 用户/设置图标 |

- **样式要求**:
  - 最大宽度 480px 居中
  - 触控目标 ≥ 44px × 44px
  - 适配 iPhone 底部安全区域（`env(safe-area-inset-bottom)`）
  - 暖白纸质风格背景，选中态使用主题强调色

---

## 数据来源声明

| 数据/操作 | 来源类型 | 实现要求 | mock 兜底 |
|---|---|---|---|
| 语音转文字 | real-plugin | 调用 Web Speech API（`SpeechRecognition` / `webkitSpeechRecognition`），将用户语音实时转为文字，供解析引擎消费 | 无（浏览器 API 不可用则 toast 提示"当前浏览器不支持语音识别"） |
| 智能文字解析 | local-persist（解析逻辑） | 前端实现解析引擎：正则提取金额（支持「元/块/花了/花费/块钱」等）、加法表达式求值、按句号/分号/换行拆分多笔、关键词匹配分类（多字词优先） | 无（纯前端逻辑，无需 mock） |
| 记账记录存储 | local-persist | localStorage key=`__app_account_book_records`，存储完整记账记录数组 | 无（用户首次使用为空，不预置 mock 数据） |
| 数据导出 CSV | import-export | 构造 CSV 字符串（日期,金额,一级分类,二级分类,备注），添加 UTF-8 BOM，Blob + a.click 触发下载，兼容 iOS Safari | 无 |
| 数据导出 JSON | import-export | 将记录数组序列化为 JSON，Blob + a.click 触发下载，兼容 iOS Safari | 无 |
| 数据概览（累计支出/记录数） | local-persist | 从 localStorage 读取记录后实时统计计算 | 无 |

> **说明**：语音识别使用浏览器原生 Web Speech API（非平台插件），按 `real-plugin` 思路声明但实现路径为浏览器 API。解析引擎为纯前端规则实现，不依赖 AI 插件。

---

## 功能列表

### 记账页 (RecordPage)

- **页面目标**: 通过语音或文字输入，快速解析并完成记账

- **功能点**:

  - **语音输入记账**
    - 触发: 点击麦克风大按钮
    - 交互: 调用 Web Speech API（兼容 `webkitSpeechRecognition`），开始录音时按钮变色 + 波纹动效 + 实时显示识别文字
    - 提交: 识别结束（`onresult`）后自动调用解析引擎，将结果渲染为预览卡片
    - 反馈: 录音中 → 视觉动效；识别失败 → toast 提示并降级为文字输入
    - 数据契约: 识别结果为 string，送入 `parseExpenseText(text)` 函数

  - **文字输入记账**
    - 触发: 在输入框中输入文字后点击「解析」按钮（或回车）
    - 交互: 获取输入框文本，调用解析引擎
    - 提交: 同语音输入，统一走解析引擎
    - 反馈: 解析成功 → 展示预览卡片；解析失败（无金额）→ toast 提示"未能识别金额，请检查输入"
    - 数据契约: 输入文本 string，送入 `parseExpenseText(text)` 函数

  - **智能文字解析引擎**
    - 金额提取: 正则匹配 `35元/35块/花了35/花费35/35块钱` 等表达，提取数值
    - 加法表达式: 识别 `数字+数字` 模式并自动求和（如 `280+480` → 760）
    - 多笔拆分: 按 `。/；/\n` 分割为多段，每段独立解析，返回多条记录
    - 分类匹配: 关键词字典匹配二级分类 → 映射一级分类；匹配优先级：多字词 > 短词，避免误匹配
    - 输出结构: `{ amount: number, category1: string, category2: string, remark: string }[]`

  - **解析预览与编辑**
    - 触发: 解析成功后在预览区展示卡片列表
    - 交互: 每张卡片可编辑金额（数字输入）、分类（一级+二级 Picker/Select）、备注（文本输入）
    - 提交: 点击「保存记账」按钮 → 批量写入 localStorage → 清空预览区 → toast 成功提示
    - 反馈: 保存成功 → toast「已记 X 笔账」+ 清空输入与预览
    - 数据契约: 预览记录数组，保存后追加到 `__app_account_book_records`

### 明细页 (HistoryPage)

- **页面目标**: 查看历史记账记录，支持删除

- **功能点**:

  - **按日期分组展示**
    - 触发: 进入页面 / 每次切换到该 Tab
    - 交互: 从 localStorage 读取所有记录，按日期（YYYY-MM-DD）倒序分组，每组显示日期 + 当日合计金额 + 记录条目列表
    - 数据契约: 按日期分组的 Map/对象，每组含 date、total、records[]

  - **记录条目展示**
    - 每条记录显示：二级分类图标/色彩标识 + 金额 + 备注（如有）
    - 分类色彩标识与一级分类对应（生活/交通/购物/医疗/餐饮/美业各一色）

  - **删除记录（二次确认）**
    - 触发: 点击记录条目右侧删除按钮（或左滑出现删除，移动端友好）
    - 交互: 弹出确认 Dialog「确定删除这条记录吗？」→ 确认后从数组中移除并重新保存
    - 反馈: toast「已删除」+ 列表即时更新 + 当日合计重新计算
    - 数据契约: 按记录 id（时间戳或 uuid）定位删除

  - **空状态处理**
    - 无记录时展示空状态插画 + 文案「还没有记账记录」+ 引导按钮「去记一笔」（跳转记账页）

### 我的页 (ProfilePage)

- **页面目标**: 查看数据概览 + 导出数据备份

- **功能点**:

  - **数据概览统计**
    - 触发: 进入页面 / 每次切换到该 Tab
    - 交互: 从 localStorage 读取记录，计算累计支出（总金额）、累计记录数，展示在概览卡片上
    - 数据契约: `{ totalAmount: number, totalCount: number }`

  - **导出 CSV 文件**
    - 触发: 点击「导出 CSV」按钮
    - 交互: 将记录数组格式化为 CSV（日期,金额,一级分类,二级分类,备注），添加 UTF-8 BOM（`\uFEFF`），创建 Blob，通过 `<a>` 标签 `click()` 触发下载
    - 兼容处理: iOS Safari 下使用 `URL.createObjectURL` + `document.createElement('a')` 方案，确保文件正常下载
    - 反馈: toast「CSV 文件已导出」
    - 数据契约: 输出文件名 `记账记录_YYYYMMDD.csv`

  - **导出 JSON 文件**
    - 触发: 点击「导出 JSON」按钮
    - 交互: 将记录数组 `JSON.stringify` 后创建 Blob，通过 `<a>` 标签触发下载
    - 反馈: toast「JSON 备份已导出」
    - 数据契约: 输出文件名 `记账备份_YYYYMMDD.json`

---

## 数据共享配置

| 存储键名 | 数据说明 | 使用页面 |
|---------|---------|---------|
| `__app_account_book_records` | 记账记录数组，类型为 `IAccountRecord[]` | 记账页、明细页、我的页 |

```ts
interface IAccountRecord {
  /** 唯一标识（时间戳或 uuid） */
  id: string;
  /** 金额（单位：元，正数） */
  amount: number;
  /** 一级分类：生活/交通/购物/医疗/餐饮/美业 */
  category1: string;
  /** 二级分类：如 打车、剪发、早饭 等 */
  category2: string;
  /** 备注 */
  remark: string;
  /** 记录日期时间戳（毫秒），用于按日期分组 */
  timestamp: number;
  /** 日期字符串 YYYY-MM-DD，便于分组计算 */
  date: string;
}
```

---

## 分类体系与色彩映射

> **供设计与代码阶段参考，明确一级分类与二级分类的对应关系及色彩标识**

| 一级分类 | 二级分类 | 主题色（建议） |
|---------|---------|-------------|
| 生活 | 日常、水电、装修、购房、其他 | 暖橙色系 |
| 交通 | 公交、打车、加油、停车、其他 | 天蓝色系 |
| 购物 | 服饰、数码、食品、其他 | 玫红色系 |
| 医疗 | 门诊、药品、体检、其他 | 草绿色系 |
| 餐饮 | 早饭、午饭、晚饭、宵夜、其他 | 橙黄色系 |
| 美业 | 剪发、染发、美容、护肤、其他 | 粉紫色系 |

> 关键词匹配优先级：先匹配长词（如「剪发」）再匹配短词（如「发」），避免误分类。

---

## 技术要求摘要

- **纯客户端**: 无后端，所有逻辑 + 数据存储均在浏览器端完成
- **PWA 支持**: `manifest.json`（应用名称、图标、启动 URL、standalone 模式）+ Service Worker（缓存静态资源，支持离线使用）
- **移动端优先**: 最大宽度 480px 居中，底部 Tab 导航
- **视觉风格**: 暖白纸质账本风格（米白底 + 细边 + 柔和阴影 + 分类色彩点缀）
- **iOS 兼容性**:
  - 语音识别使用 `webkitSpeechRecognition` 前缀兼容 iOS Safari
  - 文件导出使用 Blob + a.click 方案兼容 iOS Safari 下载
- **安全区域适配**: 使用 `env(safe-area-inset-bottom)` 适配 iPhone 底部 Home Indicator
- **触控目标**: 所有可点击区域 ≥ 44px × 44px

-------

<scene_type>prototype-app</scene_type>

# UI 设计指南

## 1. 设计推导依据

- **参考意图**: Free —— 无参考材料，按产品语义自主设计
- **核心情绪 / 应用类型**: 暖白纸质账本感的手机端记账工具，强调随手记、轻量、可信
- **独特记忆点**: 米白纸张底色 + 6 大分类各自的柔和色标，解析预览卡片用分类色左边条做视觉锚点

## 2. Art Direction

- **方向名**: 纸感账本
- **Design Style**: Warm Paper Minimal + Soft Color Tags —— 纸质底色营造账本手感，分类色标签承担识别功能，整体克制不抢信息
- **DNA 参数**: 圆角 rounded-xl（卡片）/ rounded-full（按钮、标签）；阴影 shadow-sm（卡片）/ shadow-none（输入）；间距 compact（gap-3 / p-4）；字体方向 Noto Sans SC 清晰人文；装饰手法 分类色左边条 + 细微纸张肌理
- **应用类型**: Tool —— 移动端竖屏单栏任务流

## 3. Color System

**色彩关系**: 暖米白纸面背景 + 深墨灰正文 + 赭石主色（CTA/品牌）+ 6 个低饱和分类色作为功能识别色
**配色设计理由**: 主色赭石承担记账按钮、tab 激活等核心交互；bg 用暖纸白呼应"纸质账本"调性；分类色通过左边条和小面积标签出现，不干扰正文阅读；accent 用浅米色承接 hover/选中态
**主色推导**: 赭石（暖棕红）来自传统账本印泥、皮革装订的色彩联想，比纯红更暖、比纯棕更有行动感，适合记账场景的"确认/保存"语义
**使用比例**: 65% 中性（纸白+墨灰）/ 25% 辅助（分类色+浅米accent）/ 10% primary（赭石）

| 角色 | CSS 变量 | Tailwind Class | HSL 值 | 设计说明 |
|---|---|---|---|---|
| bg | `--background` | `bg-background` | hsl(36 33% 96%) | 暖米白纸面背景 |
| card | `--card` | `bg-card` | hsl(40 30% 98%) | 卡片、预览面板，比背景略亮 |
| text | `--foreground` | `text-foreground` | hsl(24 15% 18%) | 深墨灰正文，纸面上的墨色 |
| textMuted | `--muted-foreground` | `text-muted-foreground` | hsl(25 10% 45%) | 辅助文字、日期、说明 |
| primary | `--primary` | `bg-primary` / `text-primary` | hsl(16 70% 45%) | 赭石主色，主按钮、CTA、激活 tab |
| primaryForeground | `--primary-foreground` | `text-primary-foreground` | hsl(30 40% 98%) | 主色上的文字，奶白色 |
| accent | `--accent` | `bg-accent` | hsl(36 30% 92%) | hover/focus 浅底、选中态背景 |
| accentForeground | `--accent-foreground` | `text-accent-foreground` | hsl(24 15% 25%) | accent 上的文字图标 |
| border | `--border` | `border-border` | hsl(30 15% 86%) | 输入框、卡片边界，纸边感 |

**语义色提示**:
- 分类色（6 个，用于左边条/小标签，饱和度均低于 primary）：
  - 生活 bg `hsl(45 70% 85%)` / border `hsl(45 50% 70%)` / text `hsl(35 40% 25%)`
  - 交通 bg `hsl(200 55% 88%)` / border `hsl(200 40% 72%)` / text `hsl(200 35% 25%)`
  - 购物 bg `hsl(340 50% 90%)` / border `hsl(340 35% 75%)` / text `hsl(340 30% 28%)`
  - 医疗 bg `hsl(160 40% 88%)` / border `hsl(160 30% 72%)` / text `hsl(160 25% 25%)`
  - 餐饮 bg `hsl(20 75% 88%)` / border `hsl(20 55% 72%)` / text `hsl(20 40% 28%)`
  - 美业 bg `hsl(280 40% 90%)` / border `hsl(280 25% 75%)` / text `hsl(280 25% 28%)`
- 删除/危险 bg `hsl(0 60% 92%)` / border `hsl(0 50% 78%)` / text `hsl(0 55% 35%)`，饱和度与 primary 对齐

## 4. 字体与节奏

- **font-display**: Noto Sans SC, 600~700 —— 人文无衬线，金额数字清晰有力，贴合纸笔记账感
- **font-body**: Noto Sans SC, 400~500 —— 中文阅读舒适，长时间看明细不累
- **字号**: 页面标题 text-2xl；金额大字 text-4xl（预览卡片主金额）；body text-base；muted text-sm；分类标签 text-xs
- **圆角**: 大（卡片 rounded-xl，按钮/标签 rounded-full）—— 圆润手感，像纸质便签

## 5. 全局布局契约

- **Reference Layout Use**: 按需求结构推导
- **Page / Section Order**: 三 tab 结构：记账（首页）/ 明细 / 我的，与需求一一对应
- **Standard Content Zone**: `max-w-[480px] mx-auto`，移动端优先，桌面端居中显示手机宽度
- **Shell / Frame Alignment**: 底部 Tab 栏与内容区同宽（均受 max-w-[480px] 约束），安全区独立适配（`pb-[env(safe-area-inset-bottom)]`）
- **Padding & Rhythm**: `px-4 py-4`，卡片内 `p-4`，列表项间距 `gap-3`，保持 4/8px 倍数节奏
- **Full-bleed Zones**: 无全宽装饰；顶部导航、底部 Tab 均在 480px 容器内
- **Local Narrowing**: 表单输入、导出按钮等操作区天然在单栏内，无需额外收窄
- **Overflow Strategy**: 明细列表垂直滚动；分类选择横向滚动时使用 `overflow-x-auto`
- **Flexibility Boundary**: 允许移动端调整卡片内边距和列表间距；不允许改变 max-w-[480px]、主色赭石、圆角体系、分类色左边条模式

## 6. 视觉与动效

- **装饰**: 分类色左边条 / 细微纸张噪点纹理（极低透明度）
- **阴影/边界**: 轻 —— 卡片 `shadow-sm`，输入框用 border 不用阴影
- **动效**: 克制 —— 按钮按压 `active:scale-95`，卡片出现轻微 fade-in，删除确认用底部滑入面板；无花哨转场

## 7. 组件原则

- 主按钮（保存/确认记账）用赭石 primary + rounded-full + shadow-sm，高度 ≥ 48px
- 语音按钮用圆形 primary 按钮，麦克风图标居中，录音中状态用脉冲呼吸动效
- 输入框：纸白底 + 1px border，focus 时 border-primary 且 2px 外发光（低不透明度）
- 预览卡片：左侧 4px 分类色条 + 白底 + rounded-xl，金额右对齐大字显示
- 明细列表项：左分类色圆点 + 中备注 + 右金额，点击无操作，左滑或长按显示删除
- 底部 Tab：3 项等宽，激活项用 primary 色图标+文字，未激活用 textMuted
- 所有可交互元素触控区域 ≥ 44×44px

## 8. Image Direction

- **Image Role**: 无强制图片需求，优先通过分类色彩、排版和纸质感建立视觉记忆点
- **Image Art Direction**: 无强制图片需求
- **Image Prompt Keywords**: 无
- **Image Avoidance**: 避免通用理财插图、硬币钞票堆素材图、无意义渐变背景

## 9. Anti-patterns

- **Split personality**: 三个 tab 页各自用不同的卡片圆角、底色或间距；全站统一纸感语言
- **Category color overflow**: 分类色铺满卡片背景或大面积使用；分类色只出现在 4px 左边条、小圆点或小标签上
- **Default SaaS drift**: 回到蓝色主按钮 + 纯白背景 + 大阴影卡片；坚持赭石主色 + 纸白底色 + 轻阴影
- **Invisible interaction**: 语音按钮、tab、列表项只有视觉样式没有 focus-visible 状态
- **Mono-hue tyranny**: 赭石同时用于主按钮、tab 激活、icon、边框、金额数字；primary 只给主 CTA 和当前 tab，金额用 text-foreground
- **Tiny touch targets**: 图标按钮、分类标签、删除按钮小于 44px；所有触控目标保证 44×44px 最小热区