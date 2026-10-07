import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useAppStore } from './lib/store';
import { Layout } from './app/Layout';
// Heavy tab views load on demand (smaller initial bundle)
const DashboardView = lazy(() => import('./features/dashboard/DashboardView').then(m => ({ default: m.DashboardView })));
const SubscribersView = lazy(() => import('./features/subscribers/SubscribersView').then(m => ({ default: m.SubscribersView })));
const PaymentsView = lazy(() => import('./features/payments/PaymentsView').then(m => ({ default: m.PaymentsView })));
const AuditView = lazy(() => import('./features/audit/AuditView').then(m => ({ default: m.AuditView })));
const SettingsView = lazy(() => import('./features/settings/SettingsView').then(m => ({ default: m.SettingsView })));
const UsersManagementView = lazy(() => import('./features/users/UsersManagementView').then(m => ({ default: m.UsersManagementView })));
const RemindersView = lazy(() => import('./features/reminders/RemindersView').then(m => ({ default: m.RemindersView })));
import { LoginView } from './features/auth/LoginView';

import { SubscriberDrawer } from './features/subscribers/SubscriberDrawer';
import { SubscriberFormModal } from './features/subscribers/SubscriberFormModal';
import { RenewModal } from './features/subscriptions/RenewModal';
import { ChangePlanModal } from './features/subscriptions/ChangePlanModal';
import { AddPaymentModal } from './features/payments/AddPaymentModal';
import { ReceiptModal } from './components/ReceiptModal';
import { CommandMenu } from './components/CommandMenu';
import { ConfirmModal } from './components/ui/ConfirmModal';
import { Toaster } from 'sonner';
import { useIdleLogout } from './hooks/useIdleLogout';
import { useExpiryNotifications } from './hooks/useExpiryNotifications';
import { PwaUpdateBanner } from './components/PwaUpdateBanner';
import { PwaInstallToast } from './components/PwaInstallToast';

import type { SubscriberWithDetails, Subscription, Payment } from './types';

