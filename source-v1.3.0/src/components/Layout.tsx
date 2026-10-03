import { ActiveLink } from '@lark-apaas/client-toolkit-lite';
import { Outlet } from 'react-router-dom';
import { NavLink } from 'react-router-dom';
import { Calculator, ListTodo, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { path: '/', label: '记账', Icon: Calculator },
  { path: '/history', label: '明细', Icon: ListTodo },
  { path: '/profile', label: '我的', Icon: User },
];

export const Layout = () => {
  return (
    <div className="flex min-h-screen w-full justify-center bg-stone-100">
      <div className="relative flex w-full max-w-[480px] flex-col bg-amber-50/60 shadow-sm">
        {/* 主内容区 */}
        <main className="flex-1 overflow-y-auto pb-24">
          <Outlet />
        </main>

        {/* 底部 Tab 导航 - grid 3 等宽，保证 3 个 Tab 完整显示，不被挤压 */}
        <nav
          className={cn(
            'fixed bottom-0 left-1/2 z-[100] w-full max-w-[480px] -translate-x-1/2',
            'border-t border-amber-200/60 bg-amber-50/95 backdrop-blur-md',
            'pb-[env(safe-area-inset-bottom)]',
          )}
        >
          <div className="grid grid-cols-3">
            {NAV_ITEMS.map(({ path, label, Icon }) => (
              <ActiveLink
                key={path}
                to={path}
                end={path === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center justify-center gap-0.5 py-2.5',
                    'min-h-[56px] w-full overflow-hidden',
                    'transition-colors duration-200',
                    isActive ? 'text-amber-700' : 'text-stone-400',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className="h-5 w-5 shrink-0" strokeWidth={isActive ? 2.2 : 1.8} />
                    <span className="text-xs font-medium shrink-0">{label}</span>
                  </>
                )}
              </ActiveLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
};
