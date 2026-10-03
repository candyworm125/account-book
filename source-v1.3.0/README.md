# 精简记账 PWA

> 一句话 / 一句话音即可完成记账，智能解析金额与分类，数据本地安全存储

---

## 一、产品概述

- **产品类型**：手机端记账工具应用（PWA）
- **目标用户**：需要快速记账的手机用户，追求极简操作、语音输入便捷性
- **核心价值**：一句话/一句话音即可完成记账，智能解析金额与分类，数据本地安全存储
- **界面语言**：中文
- **主题风格**：暖白纸质账本风格 + 分类色彩标识
- **导航模式**：底部 Tab 导航（记账 / 明细 / 我的）

> **无服务端、无 AI 模型调用**
> - 语音识别使用浏览器原生 **Web Speech API**（`SpeechRecognition` / `webkitSpeechRecognition`）
> - 智能解析使用**本地规则引擎**（正则匹配 + 关键词字典）
> - 所有数据存储在浏览器 **localStorage**，不上传任何服务器

---

## 二、目录结构

```
account-book/
├── index.html                 # 入口 HTML
├── package.json               # 依赖配置
├── vite.config.ts             # Vite 构建配置
├── tsconfig.json              # TS 根配置
├── tsconfig.app.json          # TS 应用配置
├── tsconfig.node.json         # TS Node 配置
├── components.json            # shadcn/ui 配置
├── public/
│   ├── manifest.json          # PWA 应用清单
│   ├── sw.js                  # Service Worker（离线缓存）
│   └── icons/                 # PWA 图标（192/512）
└── src/
    ├── index.tsx              # 应用入口
    ├── app.tsx                # 路由配置
    ├── index.css              # 全局样式入口
    ├── tailwind-theme.css     # Tailwind 主题变量
    ├── typography.css         # 排版样式（typography 插件）
    ├── data/
    │   └── account.ts         # 类型定义 + 分类体系 + 关键词字典
    ├── hooks/
    │   └── use-speech-recognition.ts  # 语音识别 Hook
    ├── lib/
    │   ├── utils.ts           # 工具函数（cn 等）
    │   ├── parser.ts          # 智能解析引擎（核心）
    │   ├── storage.ts         # 存储层（localStorage 封装）
    │   ├── exporter.ts        # CSV / JSON 导出
    │   └── version.ts         # 版本号（单一真相源）
    ├── components/
    │   ├── Layout.tsx         # 布局 + 底部 Tab 导航
    │   └── ui/                # shadcn/ui 组件库
    └── pages/
        ├── RecordPage/
        │   └── RecordPage.tsx    # 记账页（首页）
        ├── HistoryPage/
        │   └── HistoryPage.tsx   # 明细页
        ├── ProfilePage/
        │   └── ProfilePage.tsx   # 我的页
        └── NotFoundPage/
            └── NotFoundPage.tsx  # 404 页
```

---

## 三、解析引擎管线

智能解析引擎按以下严格顺序执行，每一步的输出作为下一步的输入：

```
输入文本
  │
  ▼
① 多笔拆分 → 按 。/ ；/\n 分割为多条独立记录
  │
  ▼
② 日期提取 → 从原文本中提取日期（YYYY-MM-DD）
  │
  ▼
③ 日期剥离 → 从文本中移除所有日期表达（为金额提取扫清干扰）
  │
  ▼
④ 金额提取 → 在"已剥离日期"的文本上提取金额
  │   优先级：储值实付 > ¥符号 > 带单位 > 花费动词 >
  │            转账表达 > 总计类 > 加法表达式 > 句尾数字兜底
  ▼
⑤ 分类匹配 → 关键词匹配二级分类，映射一级分类（多字词优先）
  │
  ▼
⑥ 备注生成 → 去除日期、金额、分类关键词后的剩余文本
  │
  ▼
输出 IParsedRecord[]
```

### 🔴 关键不变量

- **金额提取 MUST 作用于"已剥离日期"的文本** — 任何金额相关的正则都不允许直接作用于原始文本
- **日期数字绝不会被当成金额** — 因为金额提取前自动剥离日期
- **多字词优先匹配** — 关键词按长度倒序排列，先匹配长词避免误分类

### 支持的金额表达

| 类型 | 示例 | 结果 |
|------|------|------|
| ¥ 符号 | `¥600`、`¥45.5` | 600、45.5 |
| 带单位 | `35元`、`35块`、`35块钱` | 35 |
| 花费动词 | `花了35`、`消费35`、`花费45.5元` | 35、45.5 |
| 转账表达 | `给宝宝转600`、`转给妈妈500`、`微信转了¥300` | 600、500、300 |
| 加法表达式 | `280+480` | 760 |
| 储值场景 | `储值500，补交100` | 100（实付） |
| 句尾数字兜底 | `打车35` | 35 |

### 支持的日期表达

| 类型 | 示例 |
|------|------|
| 绝对日期 | `8月22日`、`8月22号`、`22号` |
| 相对时间 | `今天`、`昨天`、`前天`、`大前天` |
| 星期表达 | `周一`、`上周三`、`礼拜五` |

---

## 四、分类体系