export function App() {
  const { 
    currentAdmin, 
    logoutFromFirebase, 
    authLoading, 
    subscribersWithDetails, 
    settings,
    hasPermission,
    pendingConflict,
    resolveConflict
  } = useAppStore();

  const [currentTab, setCurrentTab] = useState('dashboard');

  // Modals & Drawers state
  const [selectedSubscriberId, setSelectedSubscriberId] = useState<string | null>(null);
  const [subscriberDrawerOpen, setSubscriberDrawerOpen] = useState(false);

  const [subscriberFormOpen, setSubscriberFormOpen] = useState(false);
  const [subscriberToEdit, setSubscriberToEdit] = useState<SubscriberWithDetails | null>(null);

  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [subscriberToRenew, setSubscriberToRenew] = useState<SubscriberWithDetails | null>(null);

  const [changePlanModalOpen, setChangePlanModalOpen] = useState(false);
  const [subscriberToChangePlan, setSubscriberToChangePlan] = useState<SubscriberWithDetails | null>(null);

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [subscriptionToPay, setSubscriptionToPay] = useState<Subscription | null>(null);

  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState<Payment | null>(null);
  const [receiptSubscription, setReceiptSubscription] = useState<Subscription | null>(null);
  const [receiptSubscriber, setReceiptSubscriber] = useState<SubscriberWithDetails | null>(null);

  const [commandMenuOpen, setCommandMenuOpen] = useState(false);

  // Auto logout after inactivity (configurable from Settings; 0 = disabled)
  useIdleLogout(
    Boolean(currentAdmin),
    settings.sessionTimeoutMinutes || 0,
    logoutFromFirebase
  );

  // Per-device expiry digest (local notifications, set up in Settings)
  const expiringSoonCount = subscribersWithDetails.filter(s => !s.archived && s.computedStatus === 'expiring_soon').length;
  const expiredCount = subscribersWithDetails.filter(s => !s.archived && s.computedStatus === 'expired').length;
  useExpiryNotifications(Boolean(currentAdmin), expiringSoonCount, expiredCount);

  // Selected subscriber for drawer
  const selectedSubscriber = selectedSubscriberId
    ? subscribersWithDetails.find(s => s.id === selectedSubscriberId) || null
    : null;

  // Keyboard shortcuts (/ and N)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing inside an input or textarea
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        return;
      }

      if (e.key === '/') {
        e.preventDefault();
        setCommandMenuOpen(true);
      } else if (e.key.toLowerCase() === 'n') {
        if (hasPermission('subscribers_create')) {
          e.preventDefault();
          setSubscriberToEdit(null);
          setSubscriberFormOpen(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasPermission]);

  const handleSelectSubscriber = (id: string) => {
    setSelectedSubscriberId(id);
    setSubscriberDrawerOpen(true);
  };

  const handleOpenAddSubscriber = () => {
    if (!hasPermission('subscribers_create')) {
      return;
    }
    setSubscriberToEdit(null);
    setSubscriberFormOpen(true);
  };

  const handleOpenEditSubscriber = (sub: SubscriberWithDetails) => {
    if (!hasPermission('subscribers_edit')) {
      return;
    }
    setSubscriberToEdit(sub);
    setSubscriberFormOpen(true);
  };

  const handleOpenRenewModal = (sub: SubscriberWithDetails) => {
    if (!hasPermission('subscriptions_renew')) {
      return;
    }
    setSubscriberToRenew(sub);
    setRenewModalOpen(true);
  };

  const handleOpenChangePlanModal = (sub: SubscriberWithDetails) => {
    if (!hasPermission('subscriptions_renew')) {
      return;
    }
    setSubscriberToChangePlan(sub);
    setChangePlanModalOpen(true);
  };

  const handleOpenPaymentModal = (subscription: Subscription) => {
    if (!hasPermission('payments_create')) {
      return;
    }
    setSubscriptionToPay(subscription);
    setPaymentModalOpen(true);
  };

  const handleViewReceipt = (payment: Payment, subscription: Subscription) => {
    const sub = subscribersWithDetails.find(s => s.id === payment.subscriberId) || null;
    setReceiptPayment(payment);
    setReceiptSubscription(subscription);
    setReceiptSubscriber(sub);
    setReceiptModalOpen(true);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50 dark:bg-[#07090e]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">جاري التحقق من هوية المستخدم...</p>
        </div>
      </div>
    );
  }

  if (!currentAdmin) {
    return (
      <>
        <Toaster position="top-center" richColors />
        <PwaUpdateBanner />
        <PwaInstallToast />
        <LoginView onSuccess={() => setCurrentTab('dashboard')} />
      </>
    );
  }

  return (
    <>
      <Toaster position="top-center" richColors />
      <PwaUpdateBanner />
      <PwaInstallToast />

      <Layout
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        onOpenCommandMenu={() => setCommandMenuOpen(true)}
        onOpenAddSubscriber={handleOpenAddSubscriber}
        onLogout={logoutFromFirebase}
      >
        <Suspense
          fallback={
            <div className="py-16 flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-500 font-medium">جاري تحميل الشاشة...</p>
            </div>
          }
        >
        {currentTab === 'dashboard' && (
          <DashboardView
            onSelectSubscriber={handleSelectSubscriber}
            onOpenAddSubscriber={handleOpenAddSubscriber}
            onOpenPaymentModal={handleOpenPaymentModal}
            onOpenRenewModal={handleOpenRenewModal}
            onNavigate={setCurrentTab}
          />
        )}

        {currentTab === 'subscribers' && hasPermission('subscribers_view') && (
          <SubscribersView
            onSelectSubscriber={handleSelectSubscriber}
            onOpenAddSubscriber={handleOpenAddSubscriber}
            onOpenPaymentModal={handleOpenPaymentModal}
            onOpenRenewModal={handleOpenRenewModal}
          />
        )}

        {currentTab === 'payments' && hasPermission('payments_view') && (
          <PaymentsView onViewReceipt={handleViewReceipt} />
        )}

        {currentTab === 'reminders' && hasPermission('subscribers_view') && (
          <RemindersView />
        )}

        {currentTab === 'users' && currentAdmin.role === 'admin' && (
          <UsersManagementView />
        )}

        {currentTab === 'audit' && hasPermission('audit_view') && <AuditView />}

        {currentTab === 'settings' && (currentAdmin.role === 'admin' || hasPermission('settings_view')) && (
          <SettingsView onNavigateToUsers={() => setCurrentTab('users')} />
        )}
        </Suspense>
      </Layout>

      {/* Subscriber Detail Drawer */}
      <SubscriberDrawer
        subscriber={selectedSubscriber}
        isOpen={subscriberDrawerOpen}
        onClose={() => setSubscriberDrawerOpen(false)}
        onOpenPaymentModal={handleOpenPaymentModal}
        onOpenRenewModal={handleOpenRenewModal}
        onOpenChangePlanModal={handleOpenChangePlanModal}
        onOpenEditModal={handleOpenEditSubscriber}
        onViewReceipt={handleViewReceipt}
      />

      {/* Create / Edit Subscriber Modal */}
      <SubscriberFormModal
        isOpen={subscriberFormOpen}
        onClose={() => setSubscriberFormOpen(false)}
        subscriberToEdit={subscriberToEdit}
        onViewExisting={handleSelectSubscriber}
      />

      {/* Renew Subscription Modal */}
      <RenewModal
        isOpen={renewModalOpen}
        onClose={() => setRenewModalOpen(false)}
        subscriber={subscriberToRenew}
      />

      {/* Change Plan Modal */}
      <ChangePlanModal
        isOpen={changePlanModalOpen}
        onClose={() => setChangePlanModalOpen(false)}
        subscriber={subscriberToChangePlan}
      />

      {/* Add Payment Modal */}
      <AddPaymentModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        subscription={subscriptionToPay}
        onPaymentSuccess={handleViewReceipt}
      />

      {/* Printable Receipt Modal */}
      <ReceiptModal
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        payment={receiptPayment}
        subscription={receiptSubscription}
        subscriber={receiptSubscriber}
        settings={settings}
      />

      {/* Command Menu (/ Shortcut) */}
      <CommandMenu
        isOpen={commandMenuOpen}
        onClose={() => setCommandMenuOpen(false)}
        onSelectSubscriber={handleSelectSubscriber}
        onOpenAddSubscriber={handleOpenAddSubscriber}
        onNavigate={setCurrentTab}
      />

      {/* Concurrent-edit conflict decision */}
      {pendingConflict && (
        <ConfirmModal
          isOpen={true}
          onClose={() => resolveConflict(false)}
          variant="warning"
          title="تعديل متزامن على نفس السجل"
          message={`قام مستخدم آخر بتعديل (${pendingConflict.name}) أثناء تحريرك. حفظ تعديلاتك الآن سيتجاوز تغييره. ماذا تريد أن تفعل؟`}
          confirmText="حفظ فوق التغيير"
          cancelText="إلغاء ومراجعة"
          onConfirm={() => resolveConflict(true)}
        />
      )}
    </>
  );
}

export default App;
