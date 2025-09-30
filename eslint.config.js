// ESLint flat config using antfu's preset
// See: https://github.com/antfu/eslint-config
import antfu from '@antfu/eslint-config'

export default antfu({
  typescript: {
    tsconfigPath: 'tsconfig.json',
  },
  ignores: [
    'vitest.config.ts',
  ],
})
