import React, { useCallback, useEffect, useState } from 'react';
import { cn } from '../../lib/utils';
import { CheckCircle2, XCircle, AlertCircle, Info, X } from 'lucide-react';
import { Button } from './Button';
import { create } from 'zustand';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastStore {
  toasts: ToastProps[];
  addToast: (toast: Omit<ToastProps, 'id'>) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) => 
    set((state) => ({ 
      toasts: [...state.toasts, { ...toast, id: Math.random().toString(36).substr(2, 9) }] 
    })),
  removeToast: (id) => 
    set((state) => ({ 
      toasts: state.toasts.filter((t) => t.id !== id) 
    })),
}));

export function toast(props: Omit<ToastProps, 'id'>) {
  useToastStore.getState().addToast(props);
}

export function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts);

  return (
    <div className="fixed bottom-0 right-0 z-50 flex max-w-sm flex-col gap-2 p-4 sm:bottom-0 sm:right-0 sm:top-auto">
      {toasts.map((t) => (
        <ToastItem key={t.id} {...t} />
      ))}
    </div>
  );
}

function ToastItem({ id, title, description, variant = 'info', duration = 5000 }: ToastProps) {
  const removeToast = useToastStore((state) => state.removeToast);
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => removeToast(id), 300); // Wait for exit animation
  }, [id, removeToast]);

  useEffect(() => {
    if (duration === Infinity) return;
    const timer = setTimeout(() => {
      handleClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, handleClose]);

  const icons = {
    success: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
    error: <XCircle className="h-5 w-5 text-red-500" />,
    warning: <AlertCircle className="h-5 w-5 text-amber-500" />,
    info: <Info className="h-5 w-5 text-blue-500" />,
  };

  return (
    <div 
      className={cn(
        'pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl p-4 shadow-lg ring-1 transition-all duration-300',
        'glass light:bg-white light:ring-black/5',
        isClosing ? 'translate-x-full opacity-0' : 'animate-slide-up'
      )}
      role="alert"
    >
      <div className="shrink-0">{icons[variant]}</div>
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium text-zinc-100 light:text-zinc-900">{title}</p>
        {description && (
          <p className="text-sm text-zinc-400 light:text-zinc-500">{description}</p>
        )}
      </div>
      <Button aria-label={`Dismiss ${title} notification`} variant="icon" size="icon" className="-mx-2 -my-2 shrink-0 opacity-50 hover:opacity-100" onClick={handleClose}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
