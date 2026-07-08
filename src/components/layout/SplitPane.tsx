import React, { useRef, useEffect, useState } from 'react';
import { useSettingsStore } from '../../store/settingsStore';

interface SplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
}

export function SplitPane({ left, right }: SplitPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const splitRatio = useSettingsStore((state) => state.splitRatio);
  const setSplitRatio = useSettingsStore((state) => state.setSplitRatio);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      const newRatio = ((e.clientX - containerRect.left) / containerRect.width) * 100;
      
      // Clamp between 20% and 80%
      if (newRatio > 20 && newRatio < 80) {
        setSplitRatio(newRatio);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };
  }, [isDragging, setSplitRatio]);

  return (
    <div className="flex h-full w-full overflow-hidden" ref={containerRef}>
      <div 
        className="h-full overflow-hidden transition-[width] duration-0 ease-linear"
        style={{ width: `${splitRatio}%` }}
      >
        {left}
      </div>
      
      <div 
        role="separator"
        aria-label="Resize editor and preview panes"
        aria-orientation="vertical"
        aria-valuemin={20}
        aria-valuemax={80}
        aria-valuenow={Math.round(splitRatio)}
        tabIndex={0}
        className={`relative z-10 flex w-1.5 cursor-col-resize items-center justify-center bg-zinc-900 hover:bg-blue-500/50 active:bg-blue-500 focus-visible:bg-blue-500 light:bg-zinc-200 light:hover:bg-blue-400/50 light:active:bg-blue-400 transition-colors ${isDragging ? 'bg-blue-500 light:bg-blue-400' : ''}`}
        onMouseDown={() => setIsDragging(true)}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
          event.preventDefault();
          const direction = event.key === 'ArrowLeft' ? -1 : 1;
          setSplitRatio(Math.min(80, Math.max(20, splitRatio + direction * (event.shiftKey ? 10 : 2))));
        }}
      >
        <div className="h-8 w-0.5 rounded-full bg-zinc-700 light:bg-zinc-400" />
      </div>
      
      <div 
        className="h-full overflow-hidden transition-[width] duration-0 ease-linear"
        style={{ width: `${100 - splitRatio}%` }}
      >
        {right}
      </div>
    </div>
  );
}
