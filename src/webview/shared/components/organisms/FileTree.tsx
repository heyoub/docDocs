import * as React from 'react';
import { FileItem } from '../molecules/FileItem';
import { ScrollArea } from '../atoms/ScrollArea';
import { EmptyState } from '../molecules/EmptyState';
import { FolderOpen } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { FreshnessStatus } from '../../../../protocol';

export interface FileTreeNode {
  path: string;
  name: string;
  isFolder: boolean;
  status?: FreshnessStatus;
  children?: FileTreeNode[];
}

export interface FileTreeProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  nodes: FileTreeNode[];
  selectedPath?: string;
  onSelect?: (path: string) => void;
  emptyMessage?: string;
}

interface FileTreeItemProps {
  node: FileTreeNode;
  depth: number;
  selectedPath?: string;
  expandedPaths: Set<string>;
  onSelect?: (path: string) => void;
  onToggle: (path: string) => void;
}

function FileTreeItem({
  node,
  depth,
  selectedPath,
  expandedPaths,
  onSelect,
  onToggle,
}: FileTreeItemProps) {
  const isExpanded = expandedPaths.has(node.path);
  const isActive = selectedPath === node.path;

  const handleClick = () => {
    if (node.isFolder) {
      onToggle(node.path);
    } else {
      onSelect?.(node.path);
    }
  };

  return (
    <>
      <FileItem
        path={node.path}
        status={node.status}
        isFolder={node.isFolder}
        isExpanded={isExpanded}
        depth={depth}
        isActive={isActive}
        onClick={handleClick}
      />
      {node.isFolder && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              expandedPaths={expandedPaths}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </>
  );
}

function FileTree({
  nodes,
  selectedPath,
  onSelect,
  emptyMessage = 'No files found',
  className,
}: FileTreeProps) {
  const [expandedPaths, setExpandedPaths] = React.useState<Set<string>>(
    () => new Set()
  );

  const handleToggle = React.useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  if (nodes.length === 0) {
    return (
      <EmptyState
        icon={FolderOpen}
        title="No files"
        description={emptyMessage}
        className={className}
      />
    );
  }

  return (
    <ScrollArea className={cn('h-full', className)}>
      <div className="py-1">
        {nodes.map((node) => (
          <FileTreeItem
            key={node.path}
            node={node}
            depth={0}
            selectedPath={selectedPath}
            expandedPaths={expandedPaths}
            onSelect={onSelect}
            onToggle={handleToggle}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

export { FileTree };
