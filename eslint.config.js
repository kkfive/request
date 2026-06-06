// @ts-check
import antfu from '@antfu/eslint-config'

export default antfu(
  {
    type: 'lib',
    pnpm: true,
    markdown: false, // 禁用 markdown 文件的 lint 检查
  },
  {
    ignores: [
      'README.md',
      'CLAUDE.md',
      '**/docs',
    ],
    rules: {
      'pnpm/yaml-enforce-settings': 'off',
    },
  },
  {
    files: ['examples/**/*.ts'],
    rules: {
      'no-console': 'off', // 示例文件需要 console 演示输出
    },
  },
)
