---
title: 谈 Deno Fresh 工具链开发体验
slug: deno-dx
date: 2022-07-31
abstract: 如果全部都用 Deno 的工具，写网站是什么样子？
---

## 什么是 Deno？什么是 Fresh？

[Deno](https://deno.com) 是 Node 作者 Ryan Dahl 提出的替代 JavaScript 运行时。Deno 不仅是一个 JS 运行时，还包含了零配置 TypeScript 转译、包管理、formatting 等功能。和 Web/Node 工具链百花齐放的思路不同，Deno 追求一个统一的开发者体验。需要注意的是， Deno 不提供 CommonJS 和 Node API 等支持，而是自己实现了一套贴近 Web 标准的模块和 API 系统，因此已有的 Node 项目将很难和 Deno 兼容。

[Fresh](https://fresh.deno.dev/docs/introduction) 是一个全栈 Deno 网站框架。它基于 Preact，主打服务端渲染并且支持[客户端 Rehydration](https://fresh.deno.dev/docs/getting-started/adding-interactivity)。Fresh 和 NextJS 类似，也支持 Data Fetching, File System Routing 等功能。如果有 NextJS 的经验，几乎都可以轻松迁移到 Fresh。

## 技术栈选择

为了给新项目一个做一个简单的官网，我拿 Deno/Fresh 的技术栈试验了一下。以下是用到的技术清单：

1. JS 运行时：Deno
2. Web 框架：Fresh
3. CSS 框架：[Twind](https://twind.dev/)
4. 编程语言：TypeScript
5. VS Code 插件：
   1. denoland.vscode-deno
   2. sastan.twind-intellisense 
6. 部署：Deno Deploy (free)

接下来谈谈这些工具和体验和现有工具的异同。

## 开发体验

### Deno

Deno 作为一个开发工具，最主要的区别就是改善了作者 Ryan Dahl 的[关于 Node 最后悔的 10 件事](https://medium.com/@imior/10-things-i-regret-about-node-js-ryan-dahl-2ba71ff6b4dc)。那么我们可以按照这10个点去谈谈，Deno 有没有真正改善 Node 的问题呢？

> 1. Not sticking with Promises
> He added promises to Node in June 2009 but removed them in February 2010 for minimal. It’s possible unified usage of promise in Node would have sped the delivery of the standardization and async/await.

这个感受不到。V8 早已经原生支持 `Promise/async/await` 了，也支持 `async` 栈调用的 debugging。现在 `Promise` 已经在 Node 中如同空气一样自然了。

> 2. Security
> Node program can access all the system calls, such as writing to the disk, accessing to the network.

在 Deno 中，进程不能直接使用系统的权限：你需要 `--allow-env` 来允许它读取环境变量，需要 `--allow-run` 来允许它执行其他进程，等等。这些特性初看当然是好的：假如你在 Node 中随手执行了 `npx blah`，然后被一段网络上下载下来的脚本清空了硬盘，该有多麻烦？当然，当我们不去随便下载安装包，这些恶意代码的问题大多不会发生。这些特性有很多好处，例如允许了以 Deno 脚本为单位进行部署的 Serverless 架构 —— 应用隔离可以不再需要 VM、甚至不需要 Docker，在进程一级即可保证资源隔离的安全性。当然，这些安全特性通常本地开发中用不到，但是它确实很具有 Serverless 化的前瞻性。

> 3. The Build System
> 主要是 Node 难以和 C 代码进行通讯，进行了多重封装，从而代价很大。  

我还没写过 Node 和 C 通讯的代码，不好评价。

> 4. package.json
> 5. node_modules

Node 的包管理部分存在许多缺点，比如 `package.json` 过于高大全，写起来也很麻烦。`node_modules` 过于死板而笨重。大多数时候 Node 应用部署的开销也全在包管理这里。一个简单的项目，需要下载太多东西，消耗硬盘并且十分费时。

当然这两者提供的好处也是显而易见的。例如在应用中，只需要一个 `require("react")` 就可以引入 React。至于 `react` 指的是哪个版本，从哪个源下载的，这个任务交给了 `package.json`，最终落实到 `node_modules` 中。

没有了 `package.json` 和 `node_modules`，Deno 如何管理依赖呢？下面是 `import React from 'react'` 在 Deno 中的写法：

```ts
import React from "https://jspm.dev/react@17.0.2";
```

这里它的写法和 ES Module 是完全相同的。你需要指定这个包从哪个 URL 下载下来，然后才能用。如果每次打开应用都要下载就太麻烦了，因此 Deno 会自动将已经下载的包缓存到全局目录下。由于舍弃了 Node Resolution Algorithm，以及许多工具链已经集成在 Deno 内部，Deno 的包管理轻量许多。

实际上，Deno 也通过 [Import Map](https://deno.land/manual/linking_to_external_code/import_maps) 支持了 `import React from 'react'` 这样的写法。我认为这种写法比官方推荐的 `deps.ts` 要好用。

由于自动转译 TS 的特性， Deno 也可以直接发布 TS 的包。这样对于包的作者和使用者，都省却了很多精力。对于作者，自然不需要再转译才能发布了。对于使用者而言，可以直接查看 TypeScript 的源代码，便于理解和 debugging，减少对文档的依赖。

> 6. Require without the extension
> 7. index.js

是的，没有必要省略那个后缀名或者 `index.js / index.ts`。如果不允许省略的话，每个模块到底依赖哪个路径的文件将会是唯一确定的，而与具体的文件结构无关。

以上主要都是对 Deno 的正面评价。理想是美好的，但是现实中 Deno 推进必然会遇到重重阻碍。就我使用 Deno 而言，有以下不便的地方：

1. 不支持 Node API，因此不支持 NPM 依赖。这直接导致写 Deno 的包运用思路和写 Node 完全不同，许多东西你得手写，老的 Node 库要么等官方宣布支持 Deno，要么只能寻求替代品。
2. Deno Language Service 有问题。根据我的猜测，Deno 的 LSP 应该是魔改了 VS Code 的 TypeScript LSP。大多数情况下问题不是很多，但是就我本人而言遇到了以下问题：
   1. Renaming Symbol 无法进行。
   2. 修改 `/** @jsx h */` 的时候因为输入不符合语法，导致抛出插件异常。正常应该在代码附近提示错误信息。
   3. 键入一个明显是依赖包中的 identifier 的时候不会弹出自动 import 的提示。需要输入完整的 identifier 才会弹出。自动 import 默认用的是相对路径或者完整 URL，而不是 import map 的信息。
   4. `deno.json` 或者 `import_map.json` 发生变化时有时不会自动反应。
   5. 总之，如果你选择了新生的 Deno，就要做好它的周边有很多 bug 的准备。 
3. 本地权限管理无卵用，不用 `-A` (允许所有权限) 什么也做不了。
   
### Fresh

> Fresh 的[官网](https://fresh.deno.dev/)做的非常可爱！
> ——我自己说的
  
1. 文档：2/5 分。

学习一个新的 Web 框架，首先要看它的文档。Fresh 的文档可以说写的非常春秋笔法。从学习者的角度来看，显然是不够详细的。例如 Island 的介绍，对于这一重要新概念，只有寥寥一页的篇幅。Island 为什么要引入，Island 的原理是什么，一概不讲。对于一些高级的配置，例如 `_app.ts`，都是在 issues 里找到的，完全没有文档。可见 Fresh 的文档目前还处于十分不完善的状态。

2. 功能：3/5 分。Fresh 的功能目前来看十分受限。我们可以和 NextJS 对比一下：
    1. Data Fetching。两者同时支持实时数据获取（`handler` 和 `getServerSideProps`）。 NextJS 支持 `getStaticProps` 和 `getStaticPaths`，允许在构建阶段获取静态的数据，然而 Fresh 没有构建阶段。自然，Fresh 也就无法根据静态的数据构建网站。
    2. Built-in CSS Support。NextJS 原生支持 `Postcss`，自然也就支持轻松引入 `Tailwind CSS` 和其他 CSS 框架。而 Fresh，对于 CSS 引入，官网没有任何描述（？？）。在 Issues 中看到可以通过自行配置 `_app.ts` 手动在 `<head>` 中引入没有原始的 CSS。
    3. Layout。两者都支持全局 Layout。
    4. Image Optimization。NextJS 提供了大量支持，Fresh 对图片无特别支持，但是可以通过 `asset("image.jpg"` 提供缓存 header。
    5. Fast Refresh：NextJS 支持基于 React Refresh 的快速刷新，Fresh 只能自动重新加载。
    6. Routing：NextJS 支持在 APP 内部切换页面，Fresh 每个页面都是独立的，切换页面需要重新加载。

总的来说，Fresh 的手感更像 JS 框架泛滥之前的 Web 时代 —— 服务器渲染、切换页面需要整体刷新、默认不提供 Rehydration。可以说是历史的循环？

Fresh 的 Island 也是与众不同的。在 Fresh 中，基本的思路和 NextJS 不一样：Fresh 的 Component 默认只提供静态的 HTML，没有交互性和状态，也不需要 JS；被称为 Island 的 Component 是可交互、有状态的。NextJS 则追求 SSR 的页面操作起来和 CSR 无异，因此进行了整个页面的渲染。

Island 存在诸多限制，例如 Island 的 props 必须是 JSON Serializable 的，因此不支持传入复杂对象和函数，也不可以传入 `children`。别想着可以 `<Button onClick={onClick} />`。[Island 内部甚至不能使用其他的 Island。](https://github.com/denoland/fresh/discussions/326)这毫无疑问为构建大型可交互应用造成了很大的困扰。

我认为就目前而言，Fresh 是不可能替代 NextJS 的（即使是 Deno 意义下的 NextJS）。它的诸多限制都偏离了目前写 Web App 的基本思路。如果想尝试 Fresh，我认为主体静态的只读页面还是可以一试的。

3. Twind
  
Twind 是一个支持类 TailwindCSS 语法的 CSS-in-JS 的框架。Twind 支持在客户端实时编译 CSS 类，当然也支持在服务端编译，再在客户端 rehydrate。它的写法和 TailwindCSS 有一点点不同：

```tsx
<div
  class={tw`
    p-[10px] text-white text-center cursor-pointer
    ${severity === "success" && "bg-primary-focused"}
    ${severity === "error" && "bg-error"}
  `}
>
  {message}
</div>
```

对比 Tailwind 的 `className="p-[10px] ..."`，Twind 要额外输入一些字符，可能会比较麻烦。我个人用了 VS Code 的 Snippet 来方便自动生成 `class={tw``}` 这个 boilerplate。 

Twind 有靠谱的 VS Code 插件提供代码提示和检查错误，大多数情况下没什么问题。就我个人而言遇到了下面两个 Issue：

1. 自定义的 css 对下划线 `_` 的处理不对，没有像 Tailwind 一样转换成空格，需要自己想办法 workaround。 https://github.com/tw-in-js/twind/issues/345
2. 插件无法探测它说的 `config/twind.config.ts`。需要移动到项目根部。 https://github.com/tw-in-js/vscode-twind-intellisense/issues/11

Twind 是 Fresh 在对 CSS 几乎零原生支持的情况下的一个很好的补足。在非 Fresh 项目下也可以尝试用一用。另外 Twind 由于支持动态字符串的处理，不像 Tailwind 依赖分析静态的字符串，也可以减少许多思考负担。

### TypeScript

Deno 和 Deno VS Code 插件对 TS 的支持已经可以达到现阶段的满分。VS Code 插件提供 TS 的代码提示和错误检查，Deno 则默认直接转译 TS 代码而跳过检查。除了上文提到的一些 bug 以外，我认为这才是写 TS 应该有的开发者体验 —— 不需要配置一行，不需要操心转译，运行速度够快。当然 TS Server 的性能是无法提上去的，项目大了肯定会有编辑器反应迟缓的问题。

### Deno Deploy

Deno Deploy 的体验我给满分！部署的速度非常的快，几乎刚 push 上去就部署好了。一个是因为 Deno 轻量化的包管理（上文提到），二个是一个 Deno 应用对应一个进程，因此不需要安装系统依赖，更不需要构建 Docker，只需要一个进程。

Deno 支持在多区域同时部署。例如有 ap-northeast 的用户访问了，它就会在 ap-northeast 起一个 Isolate 对象（速度为毫秒级），从而用户仿佛访问一个本来就部署在本地的网站。

![Speed](/2022-07-31-15-54-24.png)

以上是 Isolate 已经部署、且 Fresh 有缓存的情况下的 Response Time。只有 30ms！

Deno Deploy 同时也非常便宜。价格可以在官网看到：https://deno.com/deploy/docs/pricing-and-limits

对于我而言，Free Plan 目前已经够用。

> Request count 100k req/day, 1000 req/min 
> Memory 512 MB 
> CPU Time per request 10ms

Deno 的部署方式应该是轻量 Web 应用的未来。

## 总结

Deno 确实解决了很多 JavaScript、特别是 TypeScript 开发的痛点。但是就目前而言，不推荐在复杂应用中使用 Deno 和 Fresh，原因主要是生态不行、框架本身的功能也不够。如果选择的话，无异于摸着石头过河，要做好踩很多坑的准备。相比现有的 Node 为中心的开发流程，有它迟缓、重复等缺点，但是毕竟姜还是老的辣，生态已经发展起来了就不可能无缘无故消亡，但是个人推荐在娱乐性项目或者小型静态网页中尝试 Deno，在语言支持、包管理和部署上都有超越传统方法的体验。可以说是 Ryan Dahl 口中的 “Dream Stack”的雏形。
