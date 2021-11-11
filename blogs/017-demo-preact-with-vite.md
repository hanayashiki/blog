---
title: 用 Vite 调试 Preact 源码
slug: demo-preact-with-vite
date: 2021-11-11
abstract: 利用 Vite Dev Server 基于 ESM 的机制方便调试源码
---

众所周知，读 React 源码是前端内卷的重要表现之一。出于对 react-dom 40Kb 压缩后体积的畏惧，通过读 [Preact](https://preactjs.org) 大致了解 React 的机制也不失为办法之一。Preact 的代码直接阅读有难度，不如 get hands dirty，把它在浏览器里面运行起来。

为什么要用 Vite ？ Vite 对用户代码默认不进行打包，而是直接经过简单的 import 重命名后加载到浏览器里。因此在浏览器中我们可以看到**未打包的源代码**和文件结构，配合调试工具显示变量的当前值等特性，可以非常方便地调试源码。

如果直接通过常用的开发工具运行 npm/unpkg 上下载的 preact，大抵只能拿到压缩后的 JS 代码，所以不妨先把 Preact 的源码下载下来：

```
git clone https://github.com/preactjs/preact.git
cd preact
npm i
```

接着我们在 `~/preact-fixture` 创建一个 Vite 项目：

```json
// package.json
{
  "license": "MIT",
  "scripts": {
    "dev": "vite"
  },
  "dependencies": {
    "preact": "^10.5.15",
    "vite": "^2.6.14"
  }
}
```

```js
// vite.config.ts
import { defineConfig } from 'vite'

export default defineConfig({
  root: 'src',
  esbuild: {
    jsxFactory: "h",
    jsxFragment: "Fragment",
  },
  resolve: {
    alias: {
      preact: '<path/to/where/you/cloned/preact>/src/index.js',
    },
  },
});
```

```html
<!-- src/index.html -->
<html>
  <head>
  </head>

  <body>
    <script src="./index" type="module"></script>
  </body>
</html>
```

```js
// src/index.jsx
import { render, h, Fragment } from 'preact';

render((
  <div>
    fuck
  </div>
), document.body);
```

以上就简单搭建了 preact 的运行舞台。注意，在 `vite.config.ts` 中，我们将 `preact` 解析到其源码的入口处。这样，`vite` 会将其视为用户代码的一部分，可以方便地观察改变和编译，而且不会被打包！

打开 `http://localhost:3000`，如果不出错，应该正常显示由 preact 在 index.jsx 渲染的网页。

![](/2021-11-11-14-10-11.png)

打开 Devtools -> Sources，我们可以看到我们的代码和 preact 的目录结构：

<img src="/2021-11-11-14-14-33.png" height=400>

在 `render` 函数中设置断点，就可以直接调试 `preact` 的源码了！

![](/2021-11-11-14-15-43.png)
