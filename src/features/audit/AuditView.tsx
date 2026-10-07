import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, 
  Search, 
  Clock, 
  User, 
  ArrowRight, 
  FileText, 
  Eye, 
  Layers,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useAppStore } from '../../lib/store';
import { formatArabicDateTime } from '../../lib/dates';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { CustomSelect } from '../../components/ui/CustomSelect';
import type { AuditLog } from '../../types';
import { AUDIT_ENTITY_LABELS } from '../../types';

export const AuditView: React.FC = () => {
  const { auditLogs } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntity, setSelectedEntity] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(200);

  useEffect(() => {
    setVisibleCount(200);
  }, [searchQuery, selectedEntity]);

  const filteredLogs = useMemo(() => {
    const list = auditLogs.filter(log => {
      if (selectedEntity !== 'all' && log.entity !== selectedEntity) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        log.action.toLowerCase().includes(q) ||
        log.userName.toLowerCase().includes(q) ||
        (log.entityName && log.entityName.toLowerCase().includes(q))
      );
    });
    return [...list].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [auditLogs, searchQuery, selectedEntity]);

  const visibleLogs = filteredLogs.slice(0, visibleCount);

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  return (
    <div className="space-y-5 text-start">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>سجل الحركات والرقابة</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              {auditLogs.length.toLocaleString('en-US')} حركة مسجلة
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            سجل غير قابل للتعديل يوثق كافة العمليات الحساسة ومن قام بها ووقتها مع تتبع القيم السابقة واللاحقة
          </p>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="glass-card p-4 rounded-2xl flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="ابحث في سجل العمليات، اسم المنفّذ، أو المشترك..."
            startIcon={<Search className="w-4 h-4" />}
          />
        </div>

        <CustomSelect
          value={selectedEntity}
          onChange={(v) => setSelectedEntity(v)}
          size="sm"
          options={[
            { value: 'all', label: 'كافة أنواع العمليات' },
            { value: 'subscriber', label: 'مشتركون' },
            { value: 'subscription', label: 'اشتراكات وتجديد' },
            { value: 'payment', label: 'سندات ودفعات' },
            { value: 'settings', label: 'إعدادات النظام' },
            { value: 'admin', label: 'إدارة المسؤولين' },
          ]}
        />
      </div>

      {/* Audit Log Timeline Entries */}
      <div className="space-y-2.5">
        {visibleLogs.length > 0 ? (
          visibleLogs.map(log => {
            const isExpanded = expandedId === log.id;
            const hasDetails = Boolean(log.before || log.after);

            return (
              <div
                key={log.id}
                className="glass-card rounded-2xl p-4 transition-all hover:border-slate-300 dark:hover:border-white/20"
              >
                <div 
                  onClick={() => hasDetails && toggleExpand(log.id)}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${hasDetails ? 'cursor-pointer' : ''}`}
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white">
                        {log.action}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                          <User className="w-3 h-3 text-slate-400" />
                          {log.userName}
                        </span>
                        <span>•</span>
                        <span>{formatArabicDateTime(log.at)}</span>
                        {log.entityName && (
                          <>
                            <span>•</span>
                            <span className="text-brand-600 dark:text-brand-400 font-medium">{log.entityName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <span className="text-[11px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 px-2.5 py-1 rounded-lg">
                      {AUDIT_ENTITY_LABELS[log.entity] ?? log.entity}
                    </span>
                    {hasDetails ? (
                      <span className="text-slate-400 p-1">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Expanded Details Diff */}
                {isExpanded && hasDetails ? (
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                    {Boolean(log.before) ? (
                      <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20 text-rose-800 dark:text-rose-300">
                        <div className="font-bold mb-1 text-[11px]">القيمة السابقة:</div>
                        <pre className="overflow-x-auto text-[11px] whitespace-pre-wrap">
                          {JSON.stringify(log.before, null, 2)}
                        </pre>
                      </div>
                    ) : null}

                    {Boolean(log.after) ? (
                      <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                        <div className="font-bold mb-1 text-[11px]">القيمة الجديدة:</div>
                        <pre className="overflow-x-auto text-[11px] whitespace-pre-wrap">
                          {JSON.stringify(log.after, null, 2)}
                        </pre>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })
        ) : (
          <div className="py-12 text-center text-slate-400 text-xs">
            لا توجد سجلات مطابقة للبحث
          </div>
        )}
        {filteredLogs.length > visibleLogs.length && (
          <button
            type="button"
            onClick={() => setVisibleCount(c => c + 200)}
            className="w-full py-3 rounded-2xl glass text-xs font-bold text-brand-500 hover:bg-brand-500/10 transition-colors"
          >
            عرض المزيد ({(filteredLogs.length - visibleLogs.length).toLocaleString('en-US')} متبقية)
          </button>
        )}
      </div>
    </div>
  );
};
