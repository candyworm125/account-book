import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Download, FileJson, FileSpreadsheet, Wallet, Receipt, RefreshCw, AlertCircle, Smartphone, RefreshCcw, CheckCircle2, Database, Package } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { getAllRecords, deleteRecord, groupByDate, getOverview, getStorageKey, getRawStorageValue, getLegacyKeyInfo } from '@/lib/storage';
import { exportCSV, exportJSON } from '@/lib/exporter';
import { APP_VERSION } from '@/lib/version';
import { cn } from '@/lib/utils';

export default function ProfilePage() {
  const [overview, setOverview] = useState({ totalAmount: 0, totalCount: 0 });
  const [diagnostic, setDiagnostic] = useState({
    url: '',
    origin: '',
    displayMode: '',
    storageKey: '',
    rawCount: 0,
    appCount: 0,
    legacyKeys: [] as { key: string; count: number }[],
  });
  const [swStatus, setSwStatus] = useState<string>('检查中...');
  const [swUpdating, setSwUpdating] = useState(false);
  const location = useLocation();

  // 每次切换到该 Tab 时刷新数据 + 检查 SW 状态
  useEffect(() => {
    setOverview(getOverview());
    updateDiagnostic();
    checkSWStatus();
  }, [location.pathname]);

  const checkSWStatus = () => {
    if (!('serviceWorker' in navigator)) {
      setSwStatus('当前浏览器不支持');
      return;
    }
    navigator.serviceWorker.getRegistration()
      .then((reg) => {
        if (!reg) {
          setSwStatus('未启用（首次加载中）');
          return;
        }
        if (reg.waiting) {
          setSwStatus('有新版本待激活');
        } else if (reg.installing) {
          setSwStatus('新版本安装中...');
        } else if (reg.active) {
          setSwStatus('已启用（当前最新）');
        } else {
          setSwStatus('运行中');
        }
      })
      .catch(() => {
        setSwStatus('状态未知');
      });
  };

  const handleCheckUpdate = () => {
    setSwUpdating(true);
    if (!('serviceWorker' in navigator)) {
      toast.error('当前浏览器不支持离线更新');
      setSwUpdating(false);
      return;
    }

    navigator.serviceWorker.getRegistration()
      .then((reg) => {
        if (!reg) {
          // 没有注册的 SW，直接刷新页面重新注册
          window.location.reload();
          return;
        }

        // 主动检查更新
        return reg.update().then(() => {
          // 等一会儿让新 SW 安装
          setTimeout(() => {
            checkSWStatus();
            if (reg.waiting) {
              // 有等待中的新 SW，发消息让它立即接管
              reg.waiting.postMessage({ type: 'SKIP_WAITING' });
              toast.success('已检测到新版本，正在刷新...');
              setTimeout(() => {
                window.location.reload();
              }, 500);
            } else {
              toast.success('当前已是最新版本');
              setSwUpdating(false);
            }
          }, 1500);
        });
      })
      .catch(() => {
        toast.error('检查更新失败，请刷新页面');
        setSwUpdating(false);
      });
  };

  const updateDiagnostic = () => {
    const raw = getRawStorageValue();
    let rawCount = 0;
    try {
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) rawCount = arr.length;
      }
    } catch {
      // ignore
    }

    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    setDiagnostic({
      url: window.location.href,
      origin: window.location.origin,
      displayMode: isStandalone ? 'standalone（桌面图标）' : 'browser（浏览器）',
      storageKey: getStorageKey(),
      rawCount,
      appCount: getAllRecords().length,
      legacyKeys: getLegacyKeyInfo(),
    });
  };

  const handleForceReload = () => {
    // 强制从 localStorage 重新读取并刷新 UI
    const records = getAllRecords();
    const groups = groupByDate(records);
    setOverview({
      totalAmount: records.reduce((sum, r) => sum + r.amount, 0),
      totalCount: records.length,
    });
    updateDiagnostic();
    toast.success(`已重新加载 ${records.length} 条记录`);
  };

  const handleExportCSV = () => {
    const records = getAllRecords();
    if (records.length === 0) {
      toast.info('暂无数据可导出');
      return;
    }
    try {
      exportCSV(records);
      toast.success('CSV 文件已导出');
    } catch (e) {
      toast.error('导出失败，请重试');
    }
  };

  const handleExportJSON = () => {
    const records = getAllRecords();
    if (records.length === 0) {
      toast.info('暂无数据可导出');
      return;
    }
    try {
      exportJSON(records);
      toast.success('JSON 备份已导出');
    } catch (e) {
      toast.error('导出失败，请重试');
    }
  };

  const handleDownloadSource = () => {
    const link = document.createElement('a');
    link.href = 'account-book-v1.3.0.zip';
    link.download = 'account-book-v1.3.0.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('工程包开始下载');
  };

  return (
    <div className="flex min-h-screen flex-col px-4 pt-6 pb-6">
      {/* 顶部标题 */}
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-stone-800">我的</h1>
      </div>

      {/* 数据概览卡片 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="border-amber-200/60 bg-gradient-to-br from-amber-100/80 to-amber-50/60 backdrop-blur-sm">
          <CardContent className="p-5">
            <h2 className="text-sm font-medium text-stone-600 mb-3">数据概览</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 rounded-xl bg-white/60">
                <div className="flex items-center justify-center gap-1.5 mb-1.5">
                  <Wallet className="h-4 w-4 text-amber-600" />
                  <span className="text-xs text-stone-500">累计支出</span>
                </div>
                <p className="text-2xl font-bold text-stone-800 tabular-nums">
                  ¥{overview.totalAmount.toFixed(2)}
                </p>
              </div>
              <div className="text-center p-3 rounded-xl bg-white/60">
                <div className="flex items-center justify-center gap-1.5 mb-1.5">
                  <Receipt className="h-4 w-4 text-amber-600" />
                  <span className="text-xs text-stone-500">累计记录</span>
                </div>
                <p className="text-2xl font-bold text-stone-800 tabular-nums">
                  {overview.totalCount}
                  <span className="text-sm font-normal text-stone-500 ml-1">笔</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* 数据诊断区 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="mt-5"
      >
        <Card className="border-stone-200 bg-white/70 backdrop-blur-sm">
          <CardContent className="p-0">
            <div className="px-4 py-3">
              <h2 className="text-sm font-medium text-stone-600 flex items-center gap-1.5">
                <Smartphone className="h-4 w-4 text-stone-500" />
                数据诊断
              </h2>
            </div>
            <Separator className="bg-stone-100" />
            <div className="px-4 py-3 space-y-2 text-xs">
              <div className="flex items-start justify-between gap-2">
                <span className="text-stone-500 shrink-0">运行模式</span>
                <span className={cn(
                  'font-medium text-right',
                  diagnostic.displayMode.includes('standalone')
                    ? 'text-amber-700'
                    : 'text-stone-700',
                )}>
                  {diagnostic.displayMode}
                </span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span className="text-stone-500 shrink-0">当前 URL</span>
                <span className="font-mono text-stone-700 text-right break-all">
                  {diagnostic.url}
                </span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span className="text-stone-500 shrink-0">Origin</span>
                <span className="font-mono text-stone-700 text-right break-all">
                  {diagnostic.origin}
                </span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span className="text-stone-500 shrink-0">存储 Key</span>
                <span className="font-mono text-stone-700 text-right break-all">
                  {diagnostic.storageKey}
                </span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span className="text-stone-500 shrink-0">原始存储条数</span>
                <span className={cn(
                  'font-medium tabular-nums',
                  diagnostic.rawCount === diagnostic.appCount
                    ? 'text-emerald-600'
                    : 'text-red-600',
                )}>
                  {diagnostic.rawCount} 条
                </span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span className="text-stone-500 shrink-0">应用读取条数</span>
                <span className="font-medium text-stone-700 tabular-nums">
                  {diagnostic.appCount} 条
                </span>
              </div>
              {diagnostic.legacyKeys.length > 0 && (
                <div className="mt-2 pt-2 border-t border-stone-100 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-stone-500">
                    <Database className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-xs">检测到的其他存储 key</span>
                  </div>
                  {diagnostic.legacyKeys.map((item) => (
                    <div key={item.key} className="flex items-center justify-between gap-2 pl-5">
                      <span className="font-mono text-[10px] text-stone-500 break-all">
                        {item.key}
                      </span>
                      <span className={cn(
                        'text-xs tabular-nums shrink-0',
                        item.count > 0 ? 'text-amber-600' : 'text-stone-400',
                      )}>
                        {item.count >= 0 ? `${item.count} 条` : '无效'}
                      </span>
                    </div>
                  ))}
                  <p className="text-[10px] text-stone-400 pl-5 leading-relaxed">
                    应用启动时已自动合并以上 key 中的数据到当前存储
                  </p>
                </div>
              )}
              {diagnostic.rawCount !== diagnostic.appCount && (
                <div className="flex items-start gap-1.5 mt-2 pt-2 border-t border-stone-100">
                  <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 leading-relaxed">
                    原始存储与应用读取条数不一致，点击下方按钮强制重新加载。
                  </p>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleForceReload}
                className="w-full mt-2 border-stone-200 text-stone-600 hover:bg-stone-50"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                强制重新加载数据
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* 版本与更新区 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.12 }}
        className="mt-5"
      >
        <Card className="border-stone-200 bg-white/70 backdrop-blur-sm">
          <CardContent className="p-0">
            <div className="px-4 py-3">
              <h2 className="text-sm font-medium text-stone-600 flex items-center gap-1.5">
                <RefreshCcw className="h-4 w-4 text-stone-500" />
                版本与更新
              </h2>
            </div>
            <Separator className="bg-stone-100" />
            <div className="px-4 py-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-stone-500">应用版本</span>
                <span className="font-semibold text-stone-800 tabular-nums">v{APP_VERSION}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-500">离线缓存</span>
                <span className={cn(
                  'font-medium',
                  swStatus.includes('最新') ? 'text-emerald-600' :
                  swStatus.includes('新版本') ? 'text-amber-600' :
                  swStatus.includes('安装中') ? 'text-amber-600' :
                  'text-stone-600',
                )}>
                  {swStatus}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCheckUpdate}
                disabled={swUpdating}
                className="w-full mt-2 border-amber-200 text-amber-700 hover:bg-amber-50"
              >
                {swUpdating ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    检查中...
                  </>
                ) : swStatus.includes('最新') ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                    检查更新
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    检查更新
                  </>
                )}
              </Button>
              <p className="text-[10px] text-stone-400 leading-relaxed pt-1">
                如果页面显示异常，点击上方按钮强制检查并加载最新版本。
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* 导出功能区 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="mt-5"
      >
        <Card className="border-amber-200/60 bg-white/70 backdrop-blur-sm">
          <CardContent className="p-0">
            <div className="px-4 py-3">
              <h2 className="text-sm font-medium text-stone-600 flex items-center gap-1.5">
                <Download className="h-4 w-4 text-amber-600" />
                数据导出
              </h2>
            </div>
            <Separator className="bg-amber-100" />
            <button
              onClick={handleExportCSV}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-4',
                'hover:bg-amber-50 transition-colors',
                'min-h-[56px]',
              )}
            >
              <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-stone-800">导出 CSV</p>
                <p className="text-xs text-stone-500">Excel 可直接打开，含完整明细</p>
              </div>
              <svg
                className="h-4 w-4 text-stone-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
            <Separator className="bg-amber-100" />
            <button
              onClick={handleExportJSON}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-4',
                'hover:bg-amber-50 transition-colors',
                'min-h-[56px]',
              )}
            >
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <FileJson className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-stone-800">导出 JSON</p>
                <p className="text-xs text-stone-500">完整数据备份，可用于导入恢复</p>
              </div>
              <svg
                className="h-4 w-4 text-stone-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
            <Separator className="bg-amber-100" />
            <button
              onClick={handleDownloadSource}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-4',
                'hover:bg-amber-50 transition-colors',
                'min-h-[56px]',
              )}
            >
              <div className="h-10 w-10 rounded-lg bg-violet-100 flex items-center justify-center">
                <Package className="h-5 w-5 text-violet-600" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-stone-800">下载完整工程包</p>
                <p className="text-xs text-stone-500">含全部源码 + README，可本地运行部署</p>
              </div>
              <svg
                className="h-4 w-4 text-stone-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </CardContent>
        </Card>
      </motion.div>

      {/* 说明卡片 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
        className="mt-5"
      >
        <Card className="border-amber-200/60 bg-white/40">
          <CardContent className="p-4">
            <p className="text-xs text-stone-500 leading-relaxed">
              💡 所有数据保存在您的浏览器本地，不会上传到任何服务器。
              建议定期导出备份，避免清理浏览器数据导致记录丢失。
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* 底部版本信息 */}
      <div className="mt-auto pt-8 pb-2 text-center">
        <p className="text-xs text-stone-400">记账本 v{APP_VERSION}</p>
        <p className="text-xs text-stone-300 mt-0.5">本地存储 · 数据安全</p>
      </div>
    </div>
  );
}
