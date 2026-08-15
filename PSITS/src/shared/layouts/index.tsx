import type { ReactNode } from 'react';
import { useState } from 'react';
import { Header } from '@/shared/components/Header';
import { Sidebar } from '@/shared/components/Sidebar';

interface LayoutProps {
  children: ReactNode;
}

interface AuthLayoutProps extends LayoutProps {
  title: string;
}

export const MainLayout = ({ children }: LayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-x-hidden transition-colors duration-200">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 min-w-0 flex flex-col">
        <Header
          onMenuClick={() => setSidebarOpen((v) => !v)}
          isMenuOpen={sidebarOpen}
        />
        <main className="w-full p-4 sm:p-6 flex-1 min-w-0 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
};

export const AuthLayout = ({ title, children }: AuthLayoutProps) => {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-blue-50/50 dark:bg-slate-950 p-4 sm:p-6 transition-colors duration-200">
      <div className="w-full md:w-[80%] lg:w-1/2 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl shadow-xl p-6 sm:p-8 lg:p-10">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-center mb-6 text-blue-600 dark:text-blue-400">{title}</h2>
        {children}
      </div>
    </div>
  );
};

export const BlankLayout = ({ children }: LayoutProps) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 transition-colors duration-200">
      {children}
    </div>
  );
};
