/**
 * Shared hooks barrel export
 */

export {
  useVSCodeMessaging,
  useVSCodeCommand,
  useOpenFile,
  useSaveConfig,
  usePostMessage,
} from './useVSCodeAPI';

export {
  useFreshness,
  useFreshnessStats,
  useFreshnessHistory,
  useFilteredFreshness,
  useFreshnessForFile,
  useFilesByStatus,
  useStaleCount,
  useFreshnessHealth,
} from './useFreshness';

export {
  useCoverage,
  useCoveragePercent,
  useLowCoverageFiles,
  useCoverageByModule,
  useCoverageStats,
  useCoverageHealth,
} from './useCoverage';

export {
  useThemeClass,
  useTheme,
  useIsDarkTheme,
} from './useTheme';