| 一级分类 | 二级分类 | 主题色系 |
|---------|---------|---------|
| 生活 | 日常、水电、装修、购房、其他 | 暖橙色系 |
| 交通 | 公交、打车、加油、停车、其他 | 天蓝色系 |
| 购物 | 服饰、数码、食品、其他 | 玫红色系 |
| 医疗 | 门诊、药品、体检、其他 | 草绿色系 |
| 餐饮 | 早饭、午饭、晚饭、宵夜、其他 | 橙黄色系 |
| 美业 | 剪发、染发、美容、护肤、其他 | 粉紫色系 |

分类色彩仅用于左边条 / 小圆点 / 小标签，小面积点缀，不干扰正文阅读。

---

## 五、核心数据结构

```ts
interface IAccountRecord {
  id: string;           // 唯一标识
  amount: number;       // 金额（元，正数）
  category1: string;    // 一级分类
  category2: string;    // 二级分类
  remark: string;       // 备注
  timestamp: number;    // 时间戳（毫秒）
  date: string;         // YYYY-MM-DD
}
```

存储 key：`__account_book_records_v1__`（固定常量，浏览器模式与 PWA standalone 模式共享同一份数据）

---

## 六、功能清单

### 记账页 (RecordPage)

- 🎤 **语音输入记账**：Web Speech API 实时转文字，录音中脉冲呼吸动效
- ⌨️ **文字输入记账**：输入框 + 解析按钮，支持多笔用句号/分号分隔
- 🧠 **智能文字解析**：金额提取、加法表达式求值、多笔拆分、分类匹配
- ✏️ **解析预览与编辑**：卡片式预览，可修改金额/日期/分类/备注，单条删除
- 💾 **保存记账**：批量写入 localStorage，成功后清空预览区

### 明细页 (HistoryPage)

- 📅 **按日期分组**：倒序排列，每组显示日期 + 当日合计 + 记录条目
- 🗑️ **删除记录**：二次确认弹窗，删除后即时更新
- ✏️ **编辑记录**：弹窗内修改金额、日期、分类、备注
- 📭 **空状态**：无记录时展示引导 + 跳转记账页

### 我的页 (ProfilePage)

- 📊 **数据概览**：累计支出、累计记录数
- 📁 **数据诊断**：运行模式、URL、存储 key、原始条数、旧 key 扫描
- 🔄 **版本与更新**：SW 状态检查、强制更新
- 📤 **导出 CSV**：UTF-8 BOM，Excel 可直接打开
- 📦 **导出 JSON**：完整数据备份，可用于导入恢复

---

## 七、本地运行方法

### 环境要求

- Node.js >= 18
- npm 或 pnpm

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

默认启动在 `http://localhost:5173`（具体端口以实际输出为准）。

### 构建生产版本

```bash
npm run build
```

构建产物在 `dist/` 目录。

### 预览生产构建

```bash
npm run preview
```

---

## 八、部署说明

### 静态部署

将 `dist/` 目录上传到任意静态文件服务器（Nginx、Vercel、Netlify、Cloudflare Pages 等）即可。

### PWA 要求

- 必须使用 HTTPS（localhost 除外）
- `manifest.json` 和 `sw.js` 必须在根路径可访问
- Service Worker 只能缓存同源资源

### 子路径部署

如果部署在子路径（如 `/app/account-book/`），需在 `vite.config.ts` 中配置 `base`：

```ts
export default defineConfig({
  base: '/app/account-book/',
  // ...
})
```

---

## 九、技术栈

| 类别 | 技术 |
|------|------|
| 框架 | React 19 + TypeScript |
| 构建 | Vite 8 |
| 样式 | Tailwind CSS 4 |
| UI 组件 | shadcn/ui (new-york 风格) |
| 路由 | react-router-dom v7 |
| 动画 | framer-motion |
| 图标 | lucide-react |
| 表单 | react-hook-form + zod |
| 语音识别 | Web Speech API (浏览器原生) |
| 存储 | localStorage |
| 离线 | Service Worker (Network-First 策略) |
| PWA | manifest.json + Service Worker |

---

## 十、版本记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.3.0 | 2026-08-27 | 解析引擎升级：日期提取前置剥离、储值抵扣识别、X.X日期格式排除、防回归测试用例、数据迁移合并、数据诊断面板 |
| v1.2.0 | 2026-08-20 | 新增编辑记录功能、分类色左边条、JSON 导出 |
| v1.1.0 | 2026-08-15 | 新增语音识别、多笔拆分、加法表达式支持 |
| v1.0.0 | 2026-08-10 | 首版发布：文字输入记账、明细查看、CSV 导出 |

---

## 十一、浏览器兼容性

| 浏览器 | 语音识别 | 离线缓存 | 备注 |
|--------|---------|---------|------|
| Chrome (桌面/Android) | ✅ | ✅ | 完整支持 |
| Safari (iOS 14.5+) | ✅ | ✅ | 使用 webkit 前缀 |
| Safari (macOS 14.1+) | ✅ | ✅ | 使用 webkit 前缀 |
| Edge | ✅ | ✅ | 基于 Chromium |
| Firefox | ❌ | ✅ | 不支持 Web Speech API，降级为文字输入 |

> 语音识别不可用时，应用自动降级为纯文字输入模式，不影响核心记账功能。

---

## 十二、隐私与安全

- ✅ 所有数据保存在浏览器本地（localStorage），不上传任何服务器
- ✅ 语音识别使用浏览器原生 API，数据直接发往浏览器厂商的语音服务（不由本应用控制）
- ✅ 无用户账号、无登录、无埋点、无第三方统计
- ✅ 建议定期导出 CSV/JSON 备份，避免清理浏览器数据导致记录丢失
