import React from 'react';
import { cn } from '../../lib/utils';
import type { SubscriptionStatus, PayStatus, PlanType, Role } from '../../types';
import { Home, User, ShieldCheck, UserCheck, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
  status?: SubscriptionStatus;
  payStatus?: PayStatus;
  planType?: PlanType;
  role?: Role;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  className,
  variant = 'default',
  status,
  payStatus,
  planType,
  role,
  size = 'md',
  ...props
}) => {
  // If specific semantic prop is passed, auto-compute styles & icons:
  if (status) {
    if (status === 'active') {
      return (
        <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20', className)}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>فعّال</span>
        </span>
      );
    }
    if (status === 'expiring_soon') {
      return (
        <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20', className)}>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
          <span>ينتهي قريباً</span>
        </span>
      );
    }
    return (
      <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20', className)}>
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
        <span>منتهي الصلاحية</span>
      </span>
    );
  }

  if (payStatus) {
    if (payStatus === 'paid') {
      return (
        <span className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20', className)}>
          <CheckCircle2 className="w-3 h-3" />
          <span>مدفوع بالكامل</span>
        </span>
      );
    }
    if (payStatus === 'partial') {
      return (
        <span className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20', className)}>
          <Clock className="w-3 h-3" />
          <span>دفعة جزئية</span>
        </span>
      );
    }
    return (
      <span className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20', className)}>
        <AlertTriangle className="w-3 h-3" />
        <span>غير مدفوع</span>
      </span>
    );
  }

  if (planType) {
    if (planType === 'home') {
      return (
        <span className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20', className)}>
          <Home className="w-3 h-3" />
          <span>منزلي</span>
        </span>
      );
    }
    return (
      <span className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/20', className)}>
        <User className="w-3 h-3" />
        <span>شخصي</span>
      </span>
    );
  }

  if (role) {
    if (role === 'admin' || (role as string) === 'owner') {
      return (
        <span className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30', className)}>
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>مسؤول (Admin)</span>
        </span>
      );
    }
    return (
      <span className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30', className)}>
        <UserCheck className="w-3.5 h-3.5" />
        <span>مشرف (Moderator)</span>
      </span>
    );
  }

  const variants = {
    default: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border-slate-200/50 dark:border-white/10',
    success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    danger: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    info: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
  };

  const sizes = {
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1'
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium border',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};
