import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Search, 
  FileText, 
  User,
  FileSpreadsheet,
  Trash2,
  Edit2,
  Check,
  X
} from 'lucide-react';
import { useAppStore } from '../../lib/store';
import { formatArabicDateTime } from '../../lib/dates';
import { formatCurrency, exportToCsv } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { toast } from 'sonner';
import type { Payment, Subscription } from '../../types';

interface PaymentsViewProps {
  onViewReceipt: (payment: Payment, subscription: Subscription) => void;
}

export const PaymentsView: React.FC<PaymentsViewProps> = ({ onViewReceipt }) => {
  const { payments, subscribers, subscriptions, settings, deletePayment, updatePayment, hasPermission, currentAdmin } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');

  // Delete confirm state
  const [confirmDelete, setConfirmDelete] = useState<Payment | null>(null);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editNote, setEditNote] = useState<string>('');
  const [editBase, setEditBase] = useState<Payment | null>(null);

  // Incremental rendering for large lists
  const [visibleCount, setVisibleCount] = useState(60);
  useEffect(() => {
    setVisibleCount(60);
  }, [searchQuery]);

  const canManagePayments = hasPermission('payments_create') || currentAdmin?.role === 'admin';

  // Total collected
  const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);

  // Filtered payments (newest first)
  const filteredPayments = payments
    .filter(p => {
      const sub = subscribers.find(s => s.id === p.subscriberId);
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const nameMatch = sub ? sub.name.toLowerCase().includes(q) : false;
      const noteMatch = p.note ? p.note.toLowerCase().includes(q) : false;
      const receiverMatch = p.receivedBy.toLowerCase().includes(q);
      return nameMatch || noteMatch || receiverMatch;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleExportCsv = () => {
    const exportData = filteredPayments.map(p => {
      const sub = subscribers.find(s => s.id === p.subscriberId);
      return {
        'رقم السند': p.receiptNo || 'قيد الترقيم',
        'المشترك': sub ? sub.name : 'غير معروف',
        'المبلغ': p.amount,
        'العملة': settings.currency,
        'التاريخ': formatArabicDateTime(p.date),
        'المستلم': p.receivedBy,
        'ملاحظة': p.note || ''
      };
    });
    exportToCsv(exportData, `سندات_القبض_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const startEdit = (payment: Payment) => {
    setEditingId(payment.id);
    setEditAmount(payment.amount);
    setEditNote(payment.note || '');
    setEditBase(payment);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditBase(null);
  };

  const saveEdit = async (paymentId: string) => {
    if (!(editAmount > 0)) {
      toast.error('مبلغ الدفعة يجب أن يكون أكبر من صفر');
      return;
    }
    await updatePayment(paymentId, { amount: editAmount, note: editNote }, editBase ? { base: editBase } : undefined);
    setEditingId(null);
    setEditBase(null);
  };

  return (
    <div className="space-y-5 text-start">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>سجل الدفعات وسندات القبض</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              {filteredPayments.length.toLocaleString('en-US')} سند
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            كافة المبالغ المحصلة مع إمكانية التعديل والحذف وإعادة طباعة السندات
          </p>
        </div>

        <Button
          variant="glass"
          size="sm"
          onClick={handleExportCsv}
          leftIcon={<FileSpreadsheet className="w-4 h-4 text-emerald-500" />}
        >
          تصدير CSV
        </Button>
      </div>

      {/* Financial KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="glass-card p-4 rounded-2xl space-y-1">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">إجمالي المقبوضات</span>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {formatCurrency(totalCollected, settings.currency)}
          </div>
          <span className="text-[11px] text-slate-400">مجموع سندات القبض الصادرة</span>
        </div>

        <div className="glass-card p-4 rounded-2xl space-y-1">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">عدد السندات</span>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {payments.length.toLocaleString('en-US')} سند
          </div>
          <span className="text-[11px] text-slate-400">سجل دفعات كامل وموثق</span>
        </div>

        <div className="glass-card p-4 rounded-2xl space-y-1">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">متوسط قيمة السند</span>
          <div className="text-2xl font-black text-brand-600 dark:text-brand-400">
            {payments.length > 0 ? formatCurrency(Math.round(totalCollected / payments.length), settings.currency) : '0'}
          </div>
          <span className="text-[11px] text-slate-400">معدل التحصيل لكل حركة</span>
        </div>
      </div>

      {/* Search Input */}
      <div className="glass-card p-4 rounded-2xl">
        <Input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="ابحث باسم المشترك، المستلم، أو الملاحظة..."
          startIcon={<Search className="w-4 h-4" />}
        />
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-x-auto">
        <table className="w-full text-start text-xs min-w-[700px]">
          <thead>
            <tr className="border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] text-slate-400">
              <th className="p-4 text-start font-bold">رقم السند</th>
              <th className="p-4 text-start font-bold">المشترك</th>
              <th className="p-4 text-start font-bold">المبلغ المستلم</th>
              <th className="p-4 text-start font-bold">تاريخ الدفعة</th>
              <th className="p-4 text-start font-bold">المستلم</th>
              <th className="p-4 text-start font-bold">ملاحظات</th>
              <th className="p-4 text-end font-bold">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {filteredPayments.length > 0 ? (
              filteredPayments.slice(0, visibleCount).map(payment => {
                const sub = subscribers.find(s => s.id === payment.subscriberId);
                const subCycle = subscriptions.find(s => s.id === payment.subscriptionId);
                const isEditing = editingId === payment.id;

                return (
                  <tr
                    key={payment.id}
                    className={`transition-colors ${isEditing ? 'bg-brand-500/5 dark:bg-brand-500/10' : 'hover:bg-slate-50/80 dark:hover:bg-white/[0.02]'}`}
                  >
                    {/* Receipt No */}
                    <td className="p-4 font-mono font-bold text-slate-500">
                      {payment.receiptNo ? (
                        <>#{payment.receiptNo}</>
                      ) : (
                        <span className="text-[10px] font-sans font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                          قيد الترقيم
                        </span>
                      )}
                    </td>

                    {/* Subscriber */}
                    <td className="p-4">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {sub ? sub.name : 'مشترك غير معروف'}
                      </div>
                      {sub?.phone && <div className="text-[11px] text-slate-400 dir-ltr text-start">{sub.phone}</div>}
                    </td>

                    {/* Amount — editable */}
                    <td className="p-4">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editAmount}
                          onChange={e => setEditAmount(Number(e.target.value))}
                          className="w-28 rounded-lg border border-brand-500/50 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/30 font-bold"
                          min={1}
                          autoFocus
                        />
                      ) : (
                        <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                          +{formatCurrency(payment.amount, settings.currency)}
                        </span>
                      )}
                    </td>

                    {/* Date */}
                    <td className="p-4 text-slate-600 dark:text-slate-300">
                      {formatArabicDateTime(payment.date)}
                    </td>

                    {/* Received By */}
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{payment.receivedBy}</span>
                      </div>
                    </td>

                    {/* Note — editable */}
                    <td className="p-4 text-slate-500">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editNote}
                          onChange={e => setEditNote(e.target.value)}
                          className="w-36 rounded-lg border border-brand-500/50 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                          placeholder="ملاحظة..."
                        />
                      ) : (
                        payment.note || '-'
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-1.5">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => saveEdit(payment.id)}
                              className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors border border-emerald-500/20"
                              title="حفظ التعديل"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                              title="إلغاء"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            {/* View Receipt */}
                            <Button
                              size="sm"
                              variant="glass"
                              onClick={() => subCycle && onViewReceipt(payment, subCycle)}
                              leftIcon={<FileText className="w-3.5 h-3.5" />}
                            >
                              سند
                            </Button>

                            {/* Edit */}
                            {canManagePayments && (
                              <button
                                onClick={() => startEdit(payment)}
                                className="p-1.5 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 hover:bg-brand-500/20 transition-colors border border-brand-500/20"
                                title="تعديل الدفعة"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Delete */}
                            {canManagePayments && (
                              <button
                                onClick={() => setConfirmDelete(payment)}
                                className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-colors border border-rose-500/20"
                                title="حذف الدفعة"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                  لا توجد دفعات مطابقة
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {filteredPayments.length > visibleCount && (
          <button
            type="button"
            onClick={() => setVisibleCount(c => c + 60)}
            className="w-full mt-3 py-3 rounded-2xl glass text-xs font-bold text-brand-500 hover:bg-brand-500/10 transition-colors"
          >
            عرض المزيد ({(filteredPayments.length - visibleCount).toLocaleString('en-US')} متبقية)
          </button>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        variant="danger"
        title="حذف الدفعة نهائياً"
        message={`هل أنت متأكد من حذف الدفعة بقيمة ${confirmDelete ? formatCurrency(confirmDelete.amount, settings.currency) : ''} ؟\n\nسيتم تحديث رصيد الاشتراك تلقائياً بعد الحذف. لا يمكن التراجع عن هذا الإجراء.`}
        confirmText="نعم، احذف الدفعة"
        onConfirm={async () => {
          if (confirmDelete) {
            await deletePayment(confirmDelete.id);
            setConfirmDelete(null);
          }
        }}
      />
    </div>
  );
};
