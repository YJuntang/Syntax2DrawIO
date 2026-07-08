import React, { useEffect, useId, useRef } from 'react';
import { cn } from '../../lib/utils';
import { X } from 'lucide-react';
import { Button } from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  headerClassName?: string;
  titleClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  showCloseButton?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  className,
  headerClassName,
  titleClassName,
  bodyClassName,
  footerClassName,
  showCloseButton = true,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusedRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    previousFocusedRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key !== 'Tab') {
        return;
      }

      const dialog = dialogRef.current;
      if (!dialog) {
        return;
      }

      const focusableElements = getFocusableElements(dialog);
      if (!focusableElements.length) {
        e.preventDefault();
        dialog.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    const dialog = dialogRef.current;
    if (dialog) {
      const focusableElements = getFocusableElements(dialog);
      (focusableElements[0] || dialog).focus();
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusedRef.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/45 backdrop-blur-md animate-fade-in transition-opacity light:bg-zinc-950/20"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Modal dialog */}
      <div 
        className={cn(
          'relative z-50 flex w-full max-w-lg max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-[26px] border border-white/10 bg-zinc-900/88 shadow-[0_24px_80px_rgba(0,0,0,0.45)] ring-1 ring-black/10 backdrop-blur-2xl animate-scale-in light:border-white/70 light:bg-white/88 light:shadow-[0_24px_80px_rgba(15,23,42,0.16)] light:ring-zinc-200/70',
          className
        )}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        {/* Header */}
        <div className={cn('flex items-center justify-between border-b border-white/8 px-6 py-4 light:border-zinc-200/70', headerClassName)}>
          <h2 id={titleId} className={cn('text-[1.15rem] font-semibold tracking-[-0.02em] text-zinc-100 light:text-zinc-900', titleClassName)}>
            {title}
          </h2>
          {showCloseButton ? (
            <Button
              variant="icon"
              size="icon"
              onClick={onClose}
              aria-label="Close modal"
              className="rounded-full bg-white/5 hover:bg-white/10 light:bg-zinc-100/80 light:hover:bg-zinc-200/80"
            >
              <X className="h-5 w-5" />
            </Button>
          ) : null}
        </div>
        
        {/* Body */}
        <div className={cn('min-h-0 flex-1 overflow-y-auto px-6 py-5 text-zinc-300 light:text-zinc-600', bodyClassName)}>
          {children}
        </div>
        
        {/* Footer */}
        {footer && (
          <div className={cn('shrink-0 flex items-center justify-end gap-3 border-t border-white/8 bg-zinc-950/30 px-6 py-4 light:border-zinc-200/70 light:bg-zinc-50/70', footerClassName)}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => !element.hasAttribute('aria-hidden'));
}
