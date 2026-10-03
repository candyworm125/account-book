import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Trash2, Calculator, Edit2, Pencil, FileSpreadsheet, FileJson } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getAllRecords, deleteRecord, groupByDate, updateRecord } from '@/lib/storage';
import { exportCSV, exportJSON } from '@/lib/exporter';
import { CATEGORY_COLORS, CATEGORY_MAP, type IAccountRecord } from '@/data/account';
import { cn } from '@/lib/utils';

export default function HistoryPage() {
  const [groups, setGroups] = useState<{ date: string; total: number; items: IAccountRecord[] }[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<IAccountRecord | null>(null);
  const [editTarget, setEditTarget] = useState<IAccountRecord | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // 每次切换到该 Tab 时刷新数据
  useEffect(() => {
    const records = getAllRecords();
    setGroups(groupByDate(records));
  }, [location.pathname]);

  const refreshData = () => {
    const records = getAllRecords();
    setGroups(groupByDate(records));
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteRecord(deleteTarget.id);
    toast.success('已删除');
    setDeleteTarget(null);
    refreshData();
  };

  const handleEditSave = (updates: Partial<IAccountRecord>) => {
    if (!editTarget) return;
    updateRecord(editTarget.id, updates);
    toast.success('已保存');
    setEditTarget(null);
    refreshData();
  };

  const totalAmount = groups.reduce((sum, g) => sum + g.total, 0);
  const totalCount = groups.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <div className="flex min-h-screen flex-col px-4 pt-6 pb-6">
      {/* 顶部标题 + 总览 + 导出 */}
      <div className="mb-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-stone-800">账单明细</h1>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                if (totalCount === 0) {
                  toast.info('暂无数据可导出');
                  return;
                }
                try {
                  exportCSV(getAllRecords());
                  toast.success('CSV 已导出');
                } catch {
                  toast.error('导出失败');
                }
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors"
              aria-label="导出 CSV"
              title="导出 CSV"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => {
                if (totalCount === 0) {
                  toast.info('暂无数据可导出');
                  return;
                }
                try {
                  exportJSON(getAllRecords());
                  toast.success('JSON 备份已导出');
                } catch {
                  toast.error('导出失败');
                }
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors"
              aria-label="导出 JSON 备份"
              title="导出 JSON 备份"
            >
              <FileJson className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {groups.length > 0 && (
          <p className="mt-1 text-xs text-stone-500">
            共 {totalCount} 笔，累计支出{' '}
            <span className="font-medium text-stone-700">¥{totalAmount.toFixed(2)}</span>
          </p>
        )}
      </div>

      {/* 记录列表 */}
      {groups.length === 0 ? (
        <EmptyState onAction={() => navigate('/')} />
      ) : (
        <div className="space-y-5">
          <AnimatePresence mode="popLayout">
            {groups.map((group) => (
              <DateGroup
                key={group.date}
                date={group.date}
                total={group.total}
                items={group.items}
                onDelete={(item) => setDeleteTarget(item)}
                onEdit={(item) => setEditTarget(item)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* 删除确认弹窗 */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent className="max-w-sm mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle>确定删除这条记录吗？</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <span className="text-sm text-stone-500">
                  {deleteTarget.category1} · {deleteTarget.category2} - ¥
                  {deleteTarget.amount.toFixed(2)}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="mt-0">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 编辑弹窗 */}
      <EditDialog
        record={editTarget}
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        onSave={handleEditSave}
      />
    </div>
  );
}

/* ---------- DateGroup ---------- */

interface DateGroupProps {
  date: string;
  total: number;
  items: IAccountRecord[];
  onDelete: (item: IAccountRecord) => void;
  onEdit: (item: IAccountRecord) => void;
}

function DateGroup({ date, total, items, onDelete, onEdit }: DateGroupProps) {
  const formattedDate = formatDateLabel(date);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* 日期栏 */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-stone-500">{formattedDate}</span>
        <span className="text-xs text-stone-400">
          合计 <span className="text-stone-600 font-medium">¥{total.toFixed(2)}</span>
        </span>
      </div>

      {/* 记录卡片 */}
      <div className="rounded-xl border border-amber-200/60 bg-white/70 backdrop-blur-sm overflow-hidden divide-y divide-amber-100/80">
        {items.map((item) => (
          <RecordItem
            key={item.id}
            item={item}
            onDelete={() => onDelete(item)}
            onEdit={() => onEdit(item)}
          />
        ))}
      </div>
    </motion.div>
  );
}

/* ---------- RecordItem ---------- */

interface RecordItemProps {
  item: IAccountRecord;
  onDelete: () => void;
  onEdit: () => void;
}

function RecordItem({ item, onDelete, onEdit }: RecordItemProps) {
  const colors = CATEGORY_COLORS[item.category1] || CATEGORY_COLORS['生活'];

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, height: 0 }}
      className="flex items-center gap-2 px-3 py-3 min-h-[56px]"
    >
      {/* 分类色标 */}
      <div className={cn('h-2.5 w-2.5 shrink-0 rounded-full', colors.dot)} />

      {/* 内容 */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={cn('text-sm font-medium', colors.text)}>
            {item.category2}
          </span>
          <span className="text-xs text-stone-400">· {item.category1}</span>
        </div>
        {item.remark && (
          <p className="mt-0.5 text-xs text-stone-400 truncate">{item.remark}</p>
        )}
      </div>

      {/* 金额 + 操作 */}
      <div className="flex items-center gap-0.5 shrink-0">
        <span className="text-sm font-semibold text-stone-800 tabular-nums mr-1">
          -¥{item.amount.toFixed(2)}
        </span>
        <button
          onClick={onEdit}
          className={cn(
            'h-9 w-9 flex items-center justify-center rounded-md',
            'text-stone-400 hover:text-amber-600 hover:bg-amber-50',
            'min-h-[44px] min-w-[44px]',
          )}
          aria-label="编辑记录"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          onClick={onDelete}
          className={cn(
            'h-9 w-9 flex items-center justify-center rounded-md',
            'text-stone-400 hover:text-red-500 hover:bg-red-50',
            'min-h-[44px] min-w-[44px]',
          )}
          aria-label="删除记录"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}

/* ---------- EditDialog ---------- */

interface EditDialogProps {
  record: IAccountRecord | null;
  open: boolean;
  onClose: () => void;
  onSave: (updates: Partial<IAccountRecord>) => void;
}

function EditDialog({ record, open, onClose, onSave }: EditDialogProps) {
  const [amount, setAmount] = useState('');
  const [category1, setCategory1] = useState('生活');
  const [category2, setCategory2] = useState('其他');
  const [remark, setRemark] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    if (record) {
      setAmount(record.amount.toString());
      setCategory1(record.category1);
      setCategory2(record.category2);
      setRemark(record.remark);
      setDate(record.date);
    }
  }, [record]);

  const handleCategory1Change = (val: string) => {
    setCategory1(val);
    const subCats = CATEGORY_MAP[val] || [];
    // 如果当前二级分类在新分类下还存在，保留；否则取第一个
    if (!subCats.includes(category2)) {
      setCategory2(subCats[0] || '其他');
    }
  };

  const handleSave = () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('请输入有效金额');
      return;
    }
    if (!date) {
      toast.error('请选择日期');
      return;
    }
    onSave({
      amount: Math.round(amt * 100) / 100,
      category1,
      category2,
      remark: remark.trim(),
      date,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm mx-4">
        <DialogHeader>
          <DialogTitle>编辑记录</DialogTitle>
          <DialogDescription>修改金额、日期、分类或备注</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-stone-500 mb-1 block">金额 (元)</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-10"
            />
          </div>
          <div>
            <label className="text-xs text-stone-500 mb-1 block">日期</label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-10"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-stone-500 mb-1 block">一级分类</label>
              <Select value={category1} onValueChange={handleCategory1Change}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(CATEGORY_MAP).map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-stone-500 mb-1 block">二级分类</label>
              <Select value={category2} onValueChange={(v) => setCategory2(v)}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(CATEGORY_MAP[category1] || []).map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs text-stone-500 mb-1 block">备注</label>
            <Input
              type="text"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="选填"
              className="h-10"
            />
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto mt-0">
            取消
          </Button>
          <Button
            onClick={handleSave}
            className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white"
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- EmptyState ---------- */

function EmptyState({ onAction }: { onAction: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center pt-20">
      <div className="mb-4 text-5xl">📒</div>
      <p className="mb-1 text-base font-medium text-stone-700">还没有记账记录</p>
      <p className="mb-6 text-sm text-stone-400">快去记第一笔账吧</p>
      <Button
        onClick={onAction}
        className="bg-amber-600 hover:bg-amber-700 text-white"
      >
        <Calculator className="h-4 w-4 mr-2" />
        去记一笔
      </Button>
    </div>
  );
}

/* ---------- helpers ---------- */

function formatDateLabel(dateStr: string): string {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  if (dateStr === todayStr) return '今天';
  if (dateStr === yesterdayStr) return '昨天';

  const [y, m, d] = dateStr.split('-');
  const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const weekday = weekdays[date.getDay()];

  return `${parseInt(m)}月${parseInt(d)}日 ${weekday}`;
}
