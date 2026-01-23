import * as React from 'react';
import { ScrollArea } from '../atoms/ScrollArea';
import { Separator } from '../atoms/Separator';
import { cn } from '../../lib/utils';

export interface SidebarSectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  badge?: React.ReactNode;
}

function SidebarSection({ title, children, className, badge }: SidebarSectionProps) {
  return (
    <div className={cn('py-2', className)}>
      <div className="flex items-center justify-between px-3 mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        {badge}
      </div>
      <div className="px-2">{children}</div>
    </div>
  );
}

export interface SidebarLayoutProps {
  children: React.ReactNode;
}

function SidebarLayout({ children }: SidebarLayoutProps) {
  // Automatically add separators between children
  const childArray = React.Children.toArray(children);
  const withSeparators = childArray.reduce<React.ReactNode[]>((acc, child, idx) => {
    if (idx > 0) {
      acc.push(<Separator key={`sep-${idx}`} className="my-1" />);
    }
    acc.push(child);
    return acc;
  }, []);

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      <ScrollArea className="flex-1">{withSeparators}</ScrollArea>
    </div>
  );
}

export { SidebarLayout, SidebarSection };
