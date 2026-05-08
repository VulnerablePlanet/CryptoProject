import js from '@eslint/js'
import vuePlugin from 'eslint-plugin-vue'

export default [
  js.configs.recommended,
  ...vuePlugin.configs['flat/essential'],
  {
    files: ['src/**/*.{js,vue}', 'server/**/*.js'],
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'warn',
      'no-debugger': 'error',
      'vue/multi-word-component-names': 'off',
    },
  },
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**'],
  },
]
