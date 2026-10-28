import * as React from 'react';
import { cn } from '@/lib/utils';

export const inputClass =
  'w-full rounded-lg border border-navy-200 bg-white px-3 py-2.5 text-sm text-navy-950 placeholder:text-navy-400 shadow-[inset_0_1px_2px_rgba(8,23,41,0.04)] transition-colors focus:border-accent-400 disabled:cursor-not-allowed disabled:bg-navy-50';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(inputClass, 'h-11', className)} {...props} />;
  },
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(inputClass, 'min-h-24', className)} {...props} />;
  },
);

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn(inputClass, 'h-11 appearance-none bg-white pr-8', className)} {...props}>
        {children}
      </select>
    );
  },
);

export function Label({ className, children, htmlFor, required }: { className?: string; children: React.ReactNode; htmlFor?: string; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className={cn('mb-1.5 block text-sm font-medium text-navy-800', className)}>
      {children}
      {required ? <span className="ml-0.5 text-danger-500">*</span> : null}
    </label>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} required={required}>
        {label}
      </Label>
      {children}
      {hint && !error ? <p className="mt-1 text-xs text-navy-500">{hint}</p> : null}
      {error ? (
        <p className="mt-1 text-xs font-medium text-danger-500" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Checkbox({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn('size-5 rounded border-navy-300 text-accent-500 accent-accent-500', className)}
      {...props}
    />
  );
}
