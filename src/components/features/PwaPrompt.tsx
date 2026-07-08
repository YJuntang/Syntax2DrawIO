import React, { useEffect, useState } from 'react';
import { Download, RefreshCcw, X } from 'lucide-react';
import { Button } from '../common/Button';
import { isDesktopApp } from '../../lib/platform';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
};

export function PwaPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [needRefresh, setNeedRefresh] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (isDesktopApp() || !('serviceWorker' in navigator)) {
      return;
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    let disposed = false;
    let registration: ServiceWorkerRegistration | null = null;

    const inspectRegistration = (nextRegistration: ServiceWorkerRegistration) => {
      registration = nextRegistration;
      if (nextRegistration.waiting) {
        setWaitingWorker(nextRegistration.waiting);
        setNeedRefresh(true);
      } else if (navigator.serviceWorker.controller) {
        setOfflineReady(true);
      }

      nextRegistration.addEventListener('updatefound', handleUpdateFound);
    };

    const handleUpdateFound = () => {
      const installing = registration?.installing;
      if (!installing) {
        return;
      }

      installing.addEventListener('statechange', () => {
        if (installing.state !== 'installed' || disposed) {
          return;
        }

        if (navigator.serviceWorker.controller) {
          setWaitingWorker(registration?.waiting || installing);
          setNeedRefresh(true);
        } else {
          setOfflineReady(true);
        }
      });
    };

    void navigator.serviceWorker.ready
      .then((readyRegistration) => {
        if (!disposed) {
          inspectRegistration(readyRegistration);
        }
      })
      .catch(() => {
        // The app remains fully usable when service workers are unavailable.
      });

    return () => {
      disposed = true;
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      registration?.removeEventListener('updatefound', handleUpdateFound);
    };
  }, []);

  if (dismissed || (!installEvent && !offlineReady && !needRefresh)) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-40 flex max-w-sm items-center gap-3 rounded-md border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 shadow-2xl light:border-zinc-200 light:bg-white light:text-zinc-800">
      {installEvent ? <Download className="h-4 w-4 text-blue-400" /> : <RefreshCcw className="h-4 w-4 text-blue-400" />}
      <div className="min-w-0 flex-1">
        <p className="font-medium">{installEvent ? 'Install Syntax2DrawIO' : needRefresh ? 'Update available' : 'Offline app ready'}</p>
        <p className="text-xs text-zinc-500">
          {installEvent ? 'Use it as a desktop-style web app.' : needRefresh ? 'Reload to use the newest version.' : 'Core app files are available offline.'}
        </p>
      </div>
      {installEvent ? (
        <Button
          size="sm"
          onClick={() => {
            void installEvent.prompt();
            setInstallEvent(null);
          }}
        >
          Install
        </Button>
      ) : null}
      {needRefresh ? (
        <Button
          size="sm"
          onClick={() => {
            if (!waitingWorker) {
              window.location.reload();
              return;
            }

            const handleControllerChange = () => window.location.reload();
            navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange, { once: true });
            waitingWorker.postMessage({ type: 'SKIP_WAITING' });
          }}
        >
          Reload
        </Button>
      ) : null}
      <button type="button" onClick={() => {
        setDismissed(true);
        setOfflineReady(false);
        setNeedRefresh(false);
      }} aria-label="Dismiss PWA prompt" className="text-zinc-500 hover:text-zinc-300">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
