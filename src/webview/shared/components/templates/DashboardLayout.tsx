import * as React from 'react';
import { useAtom } from 'jotai';
import {
  LayoutDashboard,
  PieChart,
  Clock,
  History,
  Settings,
  Command,
} from 'lucide-react';
import { Button } from '../atoms/Button';
import { Separator } from '../atoms/Separator';
import { ScrollArea } from '../atoms/ScrollArea';
import { CommandPalette, type CommandGroup } from '../organisms/CommandPalette';
import { activePageAtom, commandPaletteOpenAtom } from '../../store';
import { useVSCodeCommand } from '../../hooks';
import { cn } from '../../lib/utils';

type Page = 'overview' | 'coverage' | 'freshness' | 'changelog' | 'settings';

const navItems: Array<{ id: Page; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'coverage', label: 'Coverage', icon: PieChart },
  { id: 'freshness', label: 'Freshness', icon: Clock },
  { id: 'changelog', label: 'Changelog', icon: History },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export interface DashboardLayoutProps {
  children: React.ReactNode;
}

function DashboardLayout({ children }: DashboardLayoutProps) {
  const [activePage, setActivePage] = useAtom(activePageAtom);
  const [commandPaletteOpen, setCommandPaletteOpen] = useAtom(commandPaletteOpenAtom);
  const runCommand = useVSCodeCommand();

  // Keyboard shortcut for command palette
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setCommandPaletteOpen]);

  const commandGroups: CommandGroup[] = [
    {
      heading: 'Navigation',
      items: navItems.map((item) => ({
        id: `nav-${item.id}`,
        label: item.label,
        icon: item.icon,
        onSelect: () => setActivePage(item.id),
      })),
    },
    {
      heading: 'Actions',
      items: [
        {
          id: 'generate-workspace',
          label: 'Generate Workspace Docs',
          onSelect: () => runCommand('docdocs.generateWorkspace'),
        },
        {
          id: 'check-freshness',
          label: 'Check Freshness',
          onSelect: () => runCommand('docdocs.checkFreshness'),
        },
        {
          id: 'toggle-watch',
          label: 'Toggle Watch Mode',
          onSelect: () => runCommand('docdocs.toggleWatch'),
        },
      ],
    },
  ];

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar Navigation */}
      <aside className="flex w-48 flex-col border-r border-border bg-sidebar">
        <div className="flex h-12 items-center gap-2 border-b border-sidebar-border px-3">
          <span className="text-lg font-semibold text-sidebar-foreground">
            DocDocs
          </span>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => (
            <Button
              key={item.id}
              variant={activePage === item.id ? 'secondary' : 'ghost'}
              className={cn(
                'w-full justify-start gap-2',
                activePage === item.id && 'bg-list-active text-list-active-foreground'
              )}
              onClick={() => setActivePage(item.id)}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Button>
          ))}
        </nav>

        <Separator />

        <div className="p-2">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2"
            onClick={() => setCommandPaletteOpen(true)}
          >
            <Command className="h-4 w-4" />
            <span className="flex-1 text-left">Commands</span>
            <kbd className="text-xs text-muted-foreground">⌘K</kbd>
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-6">{children}</div>
        </ScrollArea>
      </main>

      {/* Command Palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        groups={commandGroups}
      />
    </div>
  );
}

export { DashboardLayout };
