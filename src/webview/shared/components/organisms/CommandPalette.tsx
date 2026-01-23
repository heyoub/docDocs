import * as React from 'react';
import { Command } from 'cmdk';
import * as Dialog from '@radix-ui/react-dialog';
import { Search } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  onSelect: () => void;
}

export interface CommandGroup {
  heading: string;
  items: CommandItem[];
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: CommandGroup[];
  placeholder?: string;
}

function CommandPalette({
  open,
  onOpenChange,
  groups,
  placeholder = 'Type a command or search...',
}: CommandPaletteProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/4 -translate-x-1/2 w-full max-w-lg animate-slide-down">
          <Command className="rounded-lg border border-border bg-card shadow-lg overflow-hidden">
            <div className="flex items-center border-b border-border px-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Command.Input
                placeholder={placeholder}
                className="flex h-10 w-full bg-transparent py-3 px-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
            <Command.List className="max-h-80 overflow-y-auto p-2">
              <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                No results found.
              </Command.Empty>
              {groups.map((group) => (
                <Command.Group
                  key={group.heading}
                  heading={group.heading}
                  className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
                >
                  {group.items.map((item) => (
                    <Command.Item
                      key={item.id}
                      value={item.label}
                      onSelect={() => {
                        item.onSelect();
                        onOpenChange(false);
                      }}
                      className={cn(
                        'relative flex cursor-pointer select-none items-center rounded px-2 py-1.5 text-sm outline-none',
                        'aria-selected:bg-list-hover aria-selected:text-list-hover-foreground',
                        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50'
                      )}
                    >
                      {item.icon && (
                        <item.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                      )}
                      <div className="flex-1">
                        <p>{item.label}</p>
                        {item.description && (
                          <p className="text-xs text-muted-foreground">
                            {item.description}
                          </p>
                        )}
                      </div>
                      {item.shortcut && (
                        <kbd className="ml-auto text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {item.shortcut}
                        </kbd>
                      )}
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export { CommandPalette };
