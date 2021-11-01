---
title: 从头弄一个博客
slug: custom-blog-from-scratch
date: 2021-11-01
abstract: 不用 NextJS, Gatsby 或者 Docusaurus, 从头自建静态博客。
---

由于上网课的要求我不得不把原来的个人 GitHub Page 改成了课程的页面，变成了下面的文件目录结构：

```
.
├── 1342wefs.html
├── gg.html
├── gk.html
├── gk.js
├── hw3
...
│   ├── index.html
│   └── page2.html
├── hw3.zip
└── imgs
    └── Lark20210926-215737.jpg
```

原来 host 在上面的博客静态内容只能废弃。正好现在趁着有机会，把博客进行了重构，效果正如你看到的样子：[https://blog.chenyu.pw/](https://blog.chenyu.pw/)

源码欢迎指摘：[https://github.com/hanayashiki/blog](https://github.com/hanayashiki/blog)

本着不折腾不罢休的态度，本人给自己提出四点需求：

1. 用 Markdown 直接写博客（因此需要编译）。
2. 静态网站，不需要自建服务器。
3. 打开要快，因此需要预渲染。
4. 编译要方便，编译速度要快，但不用现有的工具（为了折腾）。

Web 开发，最终归根结底处理三件事情：

1. HTML
2. CSS
3. JS
   
为了开发方便，我打算用 Preact 来对页面进行预渲染，用 TailwindCSS 生成 CSS，然后用 esbuild 打包生成 JS。这样可以用熟悉的类 React 的 JS 中心的开发方式。

整个流程如下：

1. 使用 gray-matter 提取博客目录下的元数据，markdown-it 对 Markdown 文档进行编译。
2. esbuild 对各个页面的脚本进行编译，编译成 `index-[hash].mjs` 和 `index-[hash].css`。
3. 有了博客的内容，我们使用 preact 对主页和博客页面进行渲染（preact-render-to-string）。
4. 将渲染的 HTML 内容插入 HTML 模板中，同时带上需要的 JS 和 CSS 的连接。此处应该插入 Hydrate 的代码（未完工，因为页面暂无交互需求），导出 HTML 页面。

这也是一个低配版的 NextJS 框架，只是为本项目“量身打造”。

体验：
1. esbuild 和 tailwindcss 的性能很不错，开发几乎没有卡顿，但是 esbuild 对 postcss 支持不佳，在使用 postcss 插件后没有办法根据 css 的调整进行刷新。
2. preact 可以极大减小 JS 体积，现在主页面的 JS 仅 12kb (minified)。如果只需要简单的交互，可以尝试用 preact 替换 react。

简单的流程让 Lighthouse 接近满分：https://googlechrome.github.io/lighthouse/viewer/?gist=48c80eac039dcf9887b19bb9006e7796
（哎呀，以前的服务端渲染的网站不也是差不多的方法吗？）