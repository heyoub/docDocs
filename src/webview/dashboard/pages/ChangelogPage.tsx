import { useState } from 'react';
import { useAtomValue } from 'jotai';
import {
  History,
  Plus,
  GitCompare,
  Download,
  Clock,
  FileText,
} from 'lucide-react';
import { snapshotsAtom, configLoadingAtom } from '../../shared/store';
import { usePostMessage } from '../../shared/hooks';
import { Button } from '../../shared/components/atoms/Button';
import { Input } from '../../shared/components/atoms/Input';
import { Skeleton } from '../../shared/components/atoms/Skeleton';
import { Badge } from '../../shared/components/atoms/Badge';
import { EmptyState } from '../../shared/components/molecules/EmptyState';
import { formatRelativeTime } from '../../shared/lib/utils';
import type { Snapshot } from '../../../protocol';

function ChangelogHeader() {
  const [isCreating, setIsCreating] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');
  const postMessage = usePostMessage();

  const handleCreateSnapshot = () => {
    if (snapshotName.trim()) {
      postMessage({
        type: 'snapshot:create',
        payload: { name: snapshotName.trim() },
      });
      setSnapshotName('');
      setIsCreating(false);
    }
  };

  return (
    <div className="flex items-start justify-between">
      <div>
        <h1 className="text-2xl font-semibold">API Changelog</h1>
        <p className="text-muted-foreground mt-1">
          Track API changes across snapshots
        </p>
      </div>
      {isCreating ? (
        <div className="flex items-center gap-2">
          <Input
            placeholder="Snapshot name..."
            value={snapshotName}
            onChange={(e) => setSnapshotName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateSnapshot()}
            className="w-48"
            autoFocus
          />
          <Button onClick={handleCreateSnapshot} disabled={!snapshotName.trim()}>
            Create
          </Button>
          <Button variant="ghost" onClick={() => setIsCreating(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Snapshot
        </Button>
      )}
    </div>
  );
}

function SnapshotList() {
  const snapshots = useAtomValue(snapshotsAtom);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const postMessage = usePostMessage();

  const handleSelect = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((i) => i !== id);
      }
      if (prev.length >= 2) {
        return [prev[1]!, id];
      }
      return [...prev, id];
    });
  };

  const handleCompare = () => {
    if (selectedIds.length === 2) {
      postMessage({
        type: 'snapshot:compare',
        payload: { fromId: selectedIds[0]!, toId: selectedIds[1]! },
      });
    }
  };

  if (snapshots.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No snapshots yet"
        description="Create your first snapshot to start tracking API changes"
        action={{
          label: 'Create Snapshot',
          onClick: () => {
            // Trigger the header's create mode
          },
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {selectedIds.length === 2 && (
        <div className="flex items-center justify-between p-3 rounded-lg border border-primary/30 bg-primary/10">
          <p className="text-sm">
            Compare <strong>{selectedIds[0]}</strong> with{' '}
            <strong>{selectedIds[1]}</strong>
          </p>
          <Button onClick={handleCompare}>
            <GitCompare className="h-4 w-4 mr-2" />
            Compare
          </Button>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card divide-y divide-border">
        {snapshots.map((snapshot) => (
          <SnapshotItem
            key={snapshot.id}
            snapshot={snapshot}
            isSelected={selectedIds.includes(snapshot.id)}
            onSelect={() => handleSelect(snapshot.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface SnapshotItemProps {
  snapshot: Snapshot;
  isSelected: boolean;
  onSelect: () => void;
}

function SnapshotItem({ snapshot, isSelected, onSelect }: SnapshotItemProps) {
  return (
    <div
      className={`flex items-center gap-4 p-4 cursor-pointer hover:bg-list-hover ${
        isSelected ? 'bg-list-active' : ''
      }`}
      onClick={onSelect}
    >
      <div
        className={`w-4 h-4 rounded-full border-2 ${
          isSelected
            ? 'border-primary bg-primary'
            : 'border-muted-foreground'
        }`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">{snapshot.name}</h3>
          <Badge variant="outline">{snapshot.id.slice(0, 8)}</Badge>
        </div>
        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatRelativeTime(snapshot.timestamp)}
          </span>
          <span className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            {snapshot.fileCount} files
          </span>
        </div>
      </div>
      <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
        <Download className="h-4 w-4" />
      </Button>
    </div>
  );
}

function ChangelogGuide() {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="font-semibold mb-3">How to Use Snapshots</h2>
      <div className="space-y-3 text-sm text-muted-foreground">
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-medium shrink-0">
            1
          </div>
          <p>
            <strong className="text-foreground">Create a snapshot</strong> to
            capture the current state of your API documentation.
          </p>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-medium shrink-0">
            2
          </div>
          <p>
            <strong className="text-foreground">Make changes</strong> to your
            code and regenerate documentation.
          </p>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-medium shrink-0">
            3
          </div>
          <p>
            <strong className="text-foreground">Create another snapshot</strong>{' '}
            and compare to see what changed.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ChangelogPage() {
  const isLoading = useAtomValue(configLoadingAtom);
  const snapshots = useAtomValue(snapshotsAtom);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ChangelogHeader />
      <div className="grid grid-cols-3 gap-6">
        <div className={snapshots.length > 0 ? 'col-span-2' : 'col-span-3'}>
          <SnapshotList />
        </div>
        {snapshots.length > 0 && snapshots.length < 5 && (
          <div>
            <ChangelogGuide />
          </div>
        )}
      </div>
    </div>
  );
}
