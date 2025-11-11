// @ts-check
import antfu from '@antfu/eslint-config'

export default antfu(
  {
    type: 'lib',
    pnpm: true,
    markdown: false, // 禁用 markdown 文件的 lint 检查
  },
)
