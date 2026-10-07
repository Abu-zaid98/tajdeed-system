import React, { useRef, useState } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Printer, ImageDown, Share2, Wifi } from 'lucide-react';
import { formatArabicDate, formatArabicDateTime } from '../lib/dates';
import { formatCurrency } from '../lib/utils';
import { toast } from 'sonner';
import type { Payment, Subscriber, Subscription, Settings } from '../types';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment?: Payment | null;
  subscriber?: Subscriber | null;
  subscription?: Subscription | null;
  settings: Settings;
}

// Inline hex-only styles: predictable on paper AND parseable by html2canvas
// (Tailwind v4 color functions are not).
const S = {
  paper: {
    backgroundColor: '#ffffff',
    color: '#0f172a',
    borderRadius: 16,
    border: '1px solid #e2e8f0',
    padding: 24,
    direction: 'rtl' as const,
    fontFamily: "'IBM Plex Sans Arabic', Tahoma, Arial, sans-serif",
  },
  muted: { color: '#64748b' },
  brand: { color: '#0284c7' },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  box: {
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#f8fafc',
  },
  label: { color: '#64748b', fontSize: 11, display: 'block', marginBottom: 2 },
  value: { color: '#0f172a', fontSize: 13, fontWeight: 700 },
} satisfies Record<string, React.CSSProperties>;

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  payment,
  subscriber,
  subscription,
  settings
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  if (!payment || !subscriber) return null;

  const receiptNo = payment.receiptNo || null;
  const fileName = `سند-قبض-${receiptNo || payment.id}.png`;

  const captureImage = async (): Promise<Blob | null> => {
    if (!printRef.current) return null;
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(printRef.current, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
    });
    return new Promise(resolve => canvas.toBlob(b => resolve(b), 'image/png'));
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSaveImage = async () => {
    setIsCapturing(true);
    try {
      const blob = await captureImage();
      if (!blob) {
        toast.error('تعذّر إنشاء الصورة');
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.success('تم حفظ السند كصورة');
    } catch {
      toast.error('تعذّر إنشاء الصورة');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleShare = async () => {
    setIsCapturing(true);
    try {
      const blob = await captureImage();
      if (!blob) {
        toast.error('تعذّر إنشاء الصورة');
        return;
      }
      const file = new File([blob], fileName, { type: 'image/png' });
      if (typeof navigator !== 'undefined' && 'canShare' in navigator && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'سند قبض',
          text: `سند قبض ${receiptNo ? `#${receiptNo}` : ''} — ${settings.networkName}`,
        });
      } else {
        toast.error('المشاركة المباشرة غير مدعومة على هذا المتصفح — استخدم حفظ صورة');
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') toast.error('تعذّرت المشاركة');
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="سند قبض رسمي"
      description="إيصال استلام دفعة اشتراك الإنترنت"
      maxWidth="lg"
    >
      <div className="space-y-6">
        {/* Printable Area */}
        <div ref={printRef} className="receipt-printable" style={S.paper}>
          {/* Header */}
          <div style={{ ...S.row, borderBottom: '2px solid #0f172a', paddingBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, backgroundColor: '#0284c7',
                color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 900, fontSize: 20,
              }}>
                <Wifi size={24} />
              </div>
              <div>
                <div style={{ fontWeight: 900, fontSize: 17 }}>{settings.networkName}</div>
                <div style={{ ...S.muted, fontSize: 11 }}>خدمات الإنترنت والشبكات</div>
              </div>
            </div>
            <div style={{ textAlign: 'end' } as React.CSSProperties}>
              <div style={{ fontWeight: 900, fontSize: 15 }}>سند قبض رسمي</div>
              {receiptNo ? (
                <div style={{ ...S.brand, fontWeight: 800, fontSize: 13, fontFamily: 'monospace', direction: 'ltr' }}>
                  #{receiptNo}
                </div>
              ) : (
                <div style={{ color: '#b45309', fontWeight: 800, fontSize: 12 }}>قيد الترقيم</div>
              )}
              <div style={{ ...S.muted, fontSize: 11 }}>{formatArabicDateTime(payment.date)}</div>
            </div>
          </div>

          {/* Subscriber */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
            <div style={S.box}>
              <span style={S.label}>اسم المشترك</span>
              <span style={{ ...S.value, fontSize: 14 }}>{subscriber.name}</span>
            </div>
            <div style={S.box}>
              <span style={S.label}>رقم الهاتف</span>
              <span style={{ ...S.value, direction: 'ltr', display: 'block', textAlign: 'start' }}>
                {subscriber.phone || 'غير مسجل'}
              </span>
            </div>
            <div style={S.box}>
              <span style={S.label}>المنطقة / العنوان</span>
              <span style={S.value}>{subscriber.area || 'غير محدد'}</span>
            </div>
            <div style={S.box}>
              <span style={S.label}>نوع الاشتراك</span>
              <span style={S.value}>
                {subscriber.planType === 'home' ? 'منزلي (عائلي)' : 'شخصي (اقتصادي)'}
              </span>
            </div>
          </div>

          {/* Cycle */}
          {subscription && (
            <div style={{ ...S.box, marginTop: 10, backgroundColor: '#ffffff' }}>
              <div style={{ ...S.row, fontSize: 12 }}>
                <span style={S.muted}>فترة الدورة</span>
                <span style={S.value}>
                  من {formatArabicDate(subscription.startDate)} إلى {formatArabicDate(subscription.endDate)}
                </span>
              </div>
              <div style={{ ...S.row, fontSize: 12, marginTop: 6 }}>
                <span style={S.muted}>اسم المستخدم بالشبكة</span>
                <span style={{ ...S.brand, fontWeight: 800, fontFamily: 'monospace', direction: 'ltr' }}>
                  {subscription.username}
                </span>
              </div>
            </div>
          )}

          {/* Amount */}
          <div style={{
            marginTop: 10, borderRadius: 12, padding: 14,
            backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <span style={{ color: '#059669', fontSize: 12, fontWeight: 700, display: 'block' }}>
                المبلغ المقبوض
              </span>
              <span style={{ color: '#047857', fontSize: 26, fontWeight: 900 }}>
                {formatCurrency(payment.amount, settings.currency)}
              </span>
            </div>
            <div style={{
              width: 44, height: 44, borderRadius: '50%', backgroundColor: '#d1fae5',
              color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, fontSize: 22,
            }}>
              ✓
            </div>
          </div>

          {/* Receiver / note / signature */}
          <div style={{ ...S.row, marginTop: 12, fontSize: 12 }}>
            <div>
              <span style={S.muted}>المستلم: </span>
              <strong>{payment.receivedBy}</strong>
              {payment.note && <div style={{ ...S.muted, marginTop: 2 }}>ملاحظة: {payment.note}</div>}
            </div>
            <div style={{
              border: '1px dashed #94a3b8', borderRadius: 8, padding: '8px 16px',
              fontSize: 11, color: '#64748b', textAlign: 'center',
            }}>
              ختم وتوقيع الشبكة
            </div>
          </div>

          {/* Footer */}
          <div style={{
            marginTop: 12, paddingTop: 10, borderTop: '1px solid #e2e8f0',
            textAlign: 'center', fontSize: 11, color: '#64748b',
          }}>
            شكراً لثقتكم بنا — صادر عن منظومة {settings.networkName}
          </div>
        </div>

        {/* Action Buttons (Hidden when printing) */}
        <div className="flex items-center justify-end gap-2 flex-wrap no-print">
          <Button variant="secondary" onClick={onClose}>
            إغلاق
          </Button>
          <Button variant="glass" onClick={handlePrint} leftIcon={<Printer className="w-4 h-4" />}>
            طباعة / PDF
          </Button>
          <Button variant="glass" onClick={handleSaveImage} isLoading={isCapturing} leftIcon={<ImageDown className="w-4 h-4" />}>
            حفظ صورة
          </Button>
          <Button variant="primary" onClick={handleShare} isLoading={isCapturing} leftIcon={<Share2 className="w-4 h-4" />}>
            مشاركة
          </Button>
        </div>
      </div>
    </Modal>
  );
};
