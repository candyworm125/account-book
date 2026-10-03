import { logger } from '@lark-apaas/client-toolkit-lite';
import { getAppId } from '@lark-apaas/client-toolkit-lite';
import type { IAccountRecord, IParsedRecord } from '@/data/account';

/**
 * 存储 key（固定常量，不依赖运行时 appId 解析）
 * 保证浏览器模式和 PWA standalone 模式读写同一份数据
 */
const STORAGE_KEY = '__account_book_records_v1__';

/**
 * 可能存在的旧 key 列表（用于数据迁移合并）
 * 历史版本可能使用过的 key：
 * - __app_account_book_records: 早期版本 key
 * - app_<id>:__account_book_records_v1__: scopedStorage 带前缀版本
 * - 其他可能的变体
 */
function getLegacyKeys(): string[] {
  const keys = new Set<string>();

  // 已知旧 key
  keys.add('__app_account_book_records');
  keys.add('account_book_records');
  keys.add('__accounting_records__');

  // scopedStorage 风格的带 appId 前缀 key
  const appId = getAppId();
  if (appId) {
    keys.add(`${appId}:__account_book_records_v1__`);
    keys.add(`${appId}:__app_account_book_records`);
    keys.add(`${appId}:account_book_records`);
  }

  // 扫描 localStorage，找出所有看起来像记账记录的 key
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k !== STORAGE_KEY && /account.*record|record.*account|记账/i.test(k)) {
        keys.add(k);
      }
    }
  } catch {
    // ignore
  }

  return Array.from(keys).filter((k) => k !== STORAGE_KEY);
}

/**
 * 数据迁移：从所有旧 key 中读取数据，合并到当前 STORAGE_KEY
 * 去重策略：按 id 去重，保留最新的（timestamp 大的）
 * 只在首次调用 getAllRecords 时执行一次
 */
let migrated = false;
function migrateIfNeeded(): void {
  if (migrated) return;
  migrated = true;

  try {
    const legacyKeys = getLegacyKeys();
    if (legacyKeys.length === 0) return;

    // 收集当前数据
    const currentRaw = localStorage.getItem(STORAGE_KEY);
    const allRecords: IAccountRecord[] = currentRaw ? JSON.parse(currentRaw) : [];
    const seenIds = new Set(allRecords.map((r) => r.id));
    let mergedCount = 0;
    let migratedKeys: string[] = [];

    for (const key of legacyKeys) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr) || arr.length === 0) continue;

        // 验证是否为记账记录数组（至少有 amount 字段）
        if (typeof arr[0]?.amount !== 'number') continue;

        for (const rec of arr) {
          if (rec && rec.id && !seenIds.has(rec.id)) {
            allRecords.push(rec as IAccountRecord);
            seenIds.add(rec.id);
            mergedCount++;
          }
        }
        migratedKeys.push(key);
      } catch {
        // 单个 key 解析失败不影响其他
      }
    }

    if (mergedCount > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(allRecords));
      logger.info(
        `数据迁移完成：从 ${migratedKeys.length} 个旧 key 合并了 ${mergedCount} 条记录`,
      );
    }
  } catch (e) {
    logger.error('数据迁移失败:', String(e));
  }
}

function getTodayDateStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function generateId(): string {
  return `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 获取所有记录（直接读 localStorage，不走 scopedStorage 避免 appId 解析差异） */
export function getAllRecords(): IAccountRecord[] {
  try {
    migrateIfNeeded();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** 保存所有记录 */
export function saveAllRecords(records: IAccountRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    logger.error('保存记录失败:', String(e));
  }
}

/** 直接读取 localStorage 原始值（用于诊断） */
export function getRawStorageValue(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** 获取存储 key 名 */
export function getStorageKey(): string {
  return STORAGE_KEY;
}

/** 获取已扫描到的旧 key 列表（用于诊断展示） */
export function getLegacyKeyInfo(): { key: string; count: number }[] {
  const keys = getLegacyKeys();
  const result: { key: string; count: number }[] = [];
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const arr = JSON.parse(raw);
      const count = Array.isArray(arr) ? arr.length : -1;
      result.push({ key, count });
    } catch {
      result.push({ key, count: -1 });
    }
  }
  return result;
}

/**
 * 添加多条记录（解析预览确认后调用）
 * 若 parsed 记录自带 date 字段则使用之，否则用当天
 */
export function addRecords(parsed: IParsedRecord[]): IAccountRecord[] {
  const records = getAllRecords();
  const todayStr = getTodayDateStr();
  const now = Date.now();

  const newRecords: IAccountRecord[] = parsed.map((p, i) => {
    const dateStr = p.date || todayStr;
    const ts = dateStr === todayStr
      ? now + i
      : new Date(`${dateStr}T12:00:00`).getTime() + i;

    return {
      id: generateId(),
      amount: p.amount,
      category1: p.category1,
      category2: p.category2,
      remark: p.remark,
      timestamp: ts,
      date: dateStr,
    };
  });

  const updated = [...records, ...newRecords];
  saveAllRecords(updated);
  return newRecords;
}

/** 删除单条记录 */
export function deleteRecord(id: string): void {
  const records = getAllRecords();
  const filtered = records.filter((r) => r.id !== id);
  saveAllRecords(filtered);
}

/**
 * 更新单条记录（按 id 定位，更新对应字段）
 * 若日期变化则同步更新 timestamp，保证分组排序正确
 */
export function updateRecord(
  id: string,
  updates: Partial<Pick<IAccountRecord, 'amount' | 'category1' | 'category2' | 'remark' | 'date'>>,
): IAccountRecord | null {
  const records = getAllRecords();
  const idx = records.findIndex((r) => r.id === id);
  if (idx === -1) return null;

  const original = records[idx];
  const updated: IAccountRecord = { ...original, ...updates };

  // 如果日期变了，同步更新 timestamp
  if (updates.date && updates.date !== original.date) {
    updated.timestamp = new Date(`${updates.date}T12:00:00`).getTime();
  }

  records[idx] = updated;
  saveAllRecords(records);
  return updated;
}

/** 按日期分组（倒序） */
export function groupByDate(records: IAccountRecord[]): { date: string; total: number; items: IAccountRecord[] }[] {
  const map = new Map<string, IAccountRecord[]>();

  for (const r of records) {
    if (!map.has(r.date)) {
      map.set(r.date, []);
    }
    map.get(r.date)!.push(r);
  }

  const groups: { date: string; total: number; items: IAccountRecord[] }[] = [];
  const dates = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));

  for (const date of dates) {
    const items = map.get(date)!;
    const total = items.reduce((sum, r) => sum + r.amount, 0);
    items.sort((a, b) => b.timestamp - a.timestamp);
    groups.push({ date, total, items });
  }

  return groups;
}

/** 统计概览 */
export function getOverview(): { totalAmount: number; totalCount: number } {
  const records = getAllRecords();
  const totalAmount = records.reduce((sum, r) => sum + r.amount, 0);
  return {
    totalAmount: Math.round(totalAmount * 100) / 100,
    totalCount: records.length,
  };
}
