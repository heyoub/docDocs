import { useState } from 'react';
import {
  BookOpen,
  FileCode,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  Folder,
} from 'lucide-react';
import { useVSCodeMessaging, useSaveConfig, useVSCodeCommand, useThemeClass } from '../shared/hooks';
import { Button } from '../shared/components/atoms/Button';
import { Input } from '../shared/components/atoms/Input';
import { Checkbox } from '../shared/components/atoms/Checkbox';
import { Switch } from '../shared/components/atoms/Switch';
import { Progress } from '../shared/components/atoms/Progress';
import { TooltipProvider } from '../shared/components/atoms/Tooltip';
import { cn } from '../shared/lib/utils';

type Step = 'welcome' | 'output' | 'formats' | 'features' | 'complete';

const steps: Step[] = ['welcome', 'output', 'formats', 'features', 'complete'];

interface WizardState {
  outputDirectory: string;
  formats: string[];
  enableML: boolean;
  enableWatch: boolean;
  enableCodeLens: boolean;
}

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="text-center max-w-md mx-auto">
      <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
        <BookOpen className="h-8 w-8 text-primary" />
      </div>
      <h1 className="text-2xl font-semibold mb-2">Welcome to DocDocs</h1>
      <p className="text-muted-foreground mb-8">
        Let's set up your documentation environment in just a few steps.
        DocDocs will help you generate, manage, and maintain documentation
        for your codebase.
      </p>
      <Button onClick={onNext} size="lg">
        Get Started
        <ArrowRight className="h-4 w-4 ml-2" />
      </Button>
    </div>
  );
}

