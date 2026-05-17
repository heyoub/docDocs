import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['test/**/*.test.ts'],
        exclude: ['test/e2e/**', 'node_modules/**'],
        setupFiles: ['./test/__mocks__/setup.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html', 'lcov'],
            include: [
                'src/utils/**/*.ts',
                'src/state/config.ts',
                'src/state/configSchema.ts',
                'src/state/freshness.ts',
                'src/core/schema/**/*.ts',
                'src/core/renderer/**/*.ts',
                'src/core/changelog/**/*.ts',
                'src/core/pipeline/buildModuleSchema.ts',
                'src/core/pipeline/indexGeneratedSchema.ts',
                'src/core/ml/enhanceSchema.ts',
                'src/core/ml/openRouterRateLimit.ts',
                'src/core/ml/openRouterModels.ts',
                'src/core/ml/smoother.ts',
                'src/core/extractor/treeSitterPaths.ts',
                'src/extension/watchController.ts',
                'src/extension/watchPaths.ts',
            ],
            exclude: [
                'src/**/*.d.ts',
            ],
            thresholds: {
                lines: 70,
                branches: 60,
                functions: 60,
                statements: 70,
            },
        },
        testTimeout: 10000,
        hookTimeout: 10000,
    },
    resolve: {
        alias: {
            vscode: path.resolve(rootDir, 'test/__mocks__/vscode.ts'),
        },
    },
});
