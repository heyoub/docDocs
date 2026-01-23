import * as React from 'react';
import {
  FileCode,
  FileJson,
  FileText,
  File,
  Folder,
  FolderOpen,
} from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { cn, getFileExtension, getFileName } from '../../lib/utils';
import type { FreshnessStatus } from '../../../../protocol';

const fileIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  ts: FileCode,
  tsx: FileCode,
  js: FileCode,
  jsx: FileCode,
  py: FileCode,
  rs: FileCode,
  go: FileCode,
  json: FileJson,
  md: FileText,
  txt: FileText,
};

export interface FileItemProps extends React.HTMLAttributes<HTMLButtonElement> {
  path: string;
  status?: FreshnessStatus;
  isFolder?: boolean;
  isExpanded?: boolean;
  depth?: number;
  isActive?: boolean;
}

function FileItem({
  path,
  status,
  isFolder = false,
  isExpanded = false,
  depth = 0,
  isActive = false,
  className,
  ...props
}: FileItemProps) {
  const fileName = getFileName(path);
  const extension = getFileExtension(path).toLowerCase();
  const Icon = isFolder
    ? isExpanded
      ? FolderOpen
      : Folder
    : fileIcons[extension] || File;

  return (
    <button
      className={cn(
        'flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm',
        'hover:bg-list-hover hover:text-list-hover-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isActive && 'bg-list-active text-list-active-foreground',
        className
      )}
      style={{ paddingLeft: `${8 + depth * 12}px` }}
      {...props}
    >
      <Icon
        className={cn(
          'h-4 w-4 shrink-0',
          isFolder ? 'text-warning' : 'text-muted-foreground'
        )}
      />
      <span className="flex-1 truncate">{fileName}</span>
      {status && <StatusBadge status={status} showLabel={false} />}
    </button>
  );
}

export { FileItem };
