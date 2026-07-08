import React, {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';

export interface DropdownItem {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

interface DropdownProps {
  trigger: React.ReactElement<any>;
  items: DropdownItem[];
  align?: 'left' | 'right';
  className?: string;
  menuClassName?: string;
}

export function Dropdown({ trigger, items, align = 'left', className, menuClassName }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(null);
  const menuId = useId();

  const getEnabledItemIndexes = useCallback(() => items.reduce<number[]>((list, item, index) => {
    if (!item.disabled) {
      list.push(index);
    }
    return list;
  }, []), [items]);

  const focusItemAt = useCallback((enabledIndex: number) => {
    const enabledItemIndexes = getEnabledItemIndexes();
    const targetIndex = enabledItemIndexes[enabledIndex];
    if (typeof targetIndex !== 'number') {
      return;
    }

    itemRefs.current[targetIndex]?.focus();
  }, [getEnabledItemIndexes]);

  const restoreTriggerFocus = useCallback(() => {
    triggerRef.current?.focus();
  }, []);

  const closeMenu = useCallback((options?: { restoreFocus?: boolean }) => {
    setIsOpen(false);
    setMenuPosition(null);

    if (options?.restoreFocus !== false) {
      restoreTriggerFocus();
    }
  }, [restoreTriggerFocus]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (containerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }

      closeMenu({ restoreFocus: false });
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [closeMenu, isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setMenuPosition(null);
      return;
    }

    function updateMenuPosition() {
      if (!containerRef.current || !menuRef.current) {
        return;
      }

      const triggerRect = containerRef.current.getBoundingClientRect();
      const menuRect = menuRef.current.getBoundingClientRect();
      const offset = 8;
      const viewportPadding = 8;

      const unclampedLeft = align === 'right'
        ? triggerRect.right - menuRect.width
        : triggerRect.left;
      const unclampedTop = triggerRect.bottom + offset;

      const maxLeft = Math.max(viewportPadding, window.innerWidth - menuRect.width - viewportPadding);
      const maxTop = Math.max(viewportPadding, window.innerHeight - menuRect.height - viewportPadding);

      setMenuPosition({
        left: clamp(unclampedLeft, viewportPadding, maxLeft),
        top: clamp(unclampedTop, viewportPadding, maxTop),
      });
    }

    updateMenuPosition();
    const enabledItemIndexes = getEnabledItemIndexes();
    window.requestAnimationFrame(() => {
      if (enabledItemIndexes.length > 0) {
        focusItemAt(0);
      } else {
        menuRef.current?.focus();
      }
    });
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [align, focusItemAt, getEnabledItemIndexes, isOpen]);

  const handleTriggerClick = (event: React.MouseEvent<HTMLElement>) => {
    if ((event.currentTarget as HTMLButtonElement).disabled) {
      return;
    }

    setIsOpen((open) => !open);
  };

  const handleTriggerKeyDown = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    if ((event.currentTarget as HTMLButtonElement).disabled) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsOpen(true);
      window.requestAnimationFrame(() => focusItemAt(0));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setIsOpen(true);
      const enabledItemIndexes = getEnabledItemIndexes();
      window.requestAnimationFrame(() => focusItemAt(Math.max(enabledItemIndexes.length - 1, 0)));
    }
  }, [focusItemAt, getEnabledItemIndexes]);

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const enabledItemIndexes = getEnabledItemIndexes();

    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
      return;
    }

    if (event.key === 'Tab') {
      closeMenu({ restoreFocus: false });
      return;
    }

    if (!enabledItemIndexes.length) {
      return;
    }

    const currentIndex = enabledItemIndexes.findIndex((itemIndex) => itemRefs.current[itemIndex] === document.activeElement);

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % enabledItemIndexes.length : 0;
      focusItemAt(nextIndex);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      const nextIndex = currentIndex >= 0
        ? (currentIndex - 1 + enabledItemIndexes.length) % enabledItemIndexes.length
        : enabledItemIndexes.length - 1;
      focusItemAt(nextIndex);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      focusItemAt(0);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      focusItemAt(enabledItemIndexes.length - 1);
    }
  };

  if (!isValidElement(trigger)) {
    throw new Error('Dropdown trigger must be a React element.');
  }

  const triggerProps = trigger.props as {
    onClick?: (event: React.MouseEvent<HTMLElement>) => void;
    onKeyDown?: (event: React.KeyboardEvent<HTMLElement>) => void;
  };

  const triggerElement = cloneElement<any>(trigger, {
    'aria-controls': isOpen ? menuId : undefined,
    'aria-expanded': isOpen,
    'aria-haspopup': 'menu',
    onClick: (event: React.MouseEvent<HTMLElement>) => {
      triggerProps.onClick?.(event);
      handleTriggerClick(event);
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
      triggerProps.onKeyDown?.(event);
      handleTriggerKeyDown(event);
    },
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node;
      const triggerRefProp = (trigger as React.ReactElement<any> & { ref?: React.Ref<HTMLElement> }).ref;
      if (typeof triggerRefProp === 'function') {
        triggerRefProp(node);
      } else if (triggerRefProp && typeof triggerRefProp === 'object') {
        (triggerRefProp as React.MutableRefObject<HTMLElement | null>).current = node;
      }
    },
  });

  return (
    <div className={cn('relative inline-block text-left', className)} ref={containerRef}>
      {triggerElement}

      {isOpen ? createPortal(
        <div
          id={menuId}
          ref={menuRef}
          className={cn(
            'fixed z-50 w-56 max-w-[calc(100vw-1rem)] origin-top-right rounded-md glass-panel shadow-lg ring-1 ring-black/5 focus:outline-none animate-scale-in',
            menuClassName
          )}
          style={{
            left: menuPosition?.left ?? 0,
            top: menuPosition?.top ?? 0,
            visibility: menuPosition ? 'visible' : 'hidden',
          }}
          onKeyDown={handleMenuKeyDown}
          role="menu"
          aria-orientation="vertical"
          tabIndex={-1}
        >
          <div className="py-1" role="none">
            {items.map((item, index) => (
              <button
                key={item.id}
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                onClick={() => {
                  item.onClick();
                  closeMenu();
                }}
                disabled={item.disabled}
                className={cn(
                  'group flex w-full items-center gap-2 px-4 py-2 text-sm text-left transition-colors whitespace-normal break-words',
                  item.disabled
                    ? 'text-zinc-500 cursor-not-allowed opacity-50'
                    : 'text-zinc-300 hover:bg-zinc-800 hover:text-white light:text-zinc-700 light:hover:bg-zinc-100 light:hover:text-zinc-900'
                )}
                role="menuitem"
                tabIndex={0}
              >
                {item.icon ? <span className="h-4 w-4 shrink-0">{item.icon}</span> : null}
                <span className="min-w-0 flex-1">{item.label}</span>
              </button>
            ))}
          </div>
        </div>,
        document.body
      ) : null}
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
