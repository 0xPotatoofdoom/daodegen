import nextConfig from 'eslint-config-next'

const [coreWebVitalsConfig, typescriptConfig, ignores] = nextConfig

const customCoreConfig = {
  ...coreWebVitalsConfig,
  rules: {
    ...coreWebVitalsConfig.rules,
    'react/no-unescaped-entities': 'off',
    'react-hooks/set-state-in-effect': 'off',
    'react-hooks/exhaustive-deps': 'off',
    '@next/next/no-img-element': 'off',
    'import/no-anonymous-default-export': 'off',
  },
}

export default [
  { ignores: ['coverage/**', 'playwright-report/**', 'test-results/**'] },
  customCoreConfig,
  typescriptConfig,
  ignores,
]
