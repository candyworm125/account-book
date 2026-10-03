import { format } from 'date-fns';
import type { IAccountRecord } from '@/data/account';

/**
 * 导出 CSV 文件
 * 列：日期、金额、一级分类、二级分类、备注
 * 带 UTF-8 BOM，Excel 可直接打开
 */
export function exportCSV(records: IAccountRecord[]): void {
  const header = ['日期', '金额', '一级分类', '二级分类', '备注'];
  const rows = records.map((r) => [
    r.date,
    r.amount.toString(),
    r.category1,
    r.category2,
    escapeCSV(r.remark),
  ]);

  const csvContent = [header, ...rows].map((row) => row.join(',')).join('\n');
  // UTF-8 BOM
  const bomContent = '\uFEFF' + csvContent;

  triggerDownload(bomContent, `记账记录_${format(new Date(), 'yyyyMMdd')}.csv`, 'text/csv;charset=utf-8');
}

/**
 * 导出 JSON 文件
 */
export function exportJSON(records: IAccountRecord[]): void {
  const content = JSON.stringify(records, null, 2);
  triggerDownload(content, `记账备份_${format(new Date(), 'yyyyMMdd')}.json`, 'application/json');
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * 触发文件下载
 * 兼容 iOS Safari：使用 Blob + a.click
 */
function triggerDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';

  // iOS Safari 兼容性处理
  document.body.appendChild(a);

  // 使用 setTimeout 确保 DOM 已更新
  setTimeout(() => {
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }, 0);
}
