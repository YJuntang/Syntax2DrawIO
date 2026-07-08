import React from 'react';
import { cn } from '../../lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'mermaid' | 'plantuml' | 'default';
}

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  const variants = {
    mermaid: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 light:bg-emerald-50 light:text-emerald-700 light:border-emerald-200',
    plantuml: 'bg-purple-500/10 text-purple-500 border-purple-500/20 light:bg-purple-50 light:text-purple-700 light:border-purple-200',
    default: 'bg-zinc-800 text-zinc-300 border-zinc-700 light:bg-zinc-100 light:text-zinc-700 light:border-zinc-200',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
