import React, { useState } from 'react';
import {
  Settings as SettingsIcon,
  Wifi,
  Tag,
  DatabaseBackup,
  ShieldCheck,
  Activity,
  Lock,
  Users
} from 'lucide-react';
import { useAppStore } from '../../lib/store';
import { Button } from '../../components/ui/Button';
import { GeneralTab } from './tabs/GeneralTab';
import { PlansTab } from './tabs/PlansTab';
import { BackupTab } from './tabs/BackupTab';
import { SecurityTab } from './tabs/SecurityTab';
import { SystemTab } from './tabs/SystemTab';

type SettingsTabId = 'general' | 'plans' | 'backup' | 'security' | 'system';

const TABS: { id: SettingsTabId; label: string; icon: React.ReactNode }[] = [
  { id: 'general', label: 'البيانات العامة', icon: <Wifi className="w-4 h-4" /> },
  { id: 'plans', label: 'الباقات والأسعار', icon: <Tag className="w-4 h-4" /> },
  { id: 'backup', label: 'النسخ الاحتياطي', icon: <DatabaseBackup className="w-4 h-4" /> },
  { id: 'security', label: 'الأمان', icon: <ShieldCheck className="w-4 h-4" /> },
  { id: 'system', label: 'النظام', icon: <Activity className="w-4 h-4" /> },
];

export const SettingsView: React.FC<{ onNavigateToUsers?: () => void }> = ({ onNavigateToUsers }) => {
  const {
    settings,
    updateSettings,
    currentAdmin,
    exportAllData,
    importAllData,
    resetToCleanData,
    backups,
    createCloudBackup,
    restoreCloudBackup,
    deleteCloudBackup,
    downloadCloudBackup,
    hasPermission
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<SettingsTabId>('general');
  const isAdmin = currentAdmin?.role === 'admin';

  return (
    <div className="space-y-6 text-start max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <SettingsIcon className="w-6 h-6 text-brand-500" />
            <span>إعدادات النظام والشبكة</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            الهوية والباقات والنسخ والأمان وحالة النظام
          </p>
        </div>

        {isAdmin && onNavigateToUsers && (
          <Button
            variant="glass"
            size="sm"
            onClick={onNavigateToUsers}
            leftIcon={<Users className="w-4 h-4 text-brand-500" />}
          >
            إدارة المستخدمين والصلاحيات
          </Button>
        )}
      </div>

      {/* Role Restriction Banner if moderator */}
      {!isAdmin && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2.5">
          <Lock className="w-4 h-4 shrink-0 text-amber-500" />
          <span>
            أنت مسجل حالياً بصلاحية مشرف (Moderator). يمكنك الاطلاع على الإعدادات فقط (قراءة فقط).
          </span>
        </div>
      )}

      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="أقسام الإعدادات"
        className="glass p-1.5 rounded-2xl flex items-center gap-1.5 overflow-x-auto"
      >
        {TABS.map(tab => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-brand-500 text-white shadow-md shadow-brand-500/30'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className={active ? 'text-white' : 'text-slate-400 dark:text-slate-500'}>
                {tab.icon}
              </span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active tab (remounts on switch, so fields always reflect latest settings) */}
      <div key={activeTab} className="animate-in fade-in slide-in-from-bottom-2 duration-200">
        {activeTab === 'general' && (
          <GeneralTab settings={settings} isAdmin={isAdmin} updateSettings={updateSettings} />
        )}
        {activeTab === 'plans' && (
          <PlansTab settings={settings} isAdmin={isAdmin} updateSettings={updateSettings} />
        )}
        {activeTab === 'backup' && (
          <BackupTab
            settings={settings}
            isAdmin={isAdmin}
            backups={backups}
            hasExportPermission={hasPermission('reports_export')}
            updateSettings={updateSettings}
            createCloudBackup={createCloudBackup}
            restoreCloudBackup={restoreCloudBackup}
            deleteCloudBackup={deleteCloudBackup}
            downloadCloudBackup={downloadCloudBackup}
            exportAllData={exportAllData}
            importAllData={importAllData}
          />
        )}
        {activeTab === 'security' && (
          <SecurityTab
            settings={settings}
            isAdmin={isAdmin}
            currentEmail={currentAdmin?.email}
            updateSettings={updateSettings}
          />
        )}
        {activeTab === 'system' && (
          <SystemTab
            isAdmin={isAdmin}
            currentAccountId={currentAdmin?.id}
            resetToCleanData={resetToCleanData}
          />
        )}
      </div>
    </div>
  );
};
