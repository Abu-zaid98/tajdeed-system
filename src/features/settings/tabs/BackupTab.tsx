import React, { useState } from 'react';
import { DatabaseBackup, History, Download, Upload, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { CustomSelect } from '../../../components/ui/CustomSelect';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { downloadJsonFile, formatBytes } from '../../../lib/utils';
import { formatArabicDateTime } from '../../../lib/dates';
import { toast } from 'sonner';
import type { BackupMeta, Settings } from '../../../types';

interface BackupTabProps {
  settings: Settings;
  isAdmin: boolean;
  backups: BackupMeta[];
  hasExportPermission: boolean;
  updateSettings: (s: Partial<Settings>) => void;
  createCloudBackup: (manual?: boolean) => Promise<string>;
  restoreCloudBackup: (id: string) => Promise<boolean>;
  deleteCloudBackup: (id: string) => Promise<void>;
  downloadCloudBackup: (id: string) => Promise<void>;
  exportAllData: () => object;
  importAllData: (jsonData: any) => Promise<boolean>;
}

export const BackupTab: React.FC<BackupTabProps> = ({
  settings,
  isAdmin,
  backups,
  hasExportPermission,
  updateSettings,
  createCloudBackup,
  restoreCloudBackup,
  deleteCloudBackup,
  downloadCloudBackup,
  exportAllData,
  importAllData,
}) => {
  const [autoBackupIntervalHours, setAutoBackupIntervalHours] = useState(settings.autoBackupIntervalHours || 0);
  const [autoBackupRetention, setAutoBackupRetention] = useState(settings.autoBackupRetention || 10);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<BackupMeta | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BackupMeta | null>(null);

  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      toast.error('تعديل جدولة النسخ متاح للمسؤول (Admin) فقط');
      return;
    }
    updateSettings({ autoBackupIntervalHours, autoBackupRetention });
  };

  const handleExportBackup = () => {
    try {
      const data = exportAllData();
      downloadJsonFile(data, `نسخة_احتياطية_تجديد_${new Date().toISOString().slice(0, 10)}.json`);
      toast.success('تم تحميل ملف النسخة الاحتياطية بنجاح');
    } catch {
      // toast shown in store
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        importAllData(json);
      } catch {
        toast.error('ملف النسخة الاحتياطية غير صالح');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleManualCloudBackup = async () => {
    setIsBackingUp(true);
    try {
      await createCloudBackup(true);
    } catch {
      // Feedback already shown
    } finally {
      setIsBackingUp(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Schedule */}
      <form onSubmit={handleSaveSchedule} className="glass-card p-5 sm:p-6 rounded-3xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">
              <DatabaseBackup className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-slate-900 dark:text-white">النسخ الاحتياطي التلقائي</h2>
              <p className="text-xs text-slate-400">نسخ سحابية تُنشأ من أي جهاز متصل عند انقضاء المدة</p>
            </div>
          </div>
          {isAdmin && (
            <Button size="sm" type="submit">
              حفظ
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CustomSelect<number>
            label="تكرار النسخ التلقائي"
            value={autoBackupIntervalHours}
            onChange={setAutoBackupIntervalHours}
            disabled={!isAdmin}
            options={[
              { value: 0, label: 'إيقاف (يدوي فقط)' },
              { value: 12, label: 'كل 12 ساعة' },
              { value: 24, label: 'يومياً' },
              { value: 72, label: 'كل 3 أيام' },
              { value: 168, label: 'أسبوعياً' },
            ]}
          />
          <CustomSelect<number>
            label="الاحتفاظ بآخر عدد من النسخ"
            value={autoBackupRetention}
            onChange={setAutoBackupRetention}
            disabled={!isAdmin}
            options={[
              { value: 5, label: 'آخر 5 نسخ' },
              { value: 10, label: 'آخر 10 نسخ' },
              { value: 20, label: 'آخر 20 نسخة' },
              { value: 30, label: 'آخر 30 نسخة' },
            ]}
          />
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          الأقدم من العدد المحتفظ به يُحذف تلقائياً.
        </p>
      </form>

      {/* Manual actions + cloud list */}
      <div className="glass-card p-5 sm:p-6 rounded-3xl space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          {hasExportPermission && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleManualCloudBackup}
              isLoading={isBackingUp}
              leftIcon={<DatabaseBackup className="w-4 h-4" />}
            >
              إنشاء نسخة سحابية الآن
            </Button>
          )}

          {hasExportPermission && (
            <Button
              variant="glass"
              size="sm"
              onClick={handleExportBackup}
              leftIcon={<Download className="w-4 h-4 text-brand-500" />}
            >
              تصدير ملف (JSON)
            </Button>
          )}

          {isAdmin && (
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium glass cursor-pointer hover:bg-white/80 dark:hover:bg-slate-800 transition-colors">
              <Upload className="w-4 h-4 text-emerald-500" />
              <span>استيراد ملف</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportBackup}
                className="hidden"
              />
            </label>
          )}
        </div>

        {hasExportPermission && (
          <div className="pt-4 border-t border-slate-100 dark:border-white/5 space-y-3">
            <h3 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <History className="w-4 h-4 text-brand-500" />
              <span>النسخ السحابية المحفوظة ({backups.length})</span>
            </h3>

            {backups.length > 0 ? (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {backups.map(b => (
                  <div
                    key={b.id}
                    className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.01] flex flex-col sm:flex-row sm:items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs text-slate-900 dark:text-white">
                          {formatArabicDateTime(b.createdAt)}
                        </span>
                        {b.auto ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 font-bold">
                            تلقائية
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 font-bold">
                            يدوية
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                        <span>بواسطة {b.createdByName}</span>
                        <span>•</span>
                        <span>
                          {b.counts.subscribers.toLocaleString('en-US')} مشترك،{' '}
                          {b.counts.subscriptions.toLocaleString('en-US')} اشتراك،{' '}
                          {b.counts.payments.toLocaleString('en-US')} دفعة
                        </span>
                        <span>•</span>
                        <span>{formatBytes(b.sizeBytes)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="glass"
                        onClick={() => downloadCloudBackup(b.id)}
                        leftIcon={<Download className="w-3.5 h-3.5" />}
                      >
                        تنزيل
                      </Button>
                      {isAdmin && (
                        <>
                          <Button
                            size="sm"
                            variant="glass"
                            onClick={() => setRestoreTarget(b)}
                          >
                            استعادة
                          </Button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(b)}
                            className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                            title="حذف النسخة"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-slate-400 text-xs">
                لا توجد نسخ سحابية بعد — أنشئ الأولى بالزر أعلاه أو فعّل النسخ التلقائي
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirm Cloud Restore Modal */}
      <ConfirmModal
        isOpen={Boolean(restoreTarget)}
        onClose={() => setRestoreTarget(null)}
        variant="warning"
        title="استعادة نسخة احتياطية سحابية"
        message={`سيتم استبدال البيانات الحالية بنسخة ${restoreTarget ? formatArabicDateTime(restoreTarget.createdAt) : ''} (${restoreTarget?.auto ? 'تلقائية' : 'يدوية'}). يُنصح بإنشاء نسخة سحابية الآن أولاً كضمان. متابعة؟`}
        confirmText="نعم، استعد النسخة"
        onConfirm={async () => {
          if (restoreTarget) {
            await restoreCloudBackup(restoreTarget.id);
            setRestoreTarget(null);
          }
        }}
      />

      {/* Confirm Cloud Backup Delete Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        variant="danger"
        title="حذف النسخة الاحتياطية"
        message={`هل أنت متأكد من حذف نسخة ${deleteTarget ? formatArabicDateTime(deleteTarget.createdAt) : ''} (${deleteTarget?.auto ? 'تلقائية' : 'يدوية'}) نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`}
        confirmText="نعم، احذف نهائياً"
        onConfirm={async () => {
          if (deleteTarget) {
            await deleteCloudBackup(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
      />
    </div>
  );
};
