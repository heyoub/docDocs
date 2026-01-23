import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../atoms/Collapsible';
import { cn } from '../../lib/utils';

export interface ConfigSectionProps
  extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  defaultOpen?: boolean;
}

function ConfigSection({
  title,
  description,
  defaultOpen = true,
  children,
  className,
  ...props
}: ConfigSectionProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} {...props}>
      <div className={cn('border border-border rounded', className)}>
        <CollapsibleTrigger className="flex w-full items-center justify-between p-3 hover:bg-muted/50 transition-colors">
          <div className="text-left">
            <h3 className="font-medium text-foreground">{title}</h3>
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {description}
              </p>
            )}
          </div>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform',
              isOpen && 'rotate-180'
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border p-3 space-y-4">{children}</div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export { ConfigSection };
