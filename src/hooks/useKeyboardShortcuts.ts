import { useEffect } from 'react';

type KeyHandler = (e: KeyboardEvent) => void;

interface ShortcutConfig {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  handler: KeyHandler;
  preventDefault?: boolean;
}

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const matchShift = shortcut.shiftKey ? e.shiftKey : !e.shiftKey;
        const matchAlt = shortcut.altKey ? e.altKey : !e.altKey;
        
        // Treat ctrl and meta as interchangeable for mac/windows compatibility if not specifically requiring both
        const isCmdOrCtrl = (shortcut.ctrlKey || shortcut.metaKey) 
          ? (e.ctrlKey || e.metaKey) 
          : (!e.ctrlKey && !e.metaKey);

        const matchKey = e.key.toLowerCase() === shortcut.key.toLowerCase();

        if (matchKey && matchShift && matchAlt && isCmdOrCtrl) {
          if (shortcut.preventDefault !== false) {
            e.preventDefault();
          }
          shortcut.handler(e);
          return; // Stop after first match
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}
