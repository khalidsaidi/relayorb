import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    // Local bot-host volumes can be root-owned and cause EACCES during glob traversal.
    // They are runtime state, not source.
    'deploy/bot-host/finnews-postgres/**',
    'deploy/bot-host/stockpulse-data/**',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    rules: {
      // This codebase integrates multiple third-party APIs with loose/variable JSON shapes.
      // Prefer `unknown` at boundaries, but allow `any` pragmatically where the cost of
      // perfectly typing vendor payloads outweighs the value.
      '@typescript-eslint/no-explicit-any': 'off',
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
])
