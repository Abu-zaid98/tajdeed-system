import React, { useState } from 'react';
import { 
  ShieldCheck, 
  UserPlus, 
  Users, 
  Lock, 
  Edit2, 
  UserCheck, 
  UserX, 
  CheckSquare, 
  Square, 
  X, 
  AlertCircle,
  KeyRound,
  Shield,
  Search,
  Filter,
  Trash2
} from 'lucide-react';
import { useAppStore } from '../../lib/store';
import { formatArabicDateTime } from '../../lib/dates';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { ALL_MODERATOR_PERMISSIONS } from '../../types';
import type { ModeratorPermission, Admin } from '../../types';
import { toast } from 'sonner';

export const UsersManagementView: React.FC = () => {
  const { 
    admins, 
    createModerator, 
    updateModerator, 
    toggleAdminActive,
    deleteModerator,
    currentAdmin 
  } = useAppStore();

  const isAdmin = currentAdmin?.role === 'admin';

  // Search and filter
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'moderator'>('all');

  // New moderator form
  const [newModName, setNewModName] = useState('');
  const [newModEmail, setNewModEmail] = useState('');
  const [newModPassword, setNewModPassword] = useState('');
  const [newModPermissions, setNewModPermissions] = useState<ModeratorPermission[]>([
    'subscribers_view',
    'subscriptions_renew',
    'payments_create'
  ]);
  const [isCreatingMod, setIsCreatingMod] = useState(false);

  // Edit moderator permissions modal
  const [editingMod, setEditingMod] = useState<Admin | null>(null);
  const [editPermissions, setEditPermissions] = useState<ModeratorPermission[]>([]);

  // Confirm modal for toggle active/inactive
  const [confirmToggleUser, setConfirmToggleUser] = useState<Admin | null>(null);
  // Confirm modal for delete
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<Admin | null>(null);

  if (!isAdmin) {
    return (
      <div className="p-8 text-center glass-card rounded-3xl max-w-lg mx-auto space-y-4 my-12">
        <div className="w-16 h-16 rounded-3xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">وصول غير مصرح</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          صفحة إدارة المستخدمين وتعيين الصلاحيات مخصصة للمدير العام (Admin) فقط. لا تملك صلاحية الوصول لهذه الصفحة.
        </p>
      </div>
    );
  }

  const filteredAdmins = admins.filter(a => {
    if (roleFilter !== 'all' && a.role !== roleFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q);
    }
    return true;
  });

  const handleCreateModerator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModName.trim() || !newModEmail.trim() || !newModPassword.trim()) {
      toast.error('يرجى ملء كافة الحقول وتحديد كلمة المرور');
      return;
    }

    setIsCreatingMod(true);
    try {
      await createModerator({
        name: newModName.trim(),
        email: newModEmail.trim(),
        password: newModPassword.trim(),
        permissions: newModPermissions,
        role: 'moderator',
        active: true
      });
      setNewModName('');
      setNewModEmail('');
      setNewModPassword('');
      setNewModPermissions(['subscribers_view', 'subscriptions_renew', 'payments_create']);
    } catch (err: any) {
      toast.error(err.message || 'تعذر إنشاء حساب المشرف');
    } finally {
      setIsCreatingMod(false);
    }
  };

  const toggleNewPermission = (key: ModeratorPermission) => {
    setNewModPermissions(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const toggleEditPermission = (key: ModeratorPermission) => {
    setEditPermissions(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const openEditPermissionsModal = (mod: Admin) => {
    setEditingMod(mod);
    setEditPermissions(mod.permissions || []);
  };

  const saveEditPermissions = async () => {
    if (!editingMod) return;
    await updateModerator(editingMod.id, {
      permissions: editPermissions
    }, { base: editingMod });
    setEditingMod(null);
  };

  return (
    <div className="space-y-6 text-start max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-brand-500" />
            <span>إدارة المستخدمين والمشرفين (RBAC)</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            إدارة حسابات طاقم العمل، التحكم في حالات التفعيل، وتعيين الصلاحيات بدقة متناهية
          </p>
        </div>

        {/* Stats summary pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-3 py-1.5 rounded-xl glass text-xs font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand-500" />
            <span>إجمالي الحسابات: {admins.length}</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl glass text-xs font-semibold flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>نشط: {admins.filter(a => a.active !== false).length}</span>
          </div>
        </div>
      </div>

      {/* Main Content Layout: Accounts List + Create Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (2 cols): Existing Users List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-card p-4 sm:p-5 rounded-3xl space-y-4">
            
            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="ابحث بالاسم أو البريد الإلكتروني..."
                  startIcon={<Search className="w-4 h-4" />}
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRoleFilter('all')}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    roleFilter === 'all' 
                      ? 'bg-brand-500 text-white shadow-xs' 
                      : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  الكل ({admins.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRoleFilter('admin')}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    roleFilter === 'admin' 
                      ? 'bg-brand-500 text-white shadow-xs' 
                      : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  مدير ({admins.filter(a => a.role === 'admin').length})
                </button>
                <button
                  type="button"
                  onClick={() => setRoleFilter('moderator')}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    roleFilter === 'moderator' 
                      ? 'bg-brand-500 text-white shadow-xs' 
                      : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  مشرف ({admins.filter(a => a.role === 'moderator').length})
                </button>
              </div>
            </div>

            {/* Users List Cards */}
            <div className="space-y-3">
              {filteredAdmins.length > 0 ? (
                filteredAdmins.map(admin => {
                  const isCurrent = admin.id === currentAdmin?.id;
                  const isTargetAdmin = admin.role === 'admin';

                  return (
                    <div
                      key={admin.id}
                      className="p-4 rounded-2xl border border-slate-200/80 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.01] hover:border-brand-500/30 transition-all space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-base shrink-0 ${
                            isTargetAdmin 
                              ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20' 
                              : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                          }`}>
                            {admin.name.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-slate-900 dark:text-white">
                                {admin.name}
                              </span>
                              <Badge role={admin.role} size="sm" />
                              {admin.active === false ? (
                                <Badge variant="danger" size="sm">معطّل</Badge>
                              ) : (
                                <Badge variant="success" size="sm">نشط</Badge>
                              )}
                              {isCurrent && (
                                <span className="text-[10px] bg-brand-500/10 text-brand-600 px-2 py-0.5 rounded-full font-bold">
                                  أنت
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-slate-400 font-mono block mt-0.5">
                              {admin.email}
                            </span>
                            <span className="text-[11px] text-slate-400 block mt-0.5">
                              آخر دخول: {admin.lastLoginAt ? formatArabicDateTime(admin.lastLoginAt) : 'لم يسجل بعد'}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        {!isCurrent && (
                          <div className="flex items-center gap-2 self-end sm:self-center">
                            {!isTargetAdmin && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => openEditPermissionsModal(admin)}
                                leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                              >
                                الصلاحيات
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant={admin.active === false ? 'glass' : 'danger'}
                              onClick={() => setConfirmToggleUser(admin)}
                              leftIcon={admin.active === false ? <UserCheck className="w-3.5 h-3.5 text-emerald-500" /> : <UserX className="w-3.5 h-3.5" />}
                            >
                              {admin.active === false ? 'تفعيل' : 'تعطيل'}
                            </Button>

                            {/* Delete button — only for moderators, never for admin accounts */}
                            {!isTargetAdmin && (
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => setConfirmDeleteUser(admin)}
                                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                                className="border-rose-500/40 hover:bg-rose-500/25"
                              >
                                حذف
                              </Button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Display assigned permissions badges */}
                      {!isTargetAdmin && (
                        <div className="pt-2 border-t border-slate-200/60 dark:border-white/5 space-y-1.5">
                          <span className="text-[11px] text-slate-400 font-medium block">
                            الصلاحيات الممنوحة:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {admin.permissions && admin.permissions.length > 0 ? (
                              admin.permissions.map(p => {
                                const pDef = ALL_MODERATOR_PERMISSIONS.find(def => def.key === p);
                                return (
                                  <span
                                    key={p}
                                    className="text-[10px] px-2.5 py-1 rounded-lg bg-white dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/5 font-medium"
                                  >
                                    {pDef?.label || p}
                                  </span>
                                );
                              })
                            ) : (
                              <span className="text-[11px] text-rose-500 font-medium">
                                لا توجد صلاحيات ممنوحة لهذا المشرف (محظور من كافة العمليات)
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs">
                  لا يوجد مستخدمون مطابقون لمعايير البحث
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (1 col): Create Moderator Form */}
        <div className="space-y-4">
          <form onSubmit={handleCreateModerator} className="glass-card p-5 sm:p-6 rounded-3xl space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-white/5 pb-3">
              <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold">
                <UserPlus className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-bold text-sm text-slate-900 dark:text-white">إضافة مشرف جديد</h2>
                <p className="text-[11px] text-slate-400">إنشاء حساب دخول حقيقي وآمن</p>
              </div>
            </div>

            <div className="space-y-3">
              <Input
                label="الاسم الكامل"
                value={newModName}
                onChange={e => setNewModName(e.target.value)}
                placeholder="مثال: أحمد عبد الله"
                required
              />

              <Input
                label="البريد الإلكتروني"
                type="email"
                value={newModEmail}
                onChange={e => setNewModEmail(e.target.value)}
                placeholder="ahmed@network.iq"
                dir="ltr"
                className="text-start"
                required
              />

              <Input
                label="كلمة المرور المؤقتة"
                type="password"
                value={newModPassword}
                onChange={e => setNewModPassword(e.target.value)}
                placeholder="••••••••••••"
                dir="ltr"
                className="text-start"
                required
              />
            </div>

            {/* Checklist */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  تحديد الصلاحيات ({newModPermissions.length}):
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (newModPermissions.length === ALL_MODERATOR_PERMISSIONS.length) {
                      setNewModPermissions([]);
                    } else {
                      setNewModPermissions(ALL_MODERATOR_PERMISSIONS.map(p => p.key));
                    }
                  }}
                  className="text-[10px] text-brand-500 hover:underline"
                >
                  {newModPermissions.length === ALL_MODERATOR_PERMISSIONS.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
                </button>
              </div>

              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {ALL_MODERATOR_PERMISSIONS.map(perm => {
                  const checked = newModPermissions.includes(perm.key);
                  return (
                    <button
                      key={perm.key}
                      type="button"
                      onClick={() => toggleNewPermission(perm.key)}
                      className={`w-full p-2 rounded-xl border text-xs flex items-center justify-between gap-2 transition-all text-start ${
                        checked 
                          ? 'border-brand-500/40 bg-brand-500/10 text-slate-900 dark:text-white font-medium' 
                          : 'border-slate-200/80 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.01] text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      <div className="truncate">
                        <span className="block truncate font-semibold">{perm.label}</span>
                        <span className="text-[10px] text-slate-400 block truncate">{perm.description}</span>
                      </div>
                      {checked ? (
                        <CheckSquare className="w-4 h-4 text-brand-500 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              size="md"
              isLoading={isCreatingMod}
              leftIcon={<UserPlus className="w-4 h-4" />}
            >
              إنشاء حساب المشرف
            </Button>
          </form>
        </div>
      </div>

      {/* Edit Moderator Permissions Modal */}
      {editingMod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="glass-card w-full max-w-xl p-6 rounded-3xl space-y-5 border border-slate-200 dark:border-white/10 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-brand-500" />
                  <span>تعديل صلاحيات المشرف: {editingMod.name}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">{editingMod.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingMod(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                حدد الصلاحيات المصرح بها لهذا المشرف:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ALL_MODERATOR_PERMISSIONS.map(perm => {
                  const checked = editPermissions.includes(perm.key);
                  return (
                    <button
                      key={perm.key}
                      type="button"
                      onClick={() => toggleEditPermission(perm.key)}
                      className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 transition-all text-start ${
                        checked 
                          ? 'border-brand-500/50 bg-brand-500/10 text-slate-900 dark:text-white font-medium'
                          : 'border-slate-200 dark:border-white/5 bg-white dark:bg-white/[0.02] text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      {checked ? (
                        <CheckSquare className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="font-semibold">{perm.label}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{perm.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-white/5">
              <Button variant="ghost" size="sm" onClick={() => setEditingMod(null)}>
                إلغاء
              </Button>
              <Button variant="primary" size="sm" onClick={saveEditPermissions}>
                حفظ الصلاحيات
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Toggle User Active Modal */}
      <ConfirmModal
        isOpen={Boolean(confirmToggleUser)}
        onClose={() => setConfirmToggleUser(null)}
        variant={confirmToggleUser?.active ? 'danger' : 'warning'}
        title={confirmToggleUser?.active ? 'تعطيل حساب المشرف' : 'تفعيل حساب المشرف'}
        message={
          confirmToggleUser?.active
            ? `هل أنت متأكد من تعطيل حساب (${confirmToggleUser?.name})؟ سيتم منعه فوراً من تسجيل الدخول للنظام.`
            : `هل أنت متأكد من تفعيل حساب (${confirmToggleUser?.name})؟ سيتمكن المشرف من تسجيل الدخول واستخدام صلاحياته.`
        }
        confirmText={confirmToggleUser?.active ? 'تعطيل الحساب' : 'تفعيل الحساب'}
        onConfirm={async () => {
          if (confirmToggleUser) {
            await toggleAdminActive(confirmToggleUser.id);
            setConfirmToggleUser(null);
          }
        }}
      />
      {/* Confirm Delete User Modal */}
      <ConfirmModal
        isOpen={Boolean(confirmDeleteUser)}
        onClose={() => setConfirmDeleteUser(null)}
        variant="danger"
        title="حذف حساب المشرف نهائياً"
        message={`هل أنت متأكد من حذف حساب المشرف "${confirmDeleteUser?.name}" (${confirmDeleteUser?.email}) بشكل نهائي؟\n\nسيتم حذف البيانات من قاعدة البيانات السحابية نهائياً. لا يمكن التراجع عن هذا الإجراء.`}
        confirmText="نعم، احذف نهائياً"
        onConfirm={async () => {
          if (confirmDeleteUser) {
            await deleteModerator(confirmDeleteUser.id);
            setConfirmDeleteUser(null);
          }
        }}
      />
    </div>
  );
};
