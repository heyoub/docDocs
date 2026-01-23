/**
 * ModelCard - Individual model card component
 * Shows model info, download status, and action buttons
 */

import {
  Download,
  Check,
  X,
  Trash2,
  Cpu,
  Zap,
  Star,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../atoms/Button';
import { Badge } from '../atoms/Badge';
import { Progress } from '../atoms/Progress';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '../atoms/Tooltip';
import type { ModelInfo, DownloadProgress, ModelRecommendation } from '../../../../protocol';

// ============================================================================
// Types
// ============================================================================

export type ModelCardStatus = 'not-downloaded' | 'downloading' | 'downloaded' | 'selected';

export interface ModelCardProps {
  model: ModelInfo;
  status: ModelCardStatus;
  progress?: DownloadProgress;
  recommendation?: ModelRecommendation;
  onDownload: () => void;
  onSelect: () => void;
  onDelete: () => void;
  onCancel?: () => void;
}

// ============================================================================
// Helper Components
// ============================================================================

function RecommendationBadge({ score }: { score: number }) {
  if (score > 80) {
    return (
      <Badge variant="default" className="bg-green-500/20 text-green-500 border-green-500/30">
        Great fit
      </Badge>
    );
  }
  if (score >= 50) {
    return (
      <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
        Should work
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-red-500/20 text-red-500 border-red-500/30">
      May struggle
    </Badge>
  );
}

function CategoryBadge({ category }: { category: ModelInfo['category'] }) {
  const styles: Record<ModelInfo['category'], string> = {
    code: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    general: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    reasoning: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    embedding: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  };

  return (
    <Badge variant="outline" className={styles[category]}>
      {category}
    </Badge>
  );
}

function SizeBadge({ size }: { size: string }) {
  return (
    <Badge variant="outline" className="font-mono">
      {size}
    </Badge>
  );
}

function FeatureBadges({ requirements }: { requirements: ModelInfo['requirements'] }) {
  return (
    <div className="flex gap-1">
      <TooltipProvider>
        {requirements.supportsWebGPU && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-accent text-accent-foreground">
                <Zap className="h-3 w-3" />
              </span>
            </TooltipTrigger>
            <TooltipContent>WebGPU accelerated</TooltipContent>
          </Tooltip>
        )}
        {requirements.supportsCPU && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-accent text-accent-foreground">
                <Cpu className="h-3 w-3" />
              </span>
            </TooltipTrigger>
            <TooltipContent>Runs on CPU</TooltipContent>
          </Tooltip>
        )}
      </TooltipProvider>
    </div>
  );
}

// ============================================================================
// ModelCard Component
// ============================================================================

export function ModelCard({
  model,
  status,
  progress,
  recommendation,
  onDownload,
  onSelect,
  onDelete,
  onCancel,
}: ModelCardProps) {
  const isDownloading = status === 'downloading';
  const isDownloaded = status === 'downloaded' || status === 'selected';
  const isSelected = status === 'selected';

  return (
    <div
      className={cn(
        'relative border rounded-lg p-4 transition-all',
        isSelected
          ? 'border-primary bg-primary/5 ring-1 ring-primary'
          : 'border-border hover:border-primary/50',
        isDownloading && 'opacity-90'
      )}
    >
      {/* Recommended star */}
      {model.recommended && (
        <div className="absolute -top-2 -right-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-500 text-white">
                  <Star className="h-3.5 w-3.5 fill-current" />
                </span>
              </TooltipTrigger>
              <TooltipContent>Recommended for documentation</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-foreground truncate">{model.name}</h3>
          <p className="text-xs text-muted-foreground truncate font-mono">{model.id}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <SizeBadge size={model.size} />
          <CategoryBadge category={model.category} />
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{model.description}</p>

      {/* Requirements & Features */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Min: {model.requirements.minRAM}
          </span>
          <FeatureBadges requirements={model.requirements} />
        </div>
        {recommendation && <RecommendationBadge score={recommendation.score} />}
      </div>

      {/* Recommendation reason */}
      {recommendation && (
        <p className="text-xs text-muted-foreground mb-3">{recommendation.reason}</p>
      )}

      {/* Warnings */}
      {recommendation?.warnings && recommendation.warnings.length > 0 && (
        <div className="flex items-start gap-1 mb-3 text-xs text-yellow-500">
          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
          <span>{recommendation.warnings.join('. ')}</span>
        </div>
      )}

      {/* Download progress */}
      {isDownloading && progress && (
        <div className="mb-3 space-y-1">
          <Progress value={progress.percent} className="h-1.5" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{progress.percent}%</span>
            <span>
              {progress.speed} - {progress.eta}
            </span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {status === 'not-downloaded' && (
          <Button onClick={onDownload} size="sm" className="flex-1">
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Download
          </Button>
        )}

        {isDownloading && (
          <Button onClick={onCancel} variant="outline" size="sm" className="flex-1">
            <X className="h-3.5 w-3.5 mr-1.5" />
            Cancel
          </Button>
        )}

        {isDownloaded && !isSelected && (
          <>
            <Button onClick={onSelect} size="sm" className="flex-1">
              <Check className="h-3.5 w-3.5 mr-1.5" />
              Select
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={onDelete} variant="ghost" size="sm">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete from cache</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
        )}

        {isSelected && (
          <>
            <div className="flex-1 flex items-center justify-center gap-1.5 text-sm text-primary font-medium">
              <Check className="h-4 w-4" />
              Active
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={onDelete} variant="ghost" size="sm">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete from cache</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
        )}
      </div>
    </div>
  );
}
