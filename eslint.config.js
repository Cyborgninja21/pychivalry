// ESLint for every TypeScript package of the workspace, type-aware, warnings as errors
// (`task lint` runs it with --max-warnings=0).
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
    {
        ignores: [
            'legacy/**',
            '**/dist/**',
            '**/node_modules/**',
            'spec/**',
            'records/**',
            '.vscode-test/**',
            '.wiki-build/**',
        ],
    },
    {
        files: ['**/*.ts'],
        extends: [js.configs.recommended, tseslint.configs.strictTypeChecked],
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            // node:test's test() and suite() return promises the runner itself awaits.
            '@typescript-eslint/no-floating-promises': [
                'error',
                {
                    allowForKnownSafeCalls: [
                        {
                            from: 'package',
                            package: 'node:test',
                            name: ['test', 'suite', 'describe', 'it'],
                        },
                    ],
                },
            ],
        },
    },
    {
        files: ['**/*.js'],
        extends: [js.configs.recommended],
    },
);
