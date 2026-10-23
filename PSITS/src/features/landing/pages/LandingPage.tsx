import { Link } from 'react-router-dom';
import { ChevronRight, Sun, Moon, Target, Compass, BookOpen, Users, Award, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/shared/components/Form';
import { useTheme } from '@/shared/context/ThemeContext';
import logo from '@/assets/image/PSITS_Logo.png';

export const LandingPage = () => {
  const { effectiveTheme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-white dark:bg-[#070D1E] text-slate-900 dark:text-slate-100 font-sans selection:bg-blue-500/20 selection:text-blue-700 dark:selection:bg-cyan-500/30 dark:selection:text-cyan-400 transition-colors duration-200 flex flex-col justify-between relative overflow-x-hidden">
      {/* ── Top Navigation Bar ───────────────────────────────── */}
      <header className="w-full z-20 bg-white/80 dark:bg-[#070D1E]/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800/80 transition-all duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Brand Logo */}
            <Link to="/" className="flex items-center gap-2.5 sm:gap-3 group">
              <img src={logo} alt="PSITS Logo" className="h-9 w-9 sm:h-10 sm:w-10 object-contain rounded-full shadow-xs" />
              <span className="font-bold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white">
                PSITS Region XII
              </span>
            </Link>

            {/* Action CTAs & Theme Switcher */}
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                title="Toggle Dark / Light Mode"
                aria-label="Toggle theme"
              >
                {effectiveTheme === 'dark' ? <Sun size={17} className="text-amber-400" /> : <Moon size={17} />}
              </button>

              <Link
                to="/login"
                className="text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-white px-2 py-1.5 transition-colors"
              >
                Login
              </Link>
              <Link to="/register">
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg shadow-sm border-0 transition-colors text-sm"
                >
                  Join PSITS
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* ── Hero Section (Mockup Matching) ───────────────────── */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-16 sm:py-24 relative">
        {/* Luminous Ambient Glowing Aura (Matches Light & Dark Mockup) */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
          {/* Main Top/Center Cyan-Blue Aura */}
          <div className="w-[500px] h-[340px] sm:w-[760px] sm:h-[440px] bg-gradient-to-b from-blue-400/25 via-cyan-300/20 to-transparent dark:from-blue-600/35 dark:via-cyan-500/20 dark:to-transparent rounded-full blur-[80px] sm:blur-[120px] -translate-y-8 animate-pulse-slow" />
          
          {/* Subtle Warm Amber Glow for Light Mode */}
          <div className="absolute w-[360px] h-[220px] sm:w-[500px] sm:h-[280px] bg-amber-200/35 dark:bg-indigo-600/15 rounded-full blur-[70px] sm:blur-[100px] translate-y-28 -translate-x-10" />
        </div>

        <div className="max-w-3xl mx-auto relative z-10 text-center space-y-6 sm:space-y-8">
          {/* Main Hero Headline */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.12]">
            Empowering IT Students
          </h1>

          {/* Subtitle / Description */}
          <p className="text-sm sm:text-base md:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed font-normal">
            The official website for the Philippine Society of Information Technology Students. Manage events, process
            registrations, and collaborate with industry leaders.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3.5 sm:gap-4 pt-2">
            <Link to="/register">
              <Button
                size="lg"
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-lg shadow-sm border-0 flex items-center gap-2 text-sm sm:text-base transition-colors"
              >
                <span>Get Started</span>
                <ChevronRight size={18} />
              </Button>
            </Link>
            <Link to="/login">
              <Button
                size="lg"
                variant="outline"
                className="bg-white/80 hover:bg-slate-100/90 dark:bg-slate-900/60 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700/80 px-6 py-3 rounded-lg text-sm sm:text-base font-medium shadow-xs transition-colors"
              >
                Member Portal
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* ── Vision & Mission Section ────────────────────────── */}
      <section className="w-full relative z-10 py-16 sm:py-24 bg-slate-50/60 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-cyan-400 border border-blue-200/60 dark:border-blue-800/60 shadow-xs">
              <Sparkles size={14} />
              <span>About PSITS</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Vision &amp; Mission
            </h2>
            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
              The Philippine Society of Information Technology Students (PSITS) aims to develop a harmonious relationship and unity among its members through conferences and other activities.
            </p>
          </div>

          {/* Vision & Mission Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10 max-w-5xl mx-auto">
            {/* Vision Card */}
            <div className="relative rounded-2xl p-8 sm:p-10 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between">
              <div className="space-y-6">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-cyan-400">
                  <Target size={28} />
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-mono font-bold uppercase tracking-wider text-blue-600 dark:text-cyan-400">
                    Our Vision
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                    Fostering Academic &amp; Technical Excellence
                  </h3>
                </div>
                <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                  The society&apos;s vision is to establish an organization that serves as an education venue for IT issues, protects student solidarity, and embodies the organization&apos;s ideas in promoting academic excellence.
                </p>
              </div>

              <div className="pt-8 mt-6 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  <BookOpen size={13} className="text-blue-500" /> IT Education Venue
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  <ShieldCheck size={13} className="text-cyan-500" /> Student Solidarity
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  <Award size={13} className="text-amber-500" /> Academic Excellence
                </span>
              </div>
            </div>

            {/* Mission Card */}
            <div className="relative rounded-2xl p-8 sm:p-10 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between">
              <div className="space-y-6">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400">
                  <Compass size={28} />
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Our Mission
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                    Uniting Schools &amp; Empowering Students
                  </h3>
                </div>
                <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                  The mission focuses on creating a close inter-school environment and serving as a venue for IT education and student solidarity.
                </p>
              </div>

              <div className="pt-8 mt-6 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  <Users size={13} className="text-emerald-500" /> Inter-School Environment
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  <BookOpen size={13} className="text-teal-500" /> IT Education Venue
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  <ShieldCheck size={13} className="text-blue-500" /> Student Solidarity
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer (Matching Mockup) ─────────────────────────── */}
      <footer className="w-full bg-white dark:bg-[#070D1E] border-t border-slate-100 dark:border-slate-800/80 py-6 sm:py-8 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Left: Brand Icon + Name */}
            <div className="flex items-center gap-2.5">
              <img src={logo} alt="PSITS Logo" className="h-8 w-8 object-contain rounded-full shadow-xs" />
              <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                PSITS Region XII
              </span>
            </div>

            {/* Center: Legal & Governance Links */}
            <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
              <Link to="/terms" className="hover:text-blue-600 dark:hover:text-cyan-400 hover:underline transition-colors">
                Terms &amp; Conditions
              </Link>
              <span>•</span>
              <Link to="/privacy" className="hover:text-blue-600 dark:hover:text-cyan-400 hover:underline transition-colors">
                Privacy Policy (RA 10173)
              </Link>
            </div>

            {/* Right: Copyright Text */}
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center sm:text-right">
              &copy; {new Date().getFullYear()} Philippine Society of Information Technology Students Region XII. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