function OutputStep({
  state,
  onChange,
  onNext,
  onBack,
}: {
  state: WizardState;
  onChange: (updates: Partial<WizardState>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
          <Folder className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Output Directory</h2>
          <p className="text-sm text-muted-foreground">
            Where should DocDocs save generated documentation?
          </p>
        </div>
      </div>

      <div className="space-y-4 mb-8">
        <div>
          <label className="text-sm font-medium mb-2 block">
            Documentation Directory
          </label>
          <Input
            value={state.outputDirectory}
            onChange={(e) => onChange({ outputDirectory: e.target.value })}
            placeholder=".docdocs"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Relative to your workspace root
          </p>
        </div>

        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <p className="text-sm font-medium mb-2">Preview</p>
          <code className="text-xs text-muted-foreground">
            your-project/<br />
            ├── src/<br />
            ├── {state.outputDirectory || '.docdocs'}/<br />
            │   ├── modules/<br />
            │   └── index.md<br />
            └── package.json
          </code>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button onClick={onNext}>
          Continue
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

function FormatsStep({
  state,
  onChange,
  onNext,
  onBack,
}: {
  state: WizardState;
  onChange: (updates: Partial<WizardState>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const formats = [
    {
      id: 'markdown',
      label: 'Markdown',
      description: 'Human-readable documentation files',
      recommended: true,
    },
    {
      id: 'ai-context',
      label: 'AI Context',
      description: 'Optimized for AI assistants like Claude',
      recommended: true,
    },
    {
      id: 'json-schema',
      label: 'JSON Schema',
      description: 'Structured API schema in JSON format',
      recommended: false,
    },
    {
      id: 'openapi',
      label: 'OpenAPI',
      description: 'REST API specification (Swagger)',
      recommended: false,
    },
  ];

  const toggleFormat = (formatId: string) => {
    const newFormats = state.formats.includes(formatId)
      ? state.formats.filter((f) => f !== formatId)
      : [...state.formats, formatId];
    onChange({ formats: newFormats });
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
          <FileCode className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Output Formats</h2>
          <p className="text-sm text-muted-foreground">
            Select the documentation formats you want to generate
          </p>
        </div>
      </div>

      <div className="space-y-3 mb-8">
        {formats.map((format) => (
          <label
            key={format.id}
            className={cn(
              'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
              state.formats.includes(format.id)
                ? 'border-primary bg-primary/5'
                : 'border-border hover:bg-muted/50'
            )}
          >
            <Checkbox
              checked={state.formats.includes(format.id)}
              onCheckedChange={() => toggleFormat(format.id)}
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{format.label}</span>
                {format.recommended && (
                  <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                    Recommended
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {format.description}
              </p>
            </div>
          </label>
        ))}
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button onClick={onNext} disabled={state.formats.length === 0}>
          Continue
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

function FeaturesStep({
  state,
  onChange,
  onNext,
  onBack,
}: {
  state: WizardState;
  onChange: (updates: Partial<WizardState>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Features</h2>
          <p className="text-sm text-muted-foreground">
            Enable optional features to enhance your experience
          </p>
        </div>
      </div>

      <div className="space-y-4 mb-8">
        <div className="flex items-center justify-between p-4 rounded-lg border border-border">
          <div>
            <p className="font-medium">CodeLens Actions</p>
            <p className="text-xs text-muted-foreground">
              Show inline actions above symbols in editor
            </p>
          </div>
          <Switch
            checked={state.enableCodeLens}
            onCheckedChange={(checked) => onChange({ enableCodeLens: checked })}
          />
        </div>

        <div className="flex items-center justify-between p-4 rounded-lg border border-border">
          <div>
            <p className="font-medium">Watch Mode</p>
            <p className="text-xs text-muted-foreground">
              Auto-regenerate docs when files change
            </p>
          </div>
          <Switch
            checked={state.enableWatch}
            onCheckedChange={(checked) => onChange({ enableWatch: checked })}
          />
        </div>

        <div className="flex items-center justify-between p-4 rounded-lg border border-border">
          <div>
            <p className="font-medium">ML-Powered Prose</p>
            <p className="text-xs text-muted-foreground">
              Use AI to generate better descriptions
            </p>
          </div>
          <Switch
            checked={state.enableML}
            onCheckedChange={(checked) => onChange({ enableML: checked })}
          />
        </div>
        {state.enableML && (
          <p className="text-xs text-warning bg-warning/10 p-2 rounded">
            ML generation requires downloading a model (~360MB) on first use.
          </p>
        )}
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button onClick={onNext}>
          Complete Setup
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

function CompleteStep({
  state,
  onFinish,
}: {
  state: WizardState;
  onFinish: () => void;
}) {
  const runCommand = useVSCodeCommand();

  const handleGenerateFirst = () => {
    onFinish();
    runCommand('docdocs.generateFile');
  };

  return (
    <div className="text-center max-w-md mx-auto">
      <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-6">
        <Check className="h-8 w-8 text-success" />
      </div>
      <h1 className="text-2xl font-semibold mb-2">You're All Set!</h1>
      <p className="text-muted-foreground mb-6">
        DocDocs is configured and ready to generate documentation for your project.
      </p>

      <div className="rounded-lg border border-border bg-muted/50 p-4 text-left mb-8">
        <h3 className="font-medium mb-3">Your Configuration</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Output Directory</span>
            <span>{state.outputDirectory}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Formats</span>
            <span>{state.formats.join(', ')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">CodeLens</span>
            <span>{state.enableCodeLens ? 'Enabled' : 'Disabled'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Watch Mode</span>
            <span>{state.enableWatch ? 'Enabled' : 'Disabled'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">ML Generation</span>
            <span>{state.enableML ? 'Enabled' : 'Disabled'}</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <Button onClick={handleGenerateFirst} size="lg" className="w-full">
          <FileCode className="h-4 w-4 mr-2" />
          Generate First Documentation
        </Button>
        <Button variant="outline" onClick={onFinish} className="w-full">
          Open Dashboard
        </Button>
      </div>
    </div>
  );
}

function StepIndicator({ currentStep }: { currentStep: Step }) {
  const currentIndex = steps.indexOf(currentStep);
  const progress = ((currentIndex + 1) / steps.length) * 100;

  return (
    <div className="mb-8">
      <Progress value={progress} className="h-1" />
      <div className="flex justify-between mt-2 text-xs text-muted-foreground">
        <span>Step {currentIndex + 1} of {steps.length}</span>
        <span>{Math.round(progress)}% complete</span>
      </div>
    </div>
  );
}

export default function App() {
  useVSCodeMessaging();
  useThemeClass();
  const saveConfig = useSaveConfig();
  const runCommand = useVSCodeCommand();

  const [currentStep, setCurrentStep] = useState<Step>('welcome');
  const [state, setState] = useState<WizardState>({
    outputDirectory: '.docdocs',
    formats: ['markdown', 'ai-context'],
    enableML: false,
    enableWatch: false,
    enableCodeLens: true,
  });

  const handleChange = (updates: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  };

  const goNext = () => {
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]!);
    }
  };
  const goBack = () => {
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]!);
    }
  };

  const handleFinish = () => {
    // Save configuration
    saveConfig({
      output: {
        directory: state.outputDirectory,
        formats: state.formats,
      },
      ml: {
        enabled: state.enableML,
        model: 'HuggingFaceTB/SmolLM2-360M-Instruct',
      },
      watch: {
        enabled: state.enableWatch,
        debounceMs: 1000,
      },
      codeLens: {
        enabled: state.enableCodeLens,
      },
    });
    // Open dashboard
    runCommand('docdocs.openDashboard');
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-lg">
          {currentStep !== 'welcome' && currentStep !== 'complete' && (
            <StepIndicator currentStep={currentStep} />
          )}

          {currentStep === 'welcome' && <WelcomeStep onNext={goNext} />}
          {currentStep === 'output' && (
            <OutputStep
              state={state}
              onChange={handleChange}
              onNext={goNext}
              onBack={goBack}
            />
          )}
          {currentStep === 'formats' && (
            <FormatsStep
              state={state}
              onChange={handleChange}
              onNext={goNext}
              onBack={goBack}
            />
          )}
          {currentStep === 'features' && (
            <FeaturesStep
              state={state}
              onChange={handleChange}
              onNext={goNext}
              onBack={goBack}
            />
          )}
          {currentStep === 'complete' && (
            <CompleteStep state={state} onFinish={handleFinish} />
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
