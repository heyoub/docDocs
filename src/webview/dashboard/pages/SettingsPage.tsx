import { useState, useEffect } from 'react';
import { useAtomValue } from 'jotai';
import { Save, RotateCcw } from 'lucide-react';
import { configAtom, configLoadingAtom } from '../../shared/store';
import { useSaveConfig, usePostMessage } from '../../shared/hooks';
import { Button } from '../../shared/components/atoms/Button';
import { Switch } from '../../shared/components/atoms/Switch';
import { Skeleton } from '../../shared/components/atoms/Skeleton';
import { Checkbox } from '../../shared/components/atoms/Checkbox';
import { ConfigSection } from '../../shared/components/organisms/ConfigSection';
import { ModelManager } from '../../shared/components/organisms/ModelManager';
import { FormField } from '../../shared/components/molecules/FormField';
import type { DocDocsConfig } from '../../../protocol';

const DEFAULT_CONFIG: DocDocsConfig = {
  output: {
    directory: '.docdocs',
    formats: ['markdown', 'ai-context'],
  },
  ml: {
    enabled: false,
    model: 'HuggingFaceTB/SmolLM2-360M-Instruct',
  },
  codeLens: {
    enabled: true,
  },
  statusBar: {
    enabled: true,
    freshnessThreshold: 80,
  },
  watch: {
    enabled: false,
    debounceMs: 1000,
  },
  extraction: {
    treeSitterFallback: true,
    timeout: 5000,
  },
};

function SettingsHeader() {
  const postMessage = usePostMessage();

  const handleResetAll = () => {
    if (confirm('Reset all settings to defaults? This cannot be undone.')) {
      postMessage({
        type: 'config:save',
        payload: DEFAULT_CONFIG,
      });
    }
  };

  return (
    <div className="flex items-start justify-between">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure DocDocs extension settings
        </p>
      </div>
      <Button variant="outline" onClick={handleResetAll}>
        <RotateCcw className="h-4 w-4 mr-2" />
        Reset All to Defaults
      </Button>
    </div>
  );
}

