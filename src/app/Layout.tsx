import React, { useState } from 'react';
import { 
  Wifi, 
  Layers, 
  CreditCard, 
  ShieldCheck, 
  Settings as SettingsIcon, 
  Search, 
  Plus, 
  LogOut, 
  Sun, 
  Moon, 
  WifiOff, 
  Download, 
  Menu, 
  X,
  Share2,
  CalendarDays,
  Send,
  MessageCircle,
  Users
} from 'lucide-react';
import { useAppStore } from '../lib/store';
import { formatArabicDate } from '../lib/dates';
import { useTheme } from '../hooks/useTheme';
import { Badge } from '../components/ui/Badge';
import { ConfirmModal } from '../components/ui/ConfirmModal';

interface LayoutProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  onOpenCommandMenu: () => void;
  onOpenAddSubscriber: () => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({
  currentTab,
  onTabChange,
  onOpenCommandMenu,
  onOpenAddSubscriber,
  onLogout,
  children
}) => {
  const { settings, currentAdmin, isOnline, pendingWrites, hasPermission } = useAppStore();
  const { theme, setTheme } = useTheme(settings.defaultTheme);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'لوحة التحكم', icon: Wifi, visible: true },
    { id: 'subscribers', label: 'المشتركون', icon: Layers, visible: hasPermission('subscribers_view') },
    { id: 'payments', label: 'الدفعات والسندات', icon: CreditCard, visible: hasPermission('payments_view') },
    { id: 'reminders', label: 'التذكيرات', icon: Send, visible: hasPermission('subscribers_view') },
    { id: 'users', label: 'المستخدمون والصلاحيات', icon: Users, visible: currentAdmin?.role === 'admin' },
    { id: 'audit', label: 'سجل الحركات', icon: ShieldCheck, visible: hasPermission('audit_view') },
    { id: 'settings', label: 'الإعدادات', icon: SettingsIcon, visible: currentAdmin?.role === 'admin' || hasPermission('settings_view') },
  ].filter(item => item.visible);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    /* ── Root shell: transparent → lets html/body bg show through ── */
    <div className="min-h-screen flex text-slate-900 dark:text-slate-100 selection:bg-brand-500 selection:text-white">

      {/* ════════════════════════════════════════════
          DESKTOP SIDEBAR — Glass panel
          ════════════════════════════════════════════ */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 glass border-e border-slate-200/70 dark:border-white/[0.07] h-screen sticky top-0 p-5 z-30">
        {/* Brand Logo */}
        <div className="flex items-center gap-3 pb-5 border-b border-slate-200/80 dark:border-white/[0.06]">
          <div className="w-10 h-10 rounded-2xl bg-brand-500 text-white flex items-center justify-center shadow-lg shadow-brand-500/30 shrink-0">
            <Wifi className="w-5 h-5" />
          </div>
          <div className="overflow-hidden">
            <h1 className="font-extrabold text-sm truncate text-slate-900 dark:text-white leading-tight">
              {settings.networkName}
            </h1>
            <p className="text-[11px] text-slate-400 mt-0.5">لوحة إدارة الاشتراكات</p>
          </div>
        </div>

        {/* Quick Search Button */}
        <div className="pt-4">
          <button
            onClick={onOpenCommandMenu}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl
                       border border-slate-200 dark:border-white/10
                       bg-slate-50/80 dark:bg-white/[0.04]
                       text-slate-400 text-xs
                       hover:border-brand-500/50 hover:bg-white dark:hover:bg-white/[0.07]
                       transition-all duration-200"
          >
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5" />
              <span>بحث سريع...</span>
            </div>
            <kbd className="font-mono text-[10px] bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 rounded border border-slate-200/80 dark:border-white/10 text-slate-400">
              /
            </kbd>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-5 space-y-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-brand-500 text-white shadow-md shadow-brand-500/30'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User Card + Logout */}
        <div className="pt-4 border-t border-slate-200/80 dark:border-white/[0.06]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-extrabold flex items-center justify-center text-xs shrink-0 border border-indigo-500/20">
                {currentAdmin?.name.charAt(0)}
              </div>
              <div className="overflow-hidden min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {currentAdmin?.name}
                </div>
                <Badge role={currentAdmin?.role} size="sm" className="mt-0.5" />
              </div>
            </div>

            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors shrink-0"
              title="تسجيل الخروج"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          <a
            href="https://wa.me/972592133357"
            target="_blank"
            rel="noopener noreferrer"
            title="تواصل واتساب مع المطور"
            className="mt-3 pt-2.5 border-t border-slate-200/80 dark:border-white/[0.06] flex items-center gap-2 group"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-black text-[11px] shadow-sm shadow-emerald-500/25 shrink-0">
              م
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate">م. محمد الجوجو</div>
              <div className="text-[10px] text-slate-400">تطوير ودعم المنظومة</div>
            </div>
            <span className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
              <MessageCircle className="w-3.5 h-3.5" />
            </span>
          </a>
        </div>
      </aside>

      {/* ════════════════════════════════════════════
          MAIN CONTENT AREA
          ════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* ── TOP HEADER ── */}
        <header className="sticky top-0 z-20 glass border-b border-slate-200/70 dark:border-white/[0.07] px-4 sm:px-6 py-3 flex items-center justify-between">

          {/* Left: Logo (mobile) */}
          <div className="flex items-center gap-3">
            <div className="lg:hidden flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-brand-500 text-white flex items-center justify-center shadow-md shrink-0">
                <Wifi className="w-4 h-4" />
              </div>
              <span className="font-bold text-sm text-slate-900 dark:text-white truncate max-w-[150px] sm:max-w-xs">
                {settings.networkName}
              </span>
            </div>
          </div>

          {/* Center: Day & Date (readable in light & dark modes) */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
            <CalendarDays className="w-3.5 h-3.5 text-brand-500 shrink-0" />
            <span>{formatArabicDate(new Date(), 'EEEE، d MMMM yyyy')}</span>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Search */}
            <button
              onClick={onOpenCommandMenu}
              className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.07] hover:text-slate-900 dark:hover:text-white transition-colors"
              title="بحث سريع (/)"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Connection Status Pill — online / syncing / offline with pending count */}
            {!isOnline ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-semibold">
                <WifiOff className="w-3.5 h-3.5 animate-pulse" />
                <span className="hidden sm:inline">
                  {pendingWrites > 0 ? `غير متصل — ${pendingWrites} بانتظار الرفع` : 'غير متصل — العمل دون اتصال'}
                </span>
              </div>
            ) : pendingWrites > 0 ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
                <span className="hidden sm:inline">جاري المزامنة... ({pendingWrites})</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="hidden sm:inline">متصل ومزامن</span>
              </div>
            )}

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl transition-all border
                         text-slate-600 dark:text-slate-300
                         bg-transparent hover:bg-slate-100 dark:hover:bg-white/[0.08]
                         border-slate-200 dark:border-white/10"
              title={theme === 'dark' ? 'التبديل إلى الثيم الفاتح' : 'التبديل إلى الثيم الداكن OLED'}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-brand-600" />
              )}
            </button>

            {/* Mobile Logout */}
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="lg:hidden p-2 rounded-xl text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
              title="تسجيل الخروج"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* ── PAGE CONTENT ── */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-24 lg:pb-8">
          {children}
        </main>

        {/* ── MOBILE BOTTOM NAV ── */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 glass border-t border-slate-200/70 dark:border-white/[0.07] z-30 px-2 py-1.5 flex items-center justify-around">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all min-w-[52px] ${
                  isActive
                    ? 'text-brand-500'
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'text-brand-500' : ''}`} />
                <span className="text-[9px] font-semibold">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Logout Confirmation Modal */}
      <ConfirmModal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        variant="danger"
        title="تسجيل الخروج من المنظومة"
        message="هل أنت متأكد من رغبتك في تسجيل الخروج وإنهاء جلسة العمل الحالية؟"
        confirmText="تسجيل الخروج"
        cancelText="البقاء مسجلاً"
        onConfirm={() => {
          setShowLogoutConfirm(false);
          onLogout();
        }}
      />
    </div>
  );
};
