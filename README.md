## 介绍

这是个人自用的二次请求封装，主要用于应对个人在项目中的前端请求场景。

该请求库基于[ky](https://github.com/sindresorhus/ky)进行二次封装，但同时依赖于如下依赖：
- [es-toolkit](https://github.com/toss/es-toolkit)
- [qs](https://github.com/ljharb/qs)

## 功能示例

本库只是基于ky做了一层简单而封装，添加了几个内置的拦截器方法。因为我个人认为请求库就应该回归最原始的功能——发送请求，获取结果。
例如一些高级功能：缓存、自动请求、请求静态等功能，我认为应该交由上层框架或自行来实现。例如[tanstack-query]()https://tanstack.com/

## License

[MIT](./LICENSE) License © [DreamyTZK](https://github.com/kkfive)
