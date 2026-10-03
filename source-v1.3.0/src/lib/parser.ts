// ============================================================================
//  解析引擎 - 精简记账 PWA
// ============================================================================
//
//  ⚠️  解析管线（PARSING PIPELINE）- 严格顺序，禁止打乱
//
//  输入文本
//    │
//    ▼
//  ① 多笔拆分  → 按 。/；/\n 分割为多条独立记录
//    │
//    ▼
//  ② 日期提取  → 从原文本中提取日期（YYYY-MM-DD）
//    │
//    ▼
//  ③ 日期剥离  → 从文本中移除所有日期表达（为金额提取扫清干扰）
//    │
//    ▼
//  ④ 金额提取  → 在"已剥离日期"的文本上提取金额
//    │            优先级：储值实付 > ¥符号 > 带单位 > 花费动词 >
//    │                      转账表达 > 加法表达式 > 句尾数字兜底
//    ▼
//  ⑤ 分类匹配  → 关键词匹配二级分类，映射一级分类
//    │
//    ▼
//  ⑥ 备注生成  → 去除日期、金额、分类关键词后的剩余文本
//    │
//    ▼
//  输出 IParsedRecord[]
//
//  🔴 关键不变量：金额提取 MUST 作用于"已剥离日期"的文本
//     任何金额相关的正则都不允许直接作用于原始文本
//
// ============================================================================

import { getSortedKeywords, type IParsedRecord } from '@/data/account';

let sortedKeywords: [string, { category1: string; category2: string }][] | null = null;

function getKeywords() {
  if (!sortedKeywords) {
    sortedKeywords = getSortedKeywords();
  }
  return sortedKeywords;
}

// ============================================================================
//  ② 日期提取
// ============================================================================

