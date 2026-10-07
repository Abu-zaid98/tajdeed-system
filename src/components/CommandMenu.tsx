import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, User, Phone, MapPin, ArrowRight, Plus, Wifi, Layers, CreditCard, Settings as SettingsIcon } from 'lucide-react';
import { useAppStore } from '../lib/store';
import { Badge } from './ui/Badge';

interface CommandMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSubscriber: (id: string) => void;
  onOpenAddSubscriber: () => void;
  onNavigate: (tab: string) => void;
}

export const CommandMenu: React.FC<CommandMenuProps> = ({
  isOpen,
  onClose,
  onSelectSubscriber,
  onOpenAddSubscriber,
  onNavigate
}) => {
  const { subscribersWithDetails, currentAdmin, hasPermission } = useAppStore();
  const [query, setQuery] = useState('');

  const canSearchSubscribers = hasPermission('subscribers_view');
  const canAddSubscriber = hasPermission('subscribers_create');
  const canOpenPayments = hasPermission('payments_view');
  const isAdmin = currentAdmin?.role === 'admin';

  useEffect(() => {
    if (isOpen) {
      setQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const filteredSubscribers = query.trim()
    ? subscribersWithDetails.filter(s =>
        s.name.toLowerCase().includes(query.toLowerCase()) ||
        (s.phone && s.phone.includes(query)) ||
        (s.area && s.area.toLowerCase().includes(query.toLowerCase())) ||
        (s.currentSubscription && s.currentSubscription.username.toLowerCase().includes(query.toLowerCase()))
      ).slice(0, 5)
    : [];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            className="relative w-full max-w-xl bg-white dark:bg-[#090d18] rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden z-10 text-start text-slate-900 dark:text-white"
          >
            {/* Search Input Bar */}
            <div className="flex items-center px-4 border-b border-slate-100 dark:border-white/5 py-3">
              <Search className="w-5 h-5 text-slate-400 ms-1 me-3 shrink-0" />
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="ابحث بالاسم، رقم الهاتف، اسم المستخدم، أو المنطقة..."
                className="w-full bg-transparent border-0 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
              />
              <span className="text-[10px] font-mono bg-slate-100 dark:bg-white/10 text-slate-500 px-2 py-0.5 rounded-md">
                ESC
              </span>
            </div>

            {/* Results or Quick Actions */}
            <div className="max-h-80 overflow-y-auto p-2 space-y-1">
              {canSearchSubscribers && filteredSubscribers.length > 0 ? (
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 px-3 py-1.5">
                    المشتركون المطابقون ({filteredSubscribers.length})
                  </div>
                  {filteredSubscribers.map(sub => (
                    <button
                      key={sub.id}
                      onClick={() => {
                        onSelectSubscriber(sub.id);
                        onClose();
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group text-start"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold text-xs">
                          {sub.name.charAt(0)}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-brand-500 transition-colors">
                            {sub.name}
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                            {sub.phone && <span className="dir-ltr">{sub.phone}</span>}
                            {sub.area && <span>• {sub.area}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge status={sub.computedStatus} size="sm" />
                        <ArrowRight className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : query.trim() ? (
                canSearchSubscribers ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    لا توجد نتائج مطابقة لـ "{query}"
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-slate-400">
                    البحث في المشتركين يتطلب صلاحية عرض المشتركين
                  </div>
                )
              ) : (
                <div className="p-2 space-y-1">
                  <div className="text-[11px] font-semibold text-slate-400 px-3 py-1">إجراءات سريعة</div>
                  {canAddSubscriber && (
                  <button
                    onClick={() => {
                      onOpenAddSubscriber();
                      onClose();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-start"
                  >
                    <div className="w-6 h-6 rounded-md bg-brand-500/10 text-brand-500 flex items-center justify-center">
                      <Plus className="w-3.5 h-3.5" />
                    </div>
                    <span>إضافة مشترك جديد (N)</span>
                  </button>
                  )}
                  <button
                    onClick={() => {
                      onNavigate('dashboard');
                      onClose();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-start"
                  >
                    <div className="w-6 h-6 rounded-md bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                      <Wifi className="w-3.5 h-3.5" />
                    </div>
                    <span>لوحة المؤشرات والتحكم</span>
                  </button>
                  {canSearchSubscribers && (
                  <button
                    onClick={() => {
                      onNavigate('subscribers');
                      onClose();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-start"
                  >
                    <div className="w-6 h-6 rounded-md bg-cyan-500/10 text-cyan-500 flex items-center justify-center">
                      <Layers className="w-3.5 h-3.5" />
                    </div>
                    <span>قائمة المشتركين والفرز</span>
                  </button>
                  )}
                  {canOpenPayments && (
                  <button
                    onClick={() => {
                      onNavigate('payments');
                      onClose();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-start"
                  >
                    <div className="w-6 h-6 rounded-md bg-purple-500/10 text-purple-500 flex items-center justify-center">
                      <CreditCard className="w-3.5 h-3.5" />
                    </div>
                    <span>سجل سندات القبض والدفعات</span>
                  </button>
                  )}
                  {isAdmin && (
                  <button
                    onClick={() => {
                      onNavigate('users');
                      onClose();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-start"
                  >
                    <div className="w-6 h-6 rounded-md bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <span>إدارة المستخدمين والصلاحيات</span>
                  </button>
                  )}
                </div>
              )}
            </div>

            {/* Footer tips */}
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[11px] text-slate-400">
              <span>اضغط Enter للفتح، أو Esc للإلغاء</span>
              <div className="flex items-center gap-2">
                <span>اختصار البحث: <kbd className="font-mono bg-white dark:bg-white/10 px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/10">/</kbd></span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
