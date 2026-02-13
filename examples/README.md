# Examples - 示例文件说明

本目录包含了 `@kkfive/request` 的各种使用示例，帮助你快速上手。

## 📁 示例文件列表

### 1. `01-basic-usage.ts` - 基础使用
展示最基本的 HTTP 请求方法：
- ✅ GET 请求
- ✅ POST 请求
- ✅ PUT 请求
- ✅ PATCH 请求
- ✅ DELETE 请求
- ✅ HEAD 请求
- ✅ OPTIONS 请求

**适合人群**：初次使用本库的开发者

**运行方式**：
```bash
npm run start:example -- examples/01-basic-usage.ts
```

---

### 2. `02-response-parser.ts` - 响应解析器
展示如何使用 `responseParser` 配置来自动解析和验证响应数据：
- ✅ `raw` 模式 - 返回原始 Response 对象
- ✅ `body` 模式 - 返回完整响应体
- ✅ `data` 模式 - 自动提取数据字段并验证业务状态
- ✅ 自定义数据提取函数
- ✅ 请求级别覆盖配置

**适合人群**：需要处理标准化 API 响应格式的开发者

**运行方式**：
```bash
npm run start:example -- examples/02-response-parser.ts
```

---

### 3. `03-error-handling.ts` - 错误处理
展示如何使用 `RequestError` 类的各种辅助方法来处理不同类型的错误：
- ✅ 使用 `RequestError` 的辅助方法
- ✅ 区分业务错误和网络错误
- ✅ 根据错误类型采取不同的处理策略
- ✅ 自定义错误处理回调
- ✅ 错误重试策略

**适合人群**：需要完善错误处理逻辑的开发者

**运行方式**：
```bash
npm run start:example -- examples/03-error-handling.ts
```

---

### 4. `04-advanced-features.ts` - 高级特性
展示 Request 类的高级特性：
- ✅ 使用静态方法 `create()` 创建实例
- ✅ 使用 `extend()` 创建派生实例
- ✅ 使用 Hooks（beforeRequest、afterResponse）
- ✅ 参数序列化（brackets、comma、indices、repeat）
- ✅ 超时配置
- ✅ 组合使用多个特性

**适合人群**：需要深度定制请求行为的开发者

**运行方式**：
```bash
npm run start:example -- examples/04-advanced-features.ts
```

---

### 5. `index.ts` - 综合示例
展示完整的请求流程，包括：
- ✅ 完整的 Request 实例配置
- ✅ 响应解析器配置
- ✅ 错误处理回调
- ✅ Hooks 使用
- ✅ 不同场景的请求处理

**适合人群**：想要快速了解完整功能的开发者

**运行方式**：
```bash
npm run start:example
```

---

## 🚀 运行示例

### 前置要求

1. 安装依赖：
```bash
pnpm install
```

2. 构建项目（如果需要）：
```bash
pnpm build
```

### 运行单个示例

```bash
# 运行基础使用示例
npm run start:example -- examples/01-basic-usage.ts

# 运行响应解析器示例
npm run start:example -- examples/02-response-parser.ts

# 运行错误处理示例
npm run start:example -- examples/03-error-handling.ts

# 运行高级特性示例
npm run start:example -- examples/04-advanced-features.ts

# 运行综合示例
npm run start:example
```

---

## 📝 注意事项

### API 端点说明

示例中使用了不同的 API 端点：

1. **JSONPlaceholder**（公共测试 API）
   - URL: `https://jsonplaceholder.typicode.com`
   - 用于：基础使用示例、高级特性示例
   - 无需配置，可直接使用

2. **Apifox Mock API**（需要本地启动）
   - URL: `http://127.0.0.1:4523/m1/3188536-1836903-default`
   - 用于：响应解析器示例、错误处理示例、综合示例
   - API 文档: https://zet8c558g2.apifox.cn/
   - 需要先启动 Mock 服务才能运行

### 修改 API 端点

如果你想使用自己的 API，只需修改示例文件中的 `prefixUrl` 配置：

```typescript
const request = new Request({
  prefixUrl: 'https://your-api.com', // 修改为你的 API 地址
  // ... 其他配置
})
```

---

## 💡 学习路径建议

如果你是第一次使用本库，建议按以下顺序学习：

1. **01-basic-usage.ts** - 了解基本的 HTTP 请求方法
2. **02-response-parser.ts** - 学习如何自动解析响应数据
3. **03-error-handling.ts** - 掌握错误处理的最佳实践
4. **04-advanced-features.ts** - 探索高级特性和定制化能力
5. **index.ts** - 查看完整的实际应用示例

---

## 🤝 贡献

如果你有更好的示例想法，欢迎提交 PR！

---

## 📚 相关文档

- [项目 README](../README.md)
- [API 文档](../docs/api.md)（如果有）
- [更新日志](../CHANGELOG.md)（如果有）