/** 格式化日期为 YYYY-MM-DD */
function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 获取今天 0 点的 Date 对象（用于日期比较，不受时分秒影响） */
function getTodayZero(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * 星期几文本 → 数字（0=周日, 1=周一, ... 6=周六）
 * 支持：周一~周日、星期X、礼拜X、周X
 */
function parseWeekday(text: string): number | null {
  const map: Record<string, number> = {
    '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0,
    '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 0, '0': 0,
  };
  const match = text.match(/(?:周|星期|礼拜)([一二三四五六日天1-70])/);
  if (!match) return null;
  return map[match[1]] ?? null;
}

/**
 * 从文本中提取日期
 * 优先级：绝对日期（X月X日/X号）> 相对时间词（今天/昨天/前天）> 星期词 > null
 * 返回 YYYY-MM-DD 字符串，未识别到返回 null
 */
function extractDate(text: string, today: Date = getTodayZero()): string | null {
  if (!text) return null;

  // ---------- 1. 绝对日期：X月X号/日 ----------
  const mdRegex = /(\d{1,2})月(\d{1,2})(?:号|日|号)?/;
  const mdMatch = text.match(mdRegex);
  if (mdMatch) {
    const month = parseInt(mdMatch[1], 10);
    const day = parseInt(mdMatch[2], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      let year = today.getFullYear();
      const candidate = new Date(year, month - 1, day);
      if (candidate.getTime() > today.getTime()) {
        year -= 1;
      }
      return formatDate(new Date(year, month - 1, day));
    }
  }

  // ---------- 2. 绝对日期：X号/日 ----------
  const dayRegex = /(?:^|[^月\d])(\d{1,2})(?:号|日)(?!\d)/;
  const dayMatch = text.match(dayRegex);
  if (dayMatch) {
    const day = parseInt(dayMatch[1], 10);
    if (day >= 1 && day <= 31) {
      let year = today.getFullYear();
      let month = today.getMonth();
      if (day > today.getDate()) {
        month -= 1;
        if (month < 0) {
          month = 11;
          year -= 1;
        }
      }
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      if (day <= daysInMonth) {
        return formatDate(new Date(year, month, day));
      }
    }
  }

  // ---------- 2b. 绝对日期：X.X 格式（如 8.23 = 8月23日，月.日） ----------
  // 只匹配 1-12 月 + 1-31 日，且前后不是数字（避免误匹配金额小数）
  const mdDotRegex = /(?:^|[^\d.])(\d{1,2})\.(\d{1,2})(?:[^\d.]|$)/;
  const mdDotMatch = text.match(mdDotRegex);
  if (mdDotMatch) {
    const month = parseInt(mdDotMatch[1], 10);
    const day = parseInt(mdDotMatch[2], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      let year = today.getFullYear();
      const candidate = new Date(year, month - 1, day);
      if (candidate.getTime() > today.getTime()) {
        year -= 1;
      }
      const daysInMonth = new Date(year, month, 0).getDate();
      if (day <= daysInMonth) {
        return formatDate(new Date(year, month - 1, day));
      }
    }
  }

  // ---------- 3. 相对时间词 ----------
  if (/今天|今日/.test(text)) return formatDate(today);
  if (/昨天|昨日/.test(text)) {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    return formatDate(d);
  }
  if (/前天/.test(text)) {
    const d = new Date(today);
    d.setDate(d.getDate() - 2);
    return formatDate(d);
  }
  if (/大前天/.test(text)) {
    const d = new Date(today);
    d.setDate(d.getDate() - 3);
    return formatDate(d);
  }
  if (/明天|明日/.test(text)) {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return formatDate(d);
  }

  // ---------- 4. 上周X / 上周 ----------
  const lastWeekRegex = /上周([一二三四五六日天1-70]?)/;
  const lastWeekMatch = text.match(lastWeekRegex);
  if (lastWeekMatch) {
    const wdChar = lastWeekMatch[1];
    if (wdChar) {
      const targetWd = parseWeekday(lastWeekMatch[0]);
      if (targetWd !== null) {
        const todayWd = today.getDay();
        let diff = todayWd - targetWd;
        if (diff < 0) diff += 7;
        const d = new Date(today);
        d.setDate(d.getDate() - diff - 7);
        return formatDate(d);
      }
    }
    const d = new Date(today);
    const diff = today.getDay() + 7;
    d.setDate(d.getDate() - diff);
    return formatDate(d);
  }

  // ---------- 5. 本周X / 周X / 星期X / 礼拜X ----------
  const weekday = parseWeekday(text);
  if (weekday !== null) {
    const todayWd = today.getDay();
    let diff = todayWd - weekday;
    if (diff < 0) diff += 7;
    const d = new Date(today);
    d.setDate(d.getDate() - diff);
    return formatDate(d);
  }

  return null;
}

// ============================================================================
//  ③ 日期剥离（金额提取的强制前置步骤）
// ============================================================================

/**
 * 🔴 从文本中移除所有日期相关表达
 *
 * 这是金额提取的强制前置步骤。目的：
 * - "8月22日" 中的 8 和 22 都不能被金额提取当成金额
 * - "昨天"、"上周三" 等词也一并清除，避免含数字的日期表达干扰
 *
 * ⚠️  注意：X.X 格式（如 8.23）不在此处整体替换，避免误伤金额小数（如 45.5）
 *        在金额提取的"句尾数字兜底"步骤中，再单独排除看起来像日期的小数
 *
 * 支持的日期格式：
 *   - X月X日 / X月X号 / X月X号日
 *   - X号 / X日（前面不带"月"）
 *   - 今天 / 今日 / 昨天 / 昨日 / 前天 / 大前天 / 明天 / 明日
 *   - 上周X / 上周 / 本周X / 周X / 星期X / 礼拜X
 */
function stripDateExpressions(text: string): string {
  let result = text;
  // X月X日 / X月X号（如 8月22日、8月22号）
  result = result.replace(/\d{1,2}月\d{1,2}(?:号|日)?/g, ' ');
  // X号 / X日（如 22号、5日，前面不带"月"）
  result = result.replace(/(^|[^月\d])\d{1,2}(?:号|日)(?!\d)/g, '$1 ');
  // 相对时间词
  result = result.replace(/今天|今日|昨天|昨日|前天|大前天|明天|明日/g, ' ');
  // 上周X / 上周
  result = result.replace(/上周[一二三四五六日天1-70]?/g, ' ');
  // 本周X / 周X / 星期X / 礼拜X
  result = result.replace(/(?:本周|周|星期|礼拜)[一二三四五六日天1-70]/g, ' ');
  return result;
}

// ============================================================================
//  ④ 金额提取
// ============================================================================
//
//  🔴 不变量：所有金额提取逻辑 MUST 接收"已剥离日期"的文本
//     即调用者必须先调用 stripDateExpressions()
//
//  优先级（从高到低）：
//    1. 储值场景实付金额（补交/实付/支付 等）
//    2. ¥ 符号金额（¥600、¥ 45.5、¥300元）
//    3. 带单位金额（35元、35块、35块钱）
//    4. X块X（15块5 = 15.5）
//    5. 花费动词（花了35、花费35、消费35）
//    6. 转账表达（给XX转600、转给XX 500、转了1000）
//    7. 总计类（一共X、总共X、合计X）
//    8. 加法表达式（280+480 = 760）
//    9. 句尾数字兜底（最后手段，排除像日期的 X.X 格式）
//
// ============================================================================

/**
 * 储值/余额 场景识别与实付金额提取
 *
 * 优先级：补交/实付/付款/支付/现金 > 普通花费 > 原价/标价 > 储值余额（永远不算）
 *
 * ⚠️  接收的 text 必须是"已剥离日期"的文本
 */
function extractStoredValueAmount(text: string): { amount: number | null; isStoredValue: boolean } {
  // 先判断是否为储值/抵扣/余额场景
  const hasStoredValue = /储值|余额|卡里|卡内|充值|抵扣|已付|补交|实付|到账/.test(text);
  if (!hasStoredValue) {
    return { amount: null, isStoredValue: false };
  }

  // ---------- 1. 最高优先级：补交/实付/付款/支付/现金 后的金额 ----------
  const payPatterns = [
    /(?:补交|补缴|补付|补了)\s*¥?\s*(\d+(?:\.\d+)?)\s*(?:元|块钱?|块)?/g,
    /(?:实付|实际支付|实际花了|实际花)\s*¥?\s*(\d+(?:\.\d+)?)\s*(?:元|块钱?|块)?/g,
    /(?:又付|自己付|自己出|自付|自费)\s*¥?\s*(\d+(?:\.\d+)?)\s*(?:元|块钱?|块)?/g,
    /(?:只付|只花|只交|只要付|只要)\s*¥?\s*(\d+(?:\.\d+)?)\s*(?:元|块钱?|块)?/g,
    /(?:付了|支付了|花了|付现金|现金)\s*¥?\s*(\d+(?:\.\d+)?)\s*(?:元|块钱?|块)?/g,
  ];

  for (const pattern of payPatterns) {
    const matches = [...text.matchAll(pattern)];
    if (matches.length > 0) {
      // 取最后一个匹配（通常句尾是总结性表达）
      const last = matches[matches.length - 1];
      const val = parseFloat(last[1]);
      if (val > 0) {
        return { amount: val, isStoredValue: true };
      }
    }
  }

  // ---------- 2. "因此只X"、"所以只X" 句式 ----------
  const thereforeRegex = /(?:因此|所以|于是|故)(?:只|才|仅仅|就)\s*¥?\s*(\d+(?:\.\d+)?)\s*(?:元|块钱?|块)?/;
  const thereforeMatch = text.match(thereforeRegex);
  if (thereforeMatch) {
    const val = parseFloat(thereforeMatch[1]);
    if (val > 0) {
      return { amount: val, isStoredValue: true };
    }
  }

  // ---------- 3. 有储值但没明确实付 —— 尝试找"花了/花费/消费"金额 ----------
  const spendRegex = /(?:花了|花费|用掉|用了|花掉|花|花了我|消费)\s*¥?\s*(\d+(?:\.\d+)?)\s*(?:元|块钱?|块)?/g;
  const spendMatches = [...text.matchAll(spendRegex)];
  if (spendMatches.length > 0) {
    // 过滤掉紧跟在 "储值/余额/充值" 后面的金额
    for (let i = spendMatches.length - 1; i >= 0; i--) {
      const m = spendMatches[i];
      const beforeText = text.slice(0, m.index ?? 0);
      const recentContext = beforeText.slice(-15);
      if (/储值|余额|卡里|卡内|充值$/.test(recentContext)) {
        continue;
      }
      const val = parseFloat(m[1]);
      if (val > 0) {
        return { amount: val, isStoredValue: true };
      }
    }
  }

  // ---------- 4. 还是没找到，返回 null（由上层走普通金额提取兜底） ----------
  return { amount: null, isStoredValue: true };
}

/**
 * 🔴 金额提取主入口
 *
 * 先剥离日期 → 再按优先级逐级尝试金额匹配
 *
 * ⚠️  这是金额提取的唯一公开入口。任何需要提取金额的地方都必须走这里，
 *     以确保日期剥离不会被跳过。
 */
function extractAmount(text: string): number | null {
  if (!text) return null;

  // ─── 强制前置：剥离日期表达式（确保日期数字绝不参与金额匹配）───
  const cleanText = stripDateExpressions(text);

  // 是否包含折扣关键词（用于后续兜底时过滤折扣数字）
  const hasDiscount = /打.*?折|折扣|折后/.test(cleanText);

  // 1. 储值抵扣场景（最高优先级，因为里面有很多干扰数字）
  const svResult = extractStoredValueAmount(cleanText);
  if (svResult.isStoredValue && svResult.amount !== null) {
    return svResult.amount;
  }

  // 2. ¥ 人民币符号金额（高优先级，¥ 明确表示金额）
  //    支持：¥600、¥ 600、¥600元、¥600块、¥45.5
  const yuanSymbolRegex = /¥\s*(\d+(?:\.\d+)?)\s*(?:元|块钱?|块)?/i;
  const yuanSymbolMatch = cleanText.match(yuanSymbolRegex);
  if (yuanSymbolMatch) {
    const val = parseFloat(yuanSymbolMatch[1]);
    if (val > 0) return val;
  }

  // 3. 带单位金额（X元/X块/X块钱/X大洋/rmb）
  const unitRegex = /(\d+(?:\.\d+)?)\s*(?:元|块钱?|块(?!\d)|块钱|大洋|rmb|RMB)/i;
  const unitMatch = cleanText.match(unitRegex);
  if (unitMatch) {
    const val = parseFloat(unitMatch[1]);
    if (val > 0) return val;
  }

  // 4. "X块X"（如 15块5 = 15.5）
  const kuaiRegex = /(\d+)\s*块\s*(\d)/;
  const kuaiMatch = cleanText.match(kuaiRegex);
  if (kuaiMatch) {
    const val = parseFloat(`${kuaiMatch[1]}.${kuaiMatch[2]}`);
    if (val > 0) return val;
  }

  // 5. 花费动词（花了/花费/用了/消费 等）
  const spendRegex = /(?:花了|花费|用掉|用了|花掉|花|用|花了我|花了个|消费)\s*¥?\s*(\d+(?:\.\d+)?)/;
  const spendMatch = cleanText.match(spendRegex);
  if (spendMatch) {
    const val = parseFloat(spendMatch[1]);
    if (val > 0) return val;
  }

  // 6. 转账/转款类表达
  //    支持：给XX转XXX、转给XX XXX、微信转了XXX、支付宝转XXX、转了XXX
  //    支持 ¥ 符号：给宝宝转¥600、转给妈妈¥500
  const transferRegex = /(?:(?:给|为|替|帮)[^转]{0,10}?转(?:了|给)?|转(?:给|了)?)\s*¥?\s*(\d+(?:\.\d+)?)\s*(?:元|块钱?|块)?/;
  const transferMatch = cleanText.match(transferRegex);
  if (transferMatch) {
    const val = parseFloat(transferMatch[1]);
    if (val > 0) return val;
  }

  // 7. "一共X"、"总共X"、"合计X"
  const totalRegex = /(?:一共|总共|合计|总计|花了共)\s*¥?\s*(\d+(?:\.\d+)?)/;
  const totalMatch = cleanText.match(totalRegex);
  if (totalMatch) {
    const val = parseFloat(totalMatch[1]);
    if (val > 0) return val;
  }

  // 8. 加法表达式（280+480 直接当总价）
  //    排除折扣场景（如"打85折后238"中的85不是金额）
  if (!hasDiscount) {
    const addExprRegex = /¥?\s*(\d+(?:\.\d+)?)\s*\+\s*¥?\s*(\d+(?:\.\d+)?)/g;
    const addMatches = cleanText.match(addExprRegex);
    if (addMatches && addMatches.length > 0) {
      let total = 0;
      for (const expr of addMatches) {
        const nums = expr.match(/\d+(?:\.\d+)?/g);
        if (nums) {
          total += nums.reduce((a, b) => a + parseFloat(b), 0);
        }
      }
      if (total > 0) return Math.round(total * 100) / 100;
    }
  }

  // 9. 句尾数字兜底（最后手段，最宽松）
  //    - 折扣场景跳过 10-99 的整数
  //    - 跳过看起来像「月.日」的小数（整数1-12，小数1-31，且都≤2位）
  const suffixNumRegex = /(?:[^\d]|^)(\d+(?:\.\d+)?)(?:$|[^\d])/g;
  for (const m of cleanText.matchAll(suffixNumRegex)) {
    const val = parseFloat(m[1]);
    // 折扣场景下，跳过 10-99 的整数（很可能是折扣数字）
    if (hasDiscount && val >= 10 && val < 100 && Number.isInteger(val)) {
      continue;
    }
    // 跳过看起来像「月.日」格式的小数
    if (!Number.isInteger(val)) {
      const [intPart, decPart] = m[1].split('.');
      const intNum = parseInt(intPart, 10);
      const decNum = parseInt(decPart, 10);
      if (
        intPart.length <= 2 &&
        decPart.length <= 2 &&
        intNum >= 1 &&
        intNum <= 12 &&
        decNum >= 1 &&
        decNum <= 31
      ) {
        continue;
      }
    }
    if (val >= 0.5 && val <= 999999) {
      return val;
    }
  }

  return null;
}

// ============================================================================
//  ⑤ 分类匹配
// ============================================================================

/**
 * 从文本中匹配分类
 * 多字词优先于短词（getSortedKeywords 已按长度倒序排列）
 */
function matchCategory(text: string): { category1: string; category2: string } | null {
  const keywords = getKeywords();
  for (const [keyword, cat] of keywords) {
    if (text.includes(keyword)) {
      return cat;
    }
  }
  return null;
}

// ============================================================================
//  ① 多笔拆分
// ============================================================================

/**
 * 拆分多笔消费
 * 按 。/；/\n 拆分为多段（逗号不拆，因为可能是句内停顿）
 */
function splitRecords(text: string): string[] {
  const parts = text
    .split(/[。；;；\n\r]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return parts.length > 0 ? parts : [text.trim()];
}

// ============================================================================
//  ⑥ 备注生成
// ============================================================================

/**
 * 储值场景下生成详细备注
 * 整理原价、折扣、储值余额、抵扣、实付等信息
 */
function makeStoredValueRemark(text: string, actualAmount: number): string {
  const pieces: string[] = [];

  // 提取原价（加法表达式）
  const addExprRegex = /(\d+(?:\.\d+)?)\s*\+\s*(\d+(?:\.\d+)?)/g;
  const addMatches = [...text.matchAll(addExprRegex)];
  if (addMatches.length > 0) {
    const expr = addMatches[0][0].replace(/\s+/g, '');
    const parts = addMatches[0][0].split('+').map((p) => parseFloat(p.trim()));
    const total = parts.reduce((a, b) => a + b, 0);
    pieces.push(`原价${expr}=${total}`);
  }

  // 提取折扣信息
  const discountMatch = text.match(/(?:打|)(\d+(?:\.\d+)?)折/);
  if (discountMatch) {
    pieces.push(`${discountMatch[1]}折`);
  }

  // 折后价
  const afterDiscountMatch = text.match(/折后\s*(\d+(?:\.\d+)?)/);
  if (afterDiscountMatch) {
    pieces.push(`折后${afterDiscountMatch[1]}`);
  }

  // 储值余额
  const balanceRegex = /(?:储值|余额|卡里|卡内|充值)(\d+(?:\.\d+)?)\s*(?:元|块钱?|块)?/g;
  const balanceMatches = [...text.matchAll(balanceRegex)];
  if (balanceMatches.length > 0) {
    const last = balanceMatches[balanceMatches.length - 1];
    const label = last[0].includes('储值')
      ? '储值'
      : last[0].includes('余额')
        ? '余额'
        : last[0].includes('充值')
          ? '充值'
          : '卡里';
    pieces.push(`${label}${last[1]}`);
  }

  // 抵扣金额
  const deductMatch = text.match(/抵扣\s*(\d+(?:\.\d+)?)/);
  if (deductMatch) {
    pieces.push(`抵扣${deductMatch[1]}`);
  }

  // 实付
  pieces.push(`实付${actualAmount}`);

  return pieces.join('，');
}

/**
 * 生成备注
 * - 储值场景：整理原价/折扣/储值/抵扣/实付等细节
 * - 普通场景：去除日期、金额、分类关键词后的剩余文本
 */
function makeRemark(
  text: string,
  amount: number,
  _category1: string,
  _category2: string,
): string {
  // 检查是否为储值场景
  const svResult = extractStoredValueAmount(stripDateExpressions(text));
  if (svResult.isStoredValue) {
    return makeStoredValueRemark(text, amount);
  }

  let remark = text;

  // 移除日期相关表达
  remark = stripDateExpressions(remark);
  // 移除 X.X 格式日期（如 8.23）
  remark = remark.replace(/(?:^|[^\d.])\d{1,2}\.\d{1,2}(?:[^\d.]|$)/g, ' ');

  // 移除金额相关表达
  remark = remark.replace(/¥\s*\d+(?:\.\d+)?\s*(?:元|块钱?|块)?/g, '');
  remark = remark.replace(/\d+(?:\.\d+)?\s*元/g, '');
  remark = remark.replace(/\d+(?:\.\d+)?\s*块钱?/g, '');
  remark = remark.replace(/\d+\s*块\s*\d/g, '');
  remark = remark.replace(/(?:花了|花费|用了|花|用)\s*¥?\s*\d+(?:\.\d+)?/g, '');
  remark = remark.replace(
    /(?:给[^转]{0,10}?转(?:了|给)?|转(?:给|了)?)\s*¥?\s*\d+(?:\.\d+)?\s*(?:元|块钱?|块)?/g,
    '',
  );
  remark = remark.replace(/\d+(?:\.\d+)?\s*\+\s*\d+(?:\.\d+)?/g, '');
  remark = remark.replace(/(?:一共|总共|合计|总计)\s*¥?\s*\d+(?:\.\d+)?/g, '');

  // 移除等于记账金额的纯数字
  const amountStr = amount.toString();
  if (Math.floor(amount) === amount) {
    const re = new RegExp(`(?<!\\d)${Math.floor(amount)}(?!\\d)`);
    remark = remark.replace(re, '');
  } else {
    remark = remark.replace(amountStr, '');
  }

  // 清理标点和空白
  remark = remark.replace(/[，,。.；;！!？?、\s]+/g, ' ').trim();

  if (remark.length > 40) {
    remark = remark.slice(0, 40);
  }

  return remark;
}

// ============================================================================
//  主解析函数（按管线顺序执行）
// ============================================================================

/**
 * 解析单条消费文本（按管线顺序执行）
 *
 * 管线顺序：日期提取 → 金额提取 → 分类匹配 → 备注生成
 *
 * ⚠️  金额提取内部已包含"日期剥离"强制前置步骤，
 *     确保日期数字绝不会被当成金额。
 */
function parseSingle(text: string): IParsedRecord | null {
  // 1. 日期提取（从原文本中提取日期）
  const date = extractDate(text);

  // 2. 金额提取（内部自动做日期剥离，确保日期数字不干扰）
  const amount = extractAmount(text);
  if (amount === null || amount <= 0) return null;

  // 3. 分类匹配
  const cat = matchCategory(text);
  const category1 = cat?.category1 ?? '生活';
  const category2 = cat?.category2 ?? '其他';

  // 4. 备注生成
  const remark = makeRemark(text, amount, category1, category2);

  const record: IParsedRecord = {
    amount,
    category1,
    category2,
    remark,
  };
  if (date) {
    record.date = date;
  }
  return record;
}

/**
 * 🔴 主解析函数（应用唯一入口）
 *
 * 完整管线：
 *   ① 多笔拆分 → ② 日期提取 → ③ 金额提取 → ④ 分类匹配 → ⑤ 备注生成
 *
 * 保证：
 * - 日期数字绝不会被当金额（金额提取前自动剥离日期）
 * - 空输入安全返回空数组
 * - 解析异常安全返回空数组
 */
export function parseExpenseText(text: string): IParsedRecord[] {
  try {
    if (!text || !text.trim()) return [];

    // ① 多笔拆分
    const parts = splitRecords(text.trim());
    const results: IParsedRecord[] = [];

    for (const part of parts) {
      // ②~⑤：对每段独立执行日期提取 → 金额提取 → 分类匹配 → 备注生成
      const parsed = parseSingle(part);
      if (parsed) {
        results.push(parsed);
      }
    }

    return results;
  } catch {
    return [];
  }
}

// ============================================================================
//  🔬 防回归测试用例
// ============================================================================
//
//  每次修改解析引擎后，运行 runParserTests() 验证用例全部通过。
//  新增金额/日期场景时，请先加测试用例再改代码。
//
//  用例覆盖原则：
//  - 必须覆盖历史上出现过的 bug（如"8月22日给宝宝转¥600" → 600）
//  - 必须覆盖所有金额提取优先级层级
//  - 必须包含纯日期（无金额）的负例
//
// ============================================================================

interface ParserTestCase {
  input: string;
  expectedAmount: number | null;
  description: string;
}

/** 防回归测试用例清单 */
export const PARSER_TEST_CASES: ParserTestCase[] = [
  // —— 日期干扰类（历史 Bug 回归验证）——
  {
    input: '8月22日给宝宝转¥600零用',
    expectedAmount: 600,
    description: '日期数字不干扰¥符号金额',
  },
  {
    input: '8月22号打车¥35',
    expectedAmount: 35,
    description: 'X月X号日期不干扰¥金额',
  },
  {
    input: '8月20日交水电费¥120',
    expectedAmount: 120,
    description: 'X月X日日期不干扰¥金额',
  },
  {
    input: '8月25号',
    expectedAmount: null,
    description: '纯日期无金额 → null',
  },

  // —— ¥ 符号金额 ——
  {
    input: '买衣服¥299',
    expectedAmount: 299,
    description: '纯¥符号金额',
  },
  {
    input: '¥45.5',
    expectedAmount: 45.5,
    description: '¥符号带小数',
  },
  {
    input: '¥ 600元',
    expectedAmount: 600,
    description: '¥后带空格+元单位',
  },

  // —— 带单位金额 ——
  {
    input: '吃饭35元',
    expectedAmount: 35,
    description: '数字+元单位',
  },
  {
    input: '昨天买菜花了45.5元',
    expectedAmount: 45.5,
    description: '花费动词+元+小数',
  },

  // —— 转账表达 ——
  {
    input: '给宝宝转600',
    expectedAmount: 600,
    description: '给XX转XXX（无单位）',
  },
  {
    input: '转给妈妈500',
    expectedAmount: 500,
    description: '转给XX XXX（无单位）',
  },
  {
    input: '微信转了¥300',
    expectedAmount: 300,
    description: '微信转了¥XXX',
  },
  {
    input: '支付宝转2000',
    expectedAmount: 2000,
    description: '支付宝转XXX',
  },
  {
    input: '转了1000块',
    expectedAmount: 1000,
    description: '转了XXX块',
  },

  // —— 加法表达式 ——
  {
    input: '280+480',
    expectedAmount: 760,
    description: '加法表达式求和',
  },

  // —— X.X 日期格式不干扰 ——
  {
    input: '8.23，50岁生日，给宝宝转600',
    expectedAmount: 600,
    description: 'X.X格式日期不干扰转账金额',
  },

  // —— 花费动词 ——
  {
    input: '花了35块',
    expectedAmount: 35,
    description: '花了+块单位',
  },
];

/**
 * 运行所有防回归测试用例
 * 返回 { passed, failed, results }
 *
 * 用法：开发调试时在 console 里调用，或集成到测试脚本
 */
export function runParserTests(): {
  passed: number;
  failed: number;
  results: { input: string; expected: number | null; actual: number | null; ok: boolean; description: string }[];
} {
  let passed = 0;
  let failed = 0;
  const results: {
    input: string;
    expected: number | null;
    actual: number | null;
    ok: boolean;
    description: string;
  }[] = [];

  for (const tc of PARSER_TEST_CASES) {
    const actual = extractAmount(tc.input);
    const ok = actual === tc.expectedAmount;
    if (ok) passed++;
    else failed++;
    results.push({
      input: tc.input,
      expected: tc.expectedAmount,
      actual,
      ok,
      description: tc.description,
    });
  }

  return { passed, failed, results };
}
