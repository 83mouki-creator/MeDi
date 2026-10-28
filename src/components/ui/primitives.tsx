import * as React from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-xl border border-navy-100 bg-white shadow-[var(--shadow-card)]', className)} {...props}>
      {children}
    </div>
  );
}

export function Badge({
  className,
  tone = 'neutral',
  children,
}: {
  className?: string;
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'navy';
  children: React.ReactNode;
}) {
  const tones = {
    neutral: 'bg-navy-100 text-navy-800',
    accent: 'bg-accent-100 text-accent-800',
    success: 'bg-emerald-100 text-emerald-900',
    warning: 'bg-amber-100 text-amber-900',
    danger: 'bg-rose-100 text-rose-900',
    navy: 'bg-navy-900 text-white',
  } as const;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold', tones[tone], className)}>
      {children}
    </span>
  );
}

export function Alert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const tones = {
    info: 'border-navy-200 bg-navy-50 text-navy-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    danger: 'border-rose-200 bg-rose-50 text-rose-900',
  } as const;
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('rounded-lg border p-3 text-sm', tones[tone], className)}>
      {title ? <p className="mb-1 font-semibold">{title}</p> : null}
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-navy-200 bg-white px-6 py-14 text-center">
      {icon ? <div className="mb-4 text-navy-300">{icon}</div> : null}
      <h3 className="text-lg font-semibold text-navy-900">{title}</h3>
      {description ? <p className="mt-2 max-w-md text-sm text-navy-600">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-navy-100', className)} />;
}

export function SectionHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-navy-950 sm:text-2xl">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-navy-600">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0 text-sm font-semibold text-accent-600">{action}</div> : null}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn('border-navy-100', className)} />;
}
