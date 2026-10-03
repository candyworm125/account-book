// EXPORTS: IAccountRecord, IParsedRecord, CATEGORY_MAP, CATEGORY_COLORS, CATEGORY_ICONS, ALL_CATEGORIES

export interface IAccountRecord {
  id: string;
  amount: number;
  category1: string;
  category2: string;
  remark: string;
  timestamp: number;
  date: string;
}

export interface IParsedRecord {
  amount: number;
  category1: string;
  category2: string;
  remark: string;
  /** 记账日期 YYYY-MM-DD，未指定时用当天 */
  date?: string;
}

/**
 * 一级分类 → 二级分类列表
 * 顺序决定匹配优先级：排在前面的先匹配
 */
export const CATEGORY_MAP: Record<string, string[]> = {
  餐饮: ['早饭', '午饭', '晚饭', '宵夜', '其他'],
  交通: ['公交', '打车', '加油', '停车', '其他'],
  购物: ['服饰', '数码', '食品', '其他'],
  美业: ['剪发', '染发', '美容', '护肤', '其他'],
  医疗: ['门诊', '药品', '体检', '其他'],
  生活: ['日常', '水电', '装修', '购房', '其他'],
};

/**
 * 一级分类 → 主题色（用于分类色彩标识）
 * 暖白纸质账本风格，柔和不刺眼
 */
export const CATEGORY_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  餐饮: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  交通: { bg: 'bg-sky-100', text: 'text-sky-700', dot: 'bg-sky-500' },
  购物: { bg: 'bg-rose-100', text: 'text-rose-700', dot: 'bg-rose-500' },
  美业: { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500' },
  医疗: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  生活: { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500' },
};

/**
 * 二级分类关键词 → 二级分类名
 * 用于智能匹配，多字词优先于短词
 * 按关键词长度倒序排列，保证先匹配长词
 */
export const KEYWORD_MAP: Record<string, { category1: string; category2: string }> = {
  // 餐饮
  '早饭': { category1: '餐饮', category2: '早饭' },
  '早餐': { category1: '餐饮', category2: '早饭' },
  '午饭': { category1: '餐饮', category2: '午饭' },
  '午餐': { category1: '餐饮', category2: '午饭' },
  '晚饭': { category1: '餐饮', category2: '晚饭' },
  '晚餐': { category1: '餐饮', category2: '晚饭' },
  '宵夜': { category1: '餐饮', category2: '宵夜' },
  '夜宵': { category1: '餐饮', category2: '宵夜' },
  '吃饭': { category1: '餐饮', category2: '其他' },
  '外卖': { category1: '餐饮', category2: '其他' },
  '奶茶': { category1: '餐饮', category2: '其他' },
  '咖啡': { category1: '餐饮', category2: '其他' },
  '火锅': { category1: '餐饮', category2: '其他' },
  '烧烤': { category1: '餐饮', category2: '其他' },

  // 交通
  '打车': { category1: '交通', category2: '打车' },
  '滴滴': { category1: '交通', category2: '打车' },
  '出租': { category1: '交通', category2: '打车' },
  '公交': { category1: '交通', category2: '公交' },
  '地铁': { category1: '交通', category2: '公交' },
  '加油': { category1: '交通', category2: '加油' },
  '油费': { category1: '交通', category2: '加油' },
  '停车': { category1: '交通', category2: '停车' },
  '停车费': { category1: '交通', category2: '停车' },
  '高铁': { category1: '交通', category2: '其他' },
  '火车': { category1: '交通', category2: '其他' },
  '机票': { category1: '交通', category2: '其他' },
  '打车费': { category1: '交通', category2: '打车' },

  // 购物
  '衣服': { category1: '购物', category2: '服饰' },
  '服饰': { category1: '购物', category2: '服饰' },
  '鞋子': { category1: '购物', category2: '服饰' },
  '裤子': { category1: '购物', category2: '服饰' },
  '裙子': { category1: '购物', category2: '服饰' },
  '包包': { category1: '购物', category2: '服饰' },
  '手机': { category1: '购物', category2: '数码' },
  '电脑': { category1: '购物', category2: '数码' },
  '数码': { category1: '购物', category2: '数码' },
  '耳机': { category1: '购物', category2: '数码' },
  '超市': { category1: '购物', category2: '食品' },
  '买菜': { category1: '购物', category2: '食品' },
  '零食': { category1: '购物', category2: '食品' },
  '水果': { category1: '购物', category2: '食品' },
  '淘宝': { category1: '购物', category2: '其他' },
  '网购': { category1: '购物', category2: '其他' },

  // 美业
  '剪发': { category1: '美业', category2: '剪发' },
  '理发': { category1: '美业', category2: '剪发' },
  '染发': { category1: '美业', category2: '染发' },
  '烫头': { category1: '美业', category2: '染发' },
  '烫发': { category1: '美业', category2: '染发' },
  '美容': { category1: '美业', category2: '美容' },
  '护肤': { category1: '美业', category2: '护肤' },
  '面膜': { category1: '美业', category2: '护肤' },
  '化妆品': { category1: '美业', category2: '护肤' },
  '美甲': { category1: '美业', category2: '其他' },

  // 医疗
  '门诊': { category1: '医疗', category2: '门诊' },
  '挂号': { category1: '医疗', category2: '门诊' },
  '看病': { category1: '医疗', category2: '门诊' },
  '药品': { category1: '医疗', category2: '药品' },
  '买药': { category1: '医疗', category2: '药品' },
  '药费': { category1: '医疗', category2: '药品' },
  '体检': { category1: '医疗', category2: '体检' },
  '医院': { category1: '医疗', category2: '其他' },

  // 生活
  '水电': { category1: '生活', category2: '水电' },
  '电费': { category1: '生活', category2: '水电' },
  '水费': { category1: '生活', category2: '水电' },
  '燃气': { category1: '生活', category2: '水电' },
  '物业': { category1: '生活', category2: '水电' },
  '装修': { category1: '生活', category2: '装修' },
  '家具': { category1: '生活', category2: '装修' },
  '家电': { category1: '生活', category2: '装修' },
  '购房': { category1: '生活', category2: '购房' },
  '房租': { category1: '生活', category2: '购房' },
  '租房': { category1: '生活', category2: '购房' },
  '日常': { category1: '生活', category2: '日常' },
  '日用品': { category1: '生活', category2: '日常' },
};

/** 所有一级分类 */
export const ALL_CATEGORIES = Object.keys(CATEGORY_MAP);

/**
 * 排序关键词，保证长词优先匹配
 * 返回按关键词长度倒序排列的 [keyword, category] 数组
 */
export function getSortedKeywords(): [string, { category1: string; category2: string }][] {
  return Object.entries(KEYWORD_MAP).sort((a, b) => b[0].length - a[0].length);
}
