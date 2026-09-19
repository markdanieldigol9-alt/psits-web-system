import type { ReactNode } from 'react';
import { useState } from 'react';
import { Header } from '@/shared/components/Header';
import { Sidebar } from '@/shared/components/Sidebar';

interface LayoutProps {
  children: ReactNode;
}

interface AuthLayoutProps extends LayoutProps {
  title: string;
  subtitle?: string;
}

export const MainLayout = ({ children }: LayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-x-hidden transition-colors duration-200">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 min-w-0 flex flex-col">
        <Header
          onMenuClick={() => setSidebarOpen((v) => !v)}
          isMenuOpen={sidebarOpen}
        />
        <main className="flex-1 min-w-0 overflow-y-auto">
          {/* Subtle dot-grid page background */}
          <div className="w-full min-h-full p-4 sm:p-6 bg-dot-grid">
            <div className="page-container">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export const AuthLayout = ({ title, subtitle, children }: AuthLayoutProps) => {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 relative overflow-hidden transition-colors duration-200">

      {/* Decorative background circles */}
      <div className="absolute -top-28 -left-28 w-96 h-96 bg-white/5 rounded-full pointer-events-none" />
      <div className="absolute top-1/3 left-1/4 w-[480px] h-[480px] bg-white/[0.04] rounded-full pointer-events-none" />
      <div className="absolute -bottom-36 -right-20 w-[500px] h-[500px] bg-white/5 rounded-full pointer-events-none" />
      <div className="absolute top-10 right-10 w-48 h-48 bg-indigo-400/10 rounded-full pointer-events-none" />

      {/* Centered card — grows with device size */}
      <div className="relative z-10 w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl animate-fade-in-up">

        {/* Logo + brand */}
        <div className="flex flex-col items-center mb-6 sm:mb-8">
          {/* Glow orb */}
          <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-full bg-white/10 backdrop-blur-md border border-white/20 shadow-[0_0_40px_12px_rgba(255,255,255,0.12)] flex items-center justify-center mb-4">
            <div className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-full bg-white/25 shadow-[0_0_16px_6px_rgba(255,255,255,0.2)]" />
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight">PSITS</h1>
          <p className="text-blue-200 text-sm sm:text-base font-medium mt-1">Web System</p>
        </div>

        {/* Form card — solid white, responsive padding */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-white/10 shadow-[0_25px_60px_rgba(0,0,0,0.3)] p-6 sm:p-8 md:p-10">
          {(title || subtitle) && (
            <div className="mb-6 sm:mb-8">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">{title}</h2>
              {subtitle && <p className="text-sm sm:text-base text-gray-500 mt-1.5">{subtitle}</p>}
            </div>
          )}
          {children}
        </div>

      </div>
    </div>
  );
};

export const BlankLayout = ({ children }: LayoutProps) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 transition-colors duration-200">
      {children}
    </div>
  );
};