function OutputSettings() {
  const config = useAtomValue(configAtom);
  const saveConfig = useSaveConfig();
  const [directory, setDirectory] = useState(config?.output.directory ?? '.docdocs');
  const [formats, setFormats] = useState<string[]>(config?.output.formats ?? []);

  useEffect(() => {
    if (config) {
      setDirectory(config.output.directory);
      setFormats(config.output.formats);
    }
  }, [config]);

  const availableFormats = [
    { id: 'markdown', label: 'Markdown', description: 'Human-readable documentation' },
    { id: 'ai-context', label: 'AI Context', description: 'Optimized for AI assistants' },
    { id: 'json-schema', label: 'JSON Schema', description: 'Structured schema output' },
    { id: 'openapi', label: 'OpenAPI', description: 'REST API documentation' },
    { id: 'graphql', label: 'GraphQL', description: 'GraphQL schema docs' },
    { id: 'lsif', label: 'LSIF', description: 'Language Server Index Format' },
    { id: 'notebook', label: 'Notebook', description: 'Jupyter notebook format' },
  ];

  const handleFormatToggle = (formatId: string) => {
    const newFormats = formats.includes(formatId)
      ? formats.filter((f) => f !== formatId)
      : [...formats, formatId];
    setFormats(newFormats);
  };

  const handleSave = () => {
    saveConfig({
      output: { directory, formats },
    });
  };

  const handleReset = () => {
    setDirectory(DEFAULT_CONFIG.output.directory);
    setFormats(DEFAULT_CONFIG.output.formats);
  };

  return (
    <ConfigSection title="Output" description="Configure documentation output settings">
      <FormField
        label="Output Directory"
        description="Directory where documentation files are generated"
        value={directory}
        onChange={(e) => setDirectory(e.target.value)}
      />
      <div className="space-y-2">
        <label className="text-sm font-medium">Output Formats</label>
        <p className="text-xs text-muted-foreground mb-2">
          Select which formats to generate
        </p>
        <div className="grid grid-cols-2 gap-3">
          {availableFormats.map((format) => (
            <label
              key={format.id}
              className="flex items-start gap-3 p-3 rounded border border-border hover:bg-muted/50 cursor-pointer"
            >
              <Checkbox
                checked={formats.includes(format.id)}
                onCheckedChange={() => handleFormatToggle(format.id)}
              />
              <div>
                <p className="text-sm font-medium">{format.label}</p>
                <p className="text-xs text-muted-foreground">{format.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>
      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={handleReset}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset
        </Button>
        <Button onClick={handleSave}>
          <Save className="h-4 w-4 mr-2" />
          Save Output Settings
        </Button>
      </div>
    </ConfigSection>
  );
}

function MLSettings() {
  const config = useAtomValue(configAtom);
  const saveConfig = useSaveConfig();
  const [enabled, setEnabled] = useState(config?.ml.enabled ?? false);

  useEffect(() => {
    if (config) {
      setEnabled(config.ml.enabled);
    }
  }, [config]);

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    saveConfig({
      ml: { enabled: checked, model: config?.ml.model ?? '' },
    });
  };

  return (
    <ConfigSection
      title="ML-Powered Generation"
      description="Use machine learning for enhanced prose generation"
      defaultOpen={true}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-medium">Enable ML Generation</p>
          <p className="text-xs text-muted-foreground">
            Uses local models for better documentation prose
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={handleToggle} />
      </div>
      {enabled && <ModelManager />}
    </ConfigSection>
  );
}

function WatchSettings() {
  const config = useAtomValue(configAtom);
  const saveConfig = useSaveConfig();
  const [enabled, setEnabled] = useState(config?.watch.enabled ?? false);
  const [debounceMs, setDebounceMs] = useState(
    config?.watch.debounceMs?.toString() ?? '1000'
  );

  useEffect(() => {
    if (config) {
      setEnabled(config.watch.enabled);
      setDebounceMs(config.watch.debounceMs.toString());
    }
  }, [config]);

  const handleSave = () => {
    saveConfig({
      watch: { enabled, debounceMs: parseInt(debounceMs, 10) || 1000 },
    });
  };

  const handleReset = () => {
    setEnabled(DEFAULT_CONFIG.watch.enabled);
    setDebounceMs(DEFAULT_CONFIG.watch.debounceMs.toString());
  };

  return (
    <ConfigSection
      title="Watch Mode"
      description="Automatically regenerate documentation on file changes"
      defaultOpen={false}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Enable Watch Mode</p>
          <p className="text-xs text-muted-foreground">
            Automatically regenerate docs when source files change
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>
      {enabled && (
        <FormField
          label="Debounce Delay (ms)"
          description="Time to wait after changes before regenerating"
          type="number"
          value={debounceMs}
          onChange={(e) => setDebounceMs(e.target.value)}
          min={100}
          max={10000}
        />
      )}
      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={handleReset}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset
        </Button>
        <Button onClick={handleSave}>
          <Save className="h-4 w-4 mr-2" />
          Save Watch Settings
        </Button>
      </div>
    </ConfigSection>
  );
}

function ExtractionSettings() {
  const config = useAtomValue(configAtom);
  const saveConfig = useSaveConfig();
  const [treeSitterFallback, setTreeSitterFallback] = useState(
    config?.extraction.treeSitterFallback ?? true
  );
  const [timeout, setTimeout] = useState(
    config?.extraction.timeout?.toString() ?? '5000'
  );

  useEffect(() => {
    if (config) {
      setTreeSitterFallback(config.extraction.treeSitterFallback);
      setTimeout(config.extraction.timeout.toString());
    }
  }, [config]);

  const handleSave = () => {
    saveConfig({
      extraction: {
        treeSitterFallback,
        timeout: parseInt(timeout, 10) || 5000,
      },
    });
  };

  const handleReset = () => {
    setTreeSitterFallback(DEFAULT_CONFIG.extraction.treeSitterFallback);
    setTimeout(DEFAULT_CONFIG.extraction.timeout.toString());
  };

  return (
    <ConfigSection
      title="Symbol Extraction"
      description="Configure how symbols are extracted from source code"
      defaultOpen={false}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Tree-sitter Fallback</p>
          <p className="text-xs text-muted-foreground">
            Use tree-sitter when LSP is unavailable
          </p>
        </div>
        <Switch
          checked={treeSitterFallback}
          onCheckedChange={setTreeSitterFallback}
        />
      </div>
      <FormField
        label="LSP Timeout (ms)"
        description="Maximum time to wait for LSP response per file"
        type="number"
        value={timeout}
        onChange={(e) => setTimeout(e.target.value)}
        min={1000}
        max={30000}
      />
      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={handleReset}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset
        </Button>
        <Button onClick={handleSave}>
          <Save className="h-4 w-4 mr-2" />
          Save Extraction Settings
        </Button>
      </div>
    </ConfigSection>
  );
}

function UISettings() {
  const config = useAtomValue(configAtom);
  const saveConfig = useSaveConfig();
  const [codeLensEnabled, setCodeLensEnabled] = useState(
    config?.codeLens.enabled ?? true
  );
  const [statusBarEnabled, setStatusBarEnabled] = useState(
    config?.statusBar.enabled ?? true
  );
  const [freshnessThreshold, setFreshnessThreshold] = useState(
    config?.statusBar.freshnessThreshold?.toString() ?? '80'
  );

  useEffect(() => {
    if (config) {
      setCodeLensEnabled(config.codeLens.enabled);
      setStatusBarEnabled(config.statusBar.enabled);
      setFreshnessThreshold(config.statusBar.freshnessThreshold.toString());
    }
  }, [config]);

  const handleSave = () => {
    saveConfig({
      codeLens: { enabled: codeLensEnabled },
      statusBar: {
        enabled: statusBarEnabled,
        freshnessThreshold: parseInt(freshnessThreshold, 10) || 80,
      },
    });
  };

  const handleReset = () => {
    setCodeLensEnabled(DEFAULT_CONFIG.codeLens.enabled);
    setStatusBarEnabled(DEFAULT_CONFIG.statusBar.enabled);
    setFreshnessThreshold(DEFAULT_CONFIG.statusBar.freshnessThreshold.toString());
  };

  return (
    <ConfigSection
      title="UI Settings"
      description="Configure CodeLens and status bar behavior"
      defaultOpen={false}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">CodeLens</p>
          <p className="text-xs text-muted-foreground">
            Show inline actions above symbols
          </p>
        </div>
        <Switch checked={codeLensEnabled} onCheckedChange={setCodeLensEnabled} />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Status Bar</p>
          <p className="text-xs text-muted-foreground">
            Show documentation status in status bar
          </p>
        </div>
        <Switch
          checked={statusBarEnabled}
          onCheckedChange={setStatusBarEnabled}
        />
      </div>
      {statusBarEnabled && (
        <FormField
          label="Freshness Warning Threshold (%)"
          description="Show warning when freshness drops below this percentage"
          type="number"
          value={freshnessThreshold}
          onChange={(e) => setFreshnessThreshold(e.target.value)}
          min={0}
          max={100}
        />
      )}
      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={handleReset}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset
        </Button>
        <Button onClick={handleSave}>
          <Save className="h-4 w-4 mr-2" />
          Save UI Settings
        </Button>
      </div>
    </ConfigSection>
  );
}

export default function SettingsPage() {
  const isLoading = useAtomValue(configLoadingAtom);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12" />
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <SettingsHeader />
      <OutputSettings />
      <MLSettings />
      <WatchSettings />
      <ExtractionSettings />
      <UISettings />
    </div>
  );
}
