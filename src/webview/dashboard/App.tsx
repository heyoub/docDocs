import { useAtomValue } from 'jotai';
import { useVSCodeMessaging, useThemeClass } from '../shared/hooks';
import { DashboardLayout } from '../shared/components/templates/DashboardLayout';
import { TooltipProvider } from '../shared/components/atoms/Tooltip';
import { activePageAtom } from '../shared/store';
import OverviewPage from './pages/OverviewPage';
import CoveragePage from './pages/CoveragePage';
import FreshnessPage from './pages/FreshnessPage';
import ChangelogPage from './pages/ChangelogPage';
import SettingsPage from './pages/SettingsPage';

function PageRouter() {
  const activePage = useAtomValue(activePageAtom);

  switch (activePage) {
    case 'overview':
      return <OverviewPage />;
    case 'coverage':
      return <CoveragePage />;
    case 'freshness':
      return <FreshnessPage />;
    case 'changelog':
      return <ChangelogPage />;
    case 'settings':
      return <SettingsPage />;
    default:
      return <OverviewPage />;
  }
}

export default function App() {
  // Initialize VS Code messaging and theme
  useVSCodeMessaging();
  useThemeClass();

  return (
    <TooltipProvider>
      <DashboardLayout>
        <PageRouter />
      </DashboardLayout>
    </TooltipProvider>
  );
}
