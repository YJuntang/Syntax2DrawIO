import React, { useEffect, useState } from 'react';
import { Monitor, X } from 'lucide-react';

export function MobileGate({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('s2d-mobile-notice-dismissed') === '1');

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <>
      {children}
      {isMobile && !dismissed ? (
        <div className="fixed inset-x-3 bottom-3 z-30 flex items-start gap-3 rounded-md border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 shadow-2xl light:border-zinc-200 light:bg-white light:text-zinc-800">
          <Monitor className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
          <p className="min-w-0 flex-1">
            A larger screen is still best, but editor and preview tabs are available on this device.
          </p>
          <button type="button" onClick={() => {
            localStorage.setItem('s2d-mobile-notice-dismissed', '1');
            setDismissed(true);
          }} aria-label="Dismiss small-screen notice">
            <X className="h-4 w-4 text-zinc-500" />
          </button>
        </div>
      ) : null}
    </>
  );
}
