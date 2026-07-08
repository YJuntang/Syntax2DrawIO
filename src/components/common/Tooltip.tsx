import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  delay?: number;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export function Tooltip({ content, children, delay = 400, position = 'top', className }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const positions = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrows = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-zinc-800 light:border-t-zinc-800 border-l-transparent border-r-transparent border-b-transparent border-4',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-zinc-800 light:border-b-zinc-800 border-l-transparent border-r-transparent border-t-transparent border-4',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-zinc-800 light:border-l-zinc-800 border-t-transparent border-b-transparent border-r-transparent border-4',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-zinc-800 light:border-r-zinc-800 border-t-transparent border-b-transparent border-l-transparent border-4',
  };

  return (
    <div 
      className="relative inline-flex"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      
      {isVisible && (
        <div 
          className={cn(
            'absolute z-50 animate-fade-in pointer-events-none',
            positions[position],
            className
          )}
          role="tooltip"
        >
          <div className="relative px-2.5 py-1.5 text-xs font-medium text-white bg-zinc-800 rounded-md shadow-sm whitespace-nowrap">
            {content}
            <div className={cn('absolute w-0 h-0', arrows[position])} />
          </div>
        </div>
      )}
    </div>
  );
}
