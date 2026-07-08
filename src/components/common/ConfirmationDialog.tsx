import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ConfirmationRequest, ConfirmationResponse, setConfirmationHandler } from '../../lib/confirmation';
import { Button } from './Button';
import { Modal } from './Modal';

type ActiveConfirmation = ConfirmationRequest & {
  resolve: (response: ConfirmationResponse) => void;
};

export function ConfirmationDialogHost() {
  const [activeConfirmation, setActiveConfirmation] = useState<ActiveConfirmation | null>(null);
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const activeRef = useRef<ActiveConfirmation | null>(null);
  const dontAskAgainRef = useRef(false);

  const updateDontAskAgain = useCallback((checked: boolean) => {
    dontAskAgainRef.current = checked;
    setDontAskAgain(checked);
  }, []);

  const settle = useCallback((confirmed: boolean) => {
    const active = activeRef.current;
    if (!active) {
      return;
    }

    activeRef.current = null;
    setActiveConfirmation(null);
    active.resolve({
      confirmed,
      dontAskAgain: confirmed ? dontAskAgainRef.current : false,
    });
  }, []);

  useEffect(() => {
    const dispose = setConfirmationHandler((request) => new Promise((resolve) => {
      activeRef.current?.resolve({ confirmed: false, dontAskAgain: false });
      updateDontAskAgain(false);

      const next = { ...request, resolve };
      activeRef.current = next;
      setActiveConfirmation(next);
    }));

    return () => {
      dispose();
      activeRef.current?.resolve({ confirmed: false, dontAskAgain: false });
      activeRef.current = null;
    };
  }, [updateDontAskAgain]);

  if (!activeConfirmation) {
    return null;
  }

  const isDanger = activeConfirmation.tone === 'danger';

  return (
    <Modal
      isOpen
      onClose={() => settle(false)}
      title={activeConfirmation.title}
      showCloseButton={false}
      className="max-w-[420px] rounded-[30px] border-white/12 bg-zinc-950/82 shadow-[0_28px_90px_rgba(0,0,0,0.5)] light:border-white/80 light:bg-white/86 light:shadow-[0_28px_90px_rgba(15,23,42,0.18)]"
      headerClassName="justify-center border-b-0 px-7 pb-0 pt-7"
      titleClassName="text-center text-[1.08rem]"
      bodyClassName="px-7 pb-6 pt-5"
      footerClassName="justify-center px-7"
      footer={(
        <>
          <Button
            variant="ghost"
            size="lg"
            onClick={() => settle(false)}
            className="min-w-[120px] rounded-full bg-white/5 text-zinc-200 hover:bg-white/10 hover:text-white focus-visible:ring-white/20 light:bg-zinc-100/90 light:text-zinc-700 light:hover:bg-zinc-200/80 light:hover:text-zinc-950 light:focus-visible:ring-zinc-300"
          >
            {activeConfirmation.cancelLabel}
          </Button>
          <Button
            size="lg"
            onClick={() => settle(true)}
            className={cn(
              'min-w-[140px] rounded-full shadow-none',
              isDanger
                ? 'bg-red-500 text-white hover:bg-red-400 focus-visible:ring-red-400'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            )}
          >
            {activeConfirmation.confirmLabel}
          </Button>
        </>
      )}
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <div
          className={cn(
            'grid h-12 w-12 place-items-center rounded-2xl border shadow-inner',
            isDanger
              ? 'border-red-400/20 bg-red-500/12 text-red-300 light:border-red-200 light:bg-red-50 light:text-red-500'
              : 'border-amber-300/20 bg-amber-400/12 text-amber-300 light:border-amber-200 light:bg-amber-50 light:text-amber-600'
          )}
          aria-hidden="true"
        >
          <AlertTriangle className="h-6 w-6" strokeWidth={1.8} />
        </div>
        <p className="max-w-[21rem] text-[0.95rem] leading-6 text-zinc-300 light:text-zinc-600">
          {activeConfirmation.message}
        </p>
        {activeConfirmation.dontAskAgainLabel ? (
          <button
            type="button"
            role="checkbox"
            aria-checked={dontAskAgain}
            onClick={() => updateDontAskAgain(!dontAskAgainRef.current)}
            className="mt-1 inline-flex items-center gap-2 rounded-full px-1 py-0.5 text-xs text-zinc-500 transition-colors hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 light:text-zinc-500 light:hover:text-zinc-700 light:focus-visible:ring-zinc-300"
          >
            <span
              className={cn(
                'grid h-3.5 w-3.5 place-items-center rounded-[4px] border transition-colors',
                dontAskAgain
                  ? 'border-red-500 bg-red-500 text-white'
                  : 'border-white/20 bg-white/5 text-transparent light:border-zinc-300 light:bg-white'
              )}
              aria-hidden="true"
            >
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
            <span>{activeConfirmation.dontAskAgainLabel}</span>
          </button>
        ) : null}
      </div>
    </Modal>
  );
}
