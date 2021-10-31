---
title: Vite Dev Server 优化源码解析
slug: vite-dev-server-optimization-analysis
date: 2021-06-20
abstract: 分析 Vite 如何优化 node_modules 的加载问题。
---

[Vite](https://vitejs.dev) 在官网中提到了 [Dependency Prebulding](https://vitejs.dev/guide/dep-pre-bundling.html) 来加速开发的体验。所谓 Dependency Prebundling，就是 Vite 处理 `node_modules` 中的依赖的特殊办法。其特色包括：

    1. CommonJS and UMD compatibility

    2. Performance: Vite converts ESM dependencies with many internal modules into a single module to improve subsequent page load performance.

预告：本文将主要研究第二个。对 CommonJS 转换感兴趣的朋友可以及时退出。

**第一个是兼容 CommonJS 的 module —— 太多 npm package 发布时是 CommonJS 的格式。**

如果你不知道什么是 CommonJS， 它是一种使用 `require()` 和 `module.exports` 等 JS “运行时扩展” 来模块化 JS 代码的方式。CommonJS 本身并不是 JS 标准的一部分。

而 Vite 主要支持的 JS 模块形式是 ECMA Modules（简称 ESM 或者 esmodule），它是 ECMAScript 6 标准的[一部分](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Guide/Modules)。 

**第二个是打包 ESM 的功能。**

当你 `node_modules` 中包含成百个 modules，它们互相引用，在浏览器中会造成 import 瀑布。也就是，一个模块 import 另外一个模块，然后这个模块又接着引入另外一个模块。每次一个 `import` 背后都是一个 HTTP 的开销，由于浏览器会限制打开的 socket 数量，所以这时即使是单机开发也会令网页打开陷入卡顿！所以，Vite 引入了提前打包的功能。根据官网的说法：

    Vite converts ESM dependencies with many internal modules into a single module to improve subsequent page load performance.

本文将主要探讨该功能是怎么样实现的。

在解析源码之前我们，我们可以预知到几个问题：

1. Vite 的官方文档没有说清楚，Vite 究竟是把多个 Dependency 打包成一个 bundle，还是每个 Dependency 打包成一个 bundle。也就是，Prebundling 到底是打包成多个 bundle 还是一个 bundle？

2. Vite 如何获取这些依赖的？又是如何管理缓存的？

3. Vite 如何避免重复打包？假如 Module A 和 Module B 都依赖 Module C，Module C 会不会被打包两次？

## 问题 1：Prebundling 和 Dependency 的对应关系。

第一个问题我们可以简单在浏览器中看一下究竟发生了什么。

我们简单运行 Vite 官方的 React Example (https://github.com/vitejs/vite/blob/5bf050948def6d9f490d413ee3bdec734e475f81/packages/playground/react/App.jsx)：

它的依赖有

```ts
  import React from 'react'
  import ReactDOM from 'react-dom'
```

很简单的两个依赖。我们来看看浏览器发送了哪些请求：

![](https://i.imgur.com/k1J9NJ8.png)

注意倒数第三行和倒数第四行的请求，Vite 确实是针对 `react` 和 `react-dom` 分别打包了一个 bundle。也就是一个引入 dependency，就引入一个 bundle。而 `react` 的 [dependency](https://www.npmjs.com/package/react) `loose-envify` 和 `object-assign` 并不在请求列表中，说明它们很可能被打包到 `react` 里面了。

## 问题 2：依赖如何获取？

### I. 快速入门 Dev Server 源码

在这里我们首先要进入 Vite 的源码。本文探讨的 Commit 是 [6e3653f](https://github.com/vitejs/vite/tree/6e3653fe62bc381deb86d28921e1ae7375456d0b)，有兴趣深入阅读的朋友应该把 Repo 克隆下来，试运行，并用 VSCode 的定义跳转功能方便阅读。

在 `packages/vite` 下面是 vite 的主程序。分成两个文件夹：

```
.
├── client
│   ├── client.ts
│   ├── env.ts
│   ├── overlay.ts
│   └── tsconfig.json
└── node
    ├── __tests__
    ├── optimizer
    ├── plugins
    ├── server
    ├── ssr
    ├── build.ts
    ├── cli.ts
    ├── config.ts
    ├── constants.ts
    ├── importGlob.ts
    ├── index.ts
    ├── logger.ts
    ├── plugin.ts
    ├── preview.ts
    ├── tsconfig.json
    └── utils.ts
```

其中我们主要部分应该在 `node` 下，接下来的路径皆为相对于该文件夹而言。[server/index.ts](https://github.com/vitejs/vite/blob/b1598cec7ee185f796d8679f0a97d36b80fe1949/packages/vite/src/node/server/index.ts) 是定义 `createServer` 的地方，它返回一个 `ViteDevServer`，也就是 Dev 服务器的入口处。

我们跳到这个文件的末尾，找到 `Prebundling` 相关的地方：

```ts
  if (!middlewareMode && httpServer) {
    // overwrite listen to run optimizer before server start
    const listen = httpServer.listen.bind(httpServer)
    httpServer.listen = (async (port: number, ...args: any[]) => {
      try {
        console.log('here'); // 我加的
        await container.buildStart({})
        await runOptimize()
      } catch (e) {
        httpServer.emit('error', e)
        return
      }
      return listen(port, ...args)
    }) as any

    httpServer.once('listening', () => {
      // update actual port since this may be different from initial value
      serverConfig.port = (httpServer.address() as AddressInfo).port
    })
  } else {
    await container.buildStart({})
    await runOptimize()
  }
```

启动 Vite，开始时，我们打印了 `here`，然后打印了 optimizing 的信息：

```
$ vite --force
here
Pre-bundling dependencies:
  react
  react-dom
(this will be run only when your dependencies or config have changed)
```

这说明 Vite Dev Server 在 `listen` 时是先运行 `container.buildStart({})` 再运行 `runOptimize()`。

其中 `container.buildStart` 的作用是调用所有插件运行 `buildStart` 钩子的函数。各位有兴趣给 Vite 写插件的读者可以注意一下。

接下来我们进入 `optimizeDeps` 内部一探究竟。

### II. Prebundling Cache 管理

```ts
export async function optimizeDeps(
  config: ResolvedConfig,
  force = config.server.force,
  asCommand = false,
  newDeps?: Record<string, string> // missing imports encountered after server has started
): Promise<DepOptimizationMetadata | null> {
  config = {
    ...config,
    command: 'build'
  }

  const { root, logger, cacheDir } = config
  const log = asCommand ? logger.info : debug

  if (!cacheDir) {
    log(`No cache directory. Skipping.`)
    return null
  }

  const dataPath = path.join(cacheDir, '_metadata.json')
  const mainHash = getDepHash(root, config)
  const data: DepOptimizationMetadata = {
    hash: mainHash,
    browserHash: mainHash,
    optimized: {}
  }

  if (!force) {
    let prevData
    try {
      prevData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
    } catch (e) {}
    // hash is consistent, no need to re-bundle
    if (prevData && prevData.hash === data.hash) {
      log('Hash is consistent. Skipping. Use --force to override.')
      return prevData
    }
  }

  if (fs.existsSync(cacheDir)) {
    emptyDir(cacheDir)
  } else {
    fs.mkdirSync(cacheDir, { recursive: true })
  }
  // ...
}
```

开头部分中，Vite 找 `cacheDir` —— 这是 Vite 定义的存放优化缓存的地方。它会去读取 `<cacheDir>/_metadata.json`到变量 `prevData`，得到其 `hash`，然后和由 `getDepHash` 的 `hash` 进行比较，知道依赖是否发生了变化。如果没有发生，就直接返回 `prevData`。

本项目下的 `_metadata.json` 内容如下：

```json
{
  "hash": "fbce7961",
  "browserHash": "29242d92",
  "optimized": {
    "react": {
      "file": "/Users/xxxx/vite/packages/playground/react/node_modules/.vite/react.js",
      "src": "/Users/xxxx/vite/node_modules/react/index.js",
      "needsInterop": true
    },
    "react-dom": {
      "file": "/Users/xxxx/vite/packages/playground/react/node_modules/.vite/react-dom.js",
      "src": "/Users/xxxx/vite/node_modules/react-dom/index.js",
      "needsInterop": true
    }
  }
}
```

我们可以猜测，对于 `optimized` 每个一对 key-value，key 是依赖的名称， value 是 prebundling 的信息。value 中，`file` 是 bundle 的路径，`src` 是 bundle 入口的路径（好比你单页应用的  `index.js`），`needsInterop` 是这个文件是否需要转换成 ESM。

这个 `hash` 是怎么计算的呢？我们来看看 `getDepHash` 如何实现的。

```jsx
const lockfileFormats = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml']

let cachedHash: string | undefined

function getDepHash(root: string, config: ResolvedConfig): string {
  if (cachedHash) {
    return cachedHash
  }
  let content = lookupFile(root, lockfileFormats) || ''
  // also take config into account
  // only a subset of config options that can affect dep optimization
  content += JSON.stringify(
    {
      mode: config.mode,
      root: config.root,
      resolve: config.resolve,
      assetsInclude: config.assetsInclude,
      plugins: config.plugins.map((p) => p.name),
      optimizeDeps: {
        include: config.optimizeDeps?.include,
        exclude: config.optimizeDeps?.exclude
      }
    },
    (_, value) => {
      if (typeof value === 'function' || value instanceof RegExp) {
        return value.toString()
      }
      return value
    }
  )
  return createHash('sha256').update(content).digest('hex').substr(0, 8)
}

```

可见，Vite 是首先找到项目中的 `yarn.lock` 或者其他包管理器的 `lock` 文件，以及 vite 自身的 config 来判定 Dependency 缓存是否失效的。而一旦失效，Vite 将重新生成所有 Bundle！当然我们知道，如果仅仅是 `yarn.lock` 变了，大多情况下只是部分 package 有增删，并不需要重新一个一个 bundle 它们。所以，这不是最高效的方法。

另外写插件的读者注意，对于插件，vite 只是用了 `plugins: config.plugins.map((p) => p.name)` 来处理插件的名字和顺序，所以如果你的插件代码更新了，它又会影响 dependency，在这时是不会起作用的，记得使用 `--force` 函数强制 Vite 重新编译 dependency。


### III: Vite 是如何知道有哪些依赖的？

接下来我们进入重头戏，看看 Vite 是如何知道我们的项目有哪些依赖的。

首先想想，如果我们来实现依赖扫描，会怎么样去做？

1. 我们可以读取 `package.json`，读取里面的 `dependencies`，然后解析到对应的 `node_modules` 中的入口文件，然后逐一打包。这样的优点是扫描过程简单，缺点也很明显：
   1. 我们并不是所有 `dependencies` 中列明的依赖都会拿来用。即使用的，也有可能只用其一个子集的代码。全部 bundle 的代价是我们不希望的。
   2. 即便没有放入 `package.json` 中，也有可能成为依赖。读者可以思考一下这种情况在何时会发生。
   
2. 我们首先知道了入口文件 `index.js`，那么就可以通过 Babel 等 parser 根据 `index.js` 构建一个依赖图， 然后，分别打包所有依赖中解析到 `node_modules` 中的入口文件。

Vite 选择的是第二种方法的魔改版。让我们接着刚才的部分继续分析 `optimizeDeps` 函数。

```ts
export async function optimizeDeps(
  config: ResolvedConfig,
  force = config.server.force,
  asCommand = false,
  newDeps?: Record<string, string> // missing imports encountered after server has started
): Promise<DepOptimizationMetadata | null> {
  // ...

  let deps: Record<string, string>, missing: Record<string, string>
  if (!newDeps) {
    ({ deps, missing } = await scanImports(config))
  } else {
    deps = newDeps
    missing = {}
  }

  // ...
```

这里，Vite 刚刚废弃掉之前的 cache，开始重新解析依赖。那么 `scanImports` 做了什么呢？

`scanImports` 定义在 [optimizer/scan.ts](https://github.com/vitejs/vite/blob/d36e10ed99fe765a5f25268bdf8252fe0b026701/packages/vite/src/node/optimizer/scan.ts) 中。它的作用是扫描所有入口文件的所有依赖模块。

这里我们把 `scanImports` 的相关代码贴出。

```ts
const debug = createDebugger('vite:deps')

const htmlTypesRE = /\.(html|vue|svelte)$/

// A simple regex to detect import sources. This is only used on
// <script lang="ts"> blocks in vue (setup only) or svelte files, since
// seemingly unused imports are dropped by esbuild when transpiling TS which
// prevents it from crawling further.
// We can't use es-module-lexer because it can't handle TS, and don't want to
// use Acorn because it's slow. Luckily this doesn't have to be bullet proof
// since even missed imports can be caught at runtime, and false positives will
// simply be ignored.
const importsRE =
  /\bimport(?!\s+type)(?:[\w*{}\n\r\t, ]+from\s*)?\s*("[^"]+"|'[^']+')/gm

export async function scanImports(config: ResolvedConfig): Promise<{
  deps: Record<string, string>
  missing: Record<string, string>
}> {
  const s = Date.now()

  let entries: string[] = []

  const explicitEntryPatterns = config.optimizeDeps?.entries
  const buildInput = config.build.rollupOptions?.input

  if (explicitEntryPatterns) {
    entries = await globEntries(explicitEntryPatterns, config)
  } else if (buildInput) {
    const resolvePath = (p: string) => path.resolve(config.root, p)
    if (typeof buildInput === 'string') {
      entries = [resolvePath(buildInput)]
    } else if (Array.isArray(buildInput)) {
      entries = buildInput.map(resolvePath)
    } else if (isObject(buildInput)) {
      entries = Object.values(buildInput).map(resolvePath)
    } else {
      throw new Error('invalid rollupOptions.input value.')
    }
  } else {
    entries = await globEntries('**/*.html', config)
  }

  // Non-supported entry file types and virtual files should not be scanned for
  // dependencies.
  entries = entries.filter(
    (entry) =>
      (JS_TYPES_RE.test(entry) || htmlTypesRE.test(entry)) &&
      fs.existsSync(entry)
  )

  if (!entries.length) {
    debug(`No entry HTML files detected`)
    return { deps: {}, missing: {} }
  } else {
    debug(`Crawling dependencies using entries:\n  ${entries.join('\n  ')}`)
  }

  const deps: Record<string, string> = {}
  const missing: Record<string, string> = {}
  const container = await createPluginContainer(config)
  const plugin = esbuildScanPlugin(config, container, deps, missing, entries)

  const { plugins = [], ...esbuildOptions } =
    config.optimizeDeps?.esbuildOptions ?? {}

  await Promise.all(
    entries.map((entry) =>
      build({
        write: false,
        entryPoints: [entry],
        bundle: true,
        format: 'esm',
        logLevel: 'error',
        plugins: [...plugins, plugin],
        ...esbuildOptions
      })
    )
  )

  debug(`Scan completed in ${Date.now() - s}ms:`, deps)

  return {
    deps,
    missing
  }
}
```

首先，Vite 根据 config 来确定所有的 `entries`，也就是入口文件。注意，Vite 默认是以 `*.html` 作为入口而非 `index.js`，它和 webpack 依靠 HTMLPlugin 生成 html 的思路不同，你的 html 就是你应用的入口。Vite resolve 入口的方式可以简单读明白。同时，在默认配置中，Vite fallback 到搜索 `**/*.html` 文件。这是你默认项目中 `index.html` 的发现方式。

接着我们进入神妙的 `deps` 扫描环节。

```ts
// Inside function scanImports() {}
  const deps: Record<string, string> = {}
  const missing: Record<string, string> = {}
  const container = await createPluginContainer(config)
  const plugin = esbuildScanPlugin(config, container, deps, missing, entries)

  const { plugins = [], ...esbuildOptions } =
    config.optimizeDeps?.esbuildOptions ?? {}

  await Promise.all(
    entries.map((entry) =>
      build({
        write: false,
        entryPoints: [entry],
        bundle: true,
        format: 'esm',
        logLevel: 'error',
        plugins: [...plugins, plugin],
        ...esbuildOptions
      })
    )
  )

  debug(`Scan completed in ${Date.now() - s}ms:`, deps)

  return {
    deps,
    missing
  }
```

前四行定义了四个变量，对于 `deps`, `missing` 我们作用不太清楚，只知道它应该是被 pass 到函数 `esbuildScanPlugin` 中进行 mutate，然后返回给上层。 `container` 是根据用户 config 生成的 plugin 插件，我们之后会看到他的用处。`plugin` 是 `esbuildScanPlugin` 返回的对象，它应该是一个 esbuild 插件，发挥了扫描依赖的作用。

接下来我们看到这个 `Promise.all` 板块。它并行调用了 `build` 函数，而这个 `build` 不是别的，正是大名鼎鼎的 `import { build } from 'esbuild'`。这是 esbuild 提供的打包函数。看来，`esbuildScanPlugin` 便乘了 esbuild 的打包过程，做的却是依赖分析的事情。接下来我们看看，它这个 plugin 是如何便乘的。

```ts
function esbuildScanPlugin(
  config: ResolvedConfig,
  container: PluginContainer,
  depImports: Record<string, string>,
  missing: Record<string, string>,
  entries: string[]
): Plugin {}
```

`esbuildScanPlugin` 接受刚刚我们 pass 给它的五个参数，然后返回一个 `Plugin`，这个 `Plugin` 是 esbuild plugin。esbuild 的 plugin 并不像 babel 或者 webpack 那样，能够参与到构建的全部过程。反之，esbuild 的 plugin 通过正则表达式来响应需要处理的 ID，然后返回处理的结果。这里相关的函数只有 `onResolve` 和 `onLoad`。

我们这里重点只看 JS 相关的部分。

```ts
const scriptModuleRE =
  /(<script\b[^>]*type\s*=\s*(?:"module"|'module')[^>]*>)(.*?)<\/script>/gims
export const scriptRE = /(<script\b(\s[^>]*>|>))(.*?)<\/script>/gims
export const commentRE = /<!--(.|[\r\n])*?-->/
const srcRE = /\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s'">]+))/im
const langRE = /\blang\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s'">]+))/im

function esbuildScanPlugin(
  config: ResolvedConfig,
  container: PluginContainer,
  depImports: Record<string, string>,
  missing: Record<string, string>,
  entries: string[]
): Plugin {
  const seen = new Map<string, string | undefined>()

  const resolve = async (id: string, importer?: string) => {
    const key = id + (importer && path.dirname(importer))
    if (seen.has(key)) {
      return seen.get(key)
    }
    const resolved = await container.resolveId(
      id,
      importer && normalizePath(importer)
    )
    const res = resolved?.id
    seen.set(key, res)
    return res
  }

  const include = config.optimizeDeps?.include
  const exclude = config.optimizeDeps?.exclude

  const externalUnlessEntry = ({ path }: { path: string }) => ({
    path,
    external: !entries.includes(path)
  })

  return {
    name: 'vite:dep-scan',
    setup(build) {
      // external urls
      build.onResolve({ filter: externalRE }, ({ path }) => ({
        path,
        external: true
      }))

      // data urls
      build.onResolve({ filter: dataUrlRE }, ({ path }) => ({
        path,
        external: true
      }))

      // html types: extract script contents -----------------------------------
      build.onResolve({ filter: htmlTypesRE }, async ({ path, importer }) => {
        return {
          path: await resolve(path, importer),
          namespace: 'html'
        }
      })

      // extract scripts inside HTML-like files and treat it as a js module
      build.onLoad(
        { filter: htmlTypesRE, namespace: 'html' },
        async ({ path }) => {
          let raw = fs.readFileSync(path, 'utf-8')
          // Avoid matching the content of the comment
          raw = raw.replace(commentRE, '')
          const isHtml = path.endsWith('.html')
          const regex = isHtml ? scriptModuleRE : scriptRE
          regex.lastIndex = 0
          let js = ''
          let loader: Loader = 'js'
          let match
          while ((match = regex.exec(raw))) {
            const [, openTag, htmlContent, scriptContent] = match
            const content = isHtml ? htmlContent : scriptContent
            const srcMatch = openTag.match(srcRE)
            const langMatch = openTag.match(langRE)
            const lang =
              langMatch && (langMatch[1] || langMatch[2] || langMatch[3])
            if (lang === 'ts' || lang === 'tsx' || lang === 'jsx') {
              loader = lang
            }
            if (srcMatch) {
              const src = srcMatch[1] || srcMatch[2] || srcMatch[3]
              js += `import ${JSON.stringify(src)}\n`
            } else if (content.trim()) {
              js += content + '\n'
            }
          }

          // <script setup> may contain TLA which is not true TLA but esbuild
          // will error on it, so replace it with another operator.
          if (js.includes('await')) {
            js = js.replace(/\bawait(\s)/g, 'void$1')
          }

          if (
            loader.startsWith('ts') &&
            (path.endsWith('.svelte') ||
              (path.endsWith('.vue') && /<script\s+setup/.test(raw)))
          ) {
            // when using TS + (Vue + <script setup>) or Svelte, imports may seem
            // unused to esbuild and dropped in the build output, which prevents
            // esbuild from crawling further.
            // the solution is to add `import 'x'` for every source to force
            // esbuild to keep crawling due to potential side effects.
            let m
            const original = js
            while ((m = importsRE.exec(original)) !== null) {
              // This is necessary to avoid infinite loops with zero-width matches
              if (m.index === importsRE.lastIndex) {
                importsRE.lastIndex++
              }
              js += `\nimport ${m[1]}`
            }
          }

          if (!js.includes(`export default`)) {
            js += `\nexport default {}`
          }

          if (js.includes('import.meta.glob')) {
            return {
              // transformGlob already transforms to js
              loader: 'js',
              contents: await transformGlob(js, path, config.root, loader)
            }
          }

          return {
            loader,
            contents: js
          }
        }
      )

      // bare imports: record and externalize ----------------------------------
      build.onResolve(
        {
          // avoid matching windows volume
          filter: /^[\w@][^:]/
        },
        async ({ path: id, importer }) => {
          if (exclude?.some((e) => e === id || id.startsWith(e + '/'))) {
            return externalUnlessEntry({ path: id })
          }
          if (depImports[id]) {
            return externalUnlessEntry({ path: id })
          }
          const resolved = await resolve(id, importer)
          if (resolved) {
            if (shouldExternalizeDep(resolved, id)) {
              return externalUnlessEntry({ path: id })
            }
            if (resolved.includes('node_modules') || include?.includes(id)) {
              // dependency or forced included, externalize and stop crawling
              if (OPTIMIZABLE_ENTRY_RE.test(resolved)) {
                depImports[id] = resolved
              }
              return externalUnlessEntry({ path: id })
            } else {
              // linked package, keep crawling
              return {
                path: path.resolve(resolved)
              }
            }
          } else {
            missing[id] = normalizePath(importer)
          }
        }
      )

      // Externalized file types -----------------------------------------------
      // these are done on raw ids using esbuild's native regex filter so it
      // should be faster than doing it in the catch-all via js
      // they are done after the bare import resolve because a package name
      // may end with these extensions

      // css & json
      build.onResolve(
        {
          filter: /\.(css|less|sass|scss|styl|stylus|pcss|postcss|json)$/
        },
        externalUnlessEntry
      )

      // known asset types
      build.onResolve(
        {
          filter: new RegExp(`\\.(${KNOWN_ASSET_TYPES.join('|')})$`)
        },
        externalUnlessEntry
      )

      // known vite query types: ?worker, ?raw
      build.onResolve({ filter: SPECIAL_QUERY_RE }, ({ path }) => ({
        path,
        external: true
      }))

      // catch all -------------------------------------------------------------

      build.onResolve(
        {
          filter: /.*/
        },
        async ({ path: id, importer }) => {
          // use vite resolver to support urls and omitted extensions
          const resolved = await resolve(id, importer)
          if (resolved) {
            if (shouldExternalizeDep(resolved, id)) {
              return externalUnlessEntry({ path: id })
            }

            const namespace = htmlTypesRE.test(resolved) ? 'html' : undefined

            return {
              path: path.resolve(cleanUrl(resolved)),
              namespace
            }
          } else {
            // resolve failed... probably unsupported type
            return externalUnlessEntry({ path: id })
          }
        }
      )

      // for jsx/tsx, we need to access the content and check for
      // presence of import.meta.glob, since it results in import relationships
      // but isn't crawled by esbuild.
      build.onLoad({ filter: JS_TYPES_RE }, ({ path: id }) => {
        let ext = path.extname(id).slice(1)
        if (ext === 'mjs') ext = 'js'

        let contents = fs.readFileSync(id, 'utf-8')
        if (ext.endsWith('x') && config.esbuild && config.esbuild.jsxInject) {
          contents = config.esbuild.jsxInject + `\n` + contents
        }

        if (contents.includes('import.meta.glob')) {
          return transformGlob(contents, id, config.root, ext as Loader).then(
            (contents) => ({
              loader: ext as Loader,
              contents
            })
          )
        }
        return {
          loader: ext as Loader,
          contents
        }
      })
    }
  }
}
```

`build.onResolve({ filter: /^[\w@][^:]/ }` 是重头戏，处理的是 "Bare import" 的情况。也就是，从 `node_modules` 中直接 import 名字的情况。接下来的代码就非常重要了，我们把它复制到下面来：

```ts
        async ({ path: id, importer }) => {
          if (exclude?.some((e) => e === id || id.startsWith(e + '/'))) {
            return externalUnlessEntry({ path: id })
          }
          if (depImports[id]) {
            return externalUnlessEntry({ path: id })
          }
          const resolved = await resolve(id, importer)
          if (resolved) {
            if (shouldExternalizeDep(resolved, id)) {
              return externalUnlessEntry({ path: id })
            }
            if (resolved.includes('node_modules') || include?.includes(id)) {
              // dependency or forced included, externalize and stop crawling
              if (OPTIMIZABLE_ENTRY_RE.test(resolved)) {
                depImports[id] = resolved
              }
              return externalUnlessEntry({ path: id })
            } else {
              // linked package, keep crawling
              return {
                path: path.resolve(resolved)
              }
            }
          } else {
            missing[id] = normalizePath(importer)
          }
        }
```

首先两个 `if` 处理了需要 externalize 的情况。

externalize 应该是打包的一个术语，意为虽然 import 到了，但是它并不属于我们的 bundle。一个简单的例子就是 `import 'index.css'`，我们从来不会期望这个 css 在我们的 js bundle 里面，而是希望他会附加到最终生成的 html 的 header 里面。

第一种情况，用户指定的 `exclude` 中明确了这个 bundle 不要 prebundle。

第二种情况，`depImports` 中已经有了解析出的 `id`。`depImports` 刚好就是我们在 `scanImports` 中调用 `esbuildScanPlugin` 时直接传入的 `deps: Record<string, string>`。而这个 `deps` 是每个 entry 都共享的。如果一个 Bare Import 被解析过了，那么它就要被 externalize！

需要明确的是，这里调用了 esbuild，但它并不是最终生成 Prebundle 的地方！这里的 externalize 只是避免 esbuild 重复解析某个 package，进行优化。

`build.onResolve({ filter: /.*/ }, (...) => {...}` 这块处理的是非已知静态资源的模块，也就可能是 JS 模块。这里调用了 `resolve` 来获取 Vite 实际的 URL。这个 `resolve` 是在做什么呢？原来它就定义在这个函数中，做的事情是调用 Vite 的插件系统来 resolve 这个 id，并且记录到 `seen` 这个 `Map` 中。

然后，如果 `resolve` 成功了，Vite 会调用 `shouldExternalizeDep` 来判断是否把这个 ID 踢出 bundle，也就是bundle中将不含这个 id。`shouldExternalizeDep` 排除了一些 Vite 无法 handle 的情况。接下来我们假设这个 JS 的 id 被正常解析了。它将会进入 `build.onLoad({ filter: JS_TYPES_RE }, (...) => {...})`。`onLoad` 处理了一些 Vite 的扩展功能，比如 `glob import`。在标准的 JS 中，我们不会被这部分影响。

接下来我们从 `scanImports` 中回来，回到我们的 `optimizeDeps` 中：

```ts
({ deps, missing } = await scanImports(config))
```

如果一切顺利，`deps` 应该是一个导入依赖到依赖实际路径的 `Record<string, string>`，而 `missing` 是未能解析的模块。注意，这里的 key 是对 `esbuild` 有意义的模块 ID，对于 Bare Import 而言应该是一个简单的模块名，例如 `react`, `react-dom`, `lodash`。

之后，Vite 又处理了 config 中需要干预 `deps` 内容的地方，这里略过，最后我们得到了所有的依赖的 keys 

```ts
  const qualifiedIds = Object.keys(deps)
  console.log({ qualifiedIds });
```

让我们看看我们的简单项目打印出来是什么：

```bash
$ vite --force
{ qualifiedIds: [ 'react', 'react-dom' ] }
Pre-bundling dependencies:
  react
  react-dom
```

## 问题 3：Vite 如何避免重复打包？

接下来，就要进行实际的 bundle 了。首先，Vite 对文件名进行了转化：

```ts

  // esbuild generates nested directory output with lowest common ancestor base
  // this is unpredictable and makes it difficult to analyze entry / output
  // mapping. So what we do here is:
  // 1. flatten all ids to eliminate slash
  // 2. in the plugin, read the entry ourselves as virtual files to retain the
  //    path.
  const flatIdDeps: Record<string, string> = {}
  const idToExports: Record<string, ExportsData> = {}
  const flatIdToExports: Record<string, ExportsData> = {}

  await init
  for (const id in deps) {
    const flatId = flattenId(id)
    flatIdDeps[flatId] = deps[id]
    const entryContent = fs.readFileSync(deps[id], 'utf-8')
    const exportsData = parse(entryContent) as ExportsData
    for (const { ss, se } of exportsData[0]) {
      const exp = entryContent.slice(ss, se)
      if (/export\s+\*\s+from/.test(exp)) {
        exportsData.hasReExports = true
      }
    }
    idToExports[id] = exportsData
    flatIdToExports[flatId] = exportsData
  }
```

这里它针对每个解析到的 `id in deps`，首先进行了 `flattenId` 的操作。这里的原因是，`id` 可能会含有 slash (`/`)，所以不利于在不同的上下文中操作。`flattenId` 把 slash 进行了转换。这里，Vite 还利用 `es-module-lexer` 来解析 `deps` 的 `export` 了哪些名字。这个作用我们之后再看。

最后是我们的主菜，Vite 进行的 Prebundling 操作。这里出现的 `esbuildDepPlugin` 利用了刚刚定义的三个变量 `flatIdDeps`, `idToExports`, `flatIdToExports` 的信息。这里的 plugin 应该是为了辅助 `esbuild` 去解析之前 scan 到的 Dependency，并且处理 `A -> C, B -> C` 也就是两个 Dependency 存在共享依赖的情况。

```ts
  const result = await build({
    entryPoints: Object.keys(flatIdDeps),
    bundle: true,
    format: 'esm',
    external: config.optimizeDeps?.exclude,
    logLevel: 'error',
    splitting: true,
    sourcemap: true,
    outdir: cacheDir,
    treeShaking: 'ignore-annotations',
    metafile: true,
    define,
    plugins: [
      ...plugins,
      esbuildDepPlugin(flatIdDeps, flatIdToExports, config)
    ],
    ...esbuildOptions
  });
```

让我们来看看 `esbuildDepPlugin` 做了些什么。 它的定义在 [/optimizer/esbuildDepPlugin.ts](https://github.com/vitejs/vite/blob/6d602a0a4d2c1e77ded1344d59733eb93d4009c3/packages/vite/src/node/optimizer/esbuildDepPlugin.ts) 中。

```jsx
export function esbuildDepPlugin(
  qualified: Record<string, string>,
  exportsData: Record<string, ExportsData>,
  config: ResolvedConfig
): Plugin {
  // default resolver which prefers ESM
  const _resolve = config.createResolver({ asSrc: false })

  // cjs resolver that prefers Node
  const _resolveRequire = config.createResolver({
    asSrc: false,
    isRequire: true
  })

  const resolve = (
    id: string,
    importer: string,
    kind: ImportKind,
    resolveDir?: string
  ): Promise<string | undefined> => {
    let _importer
    // explicit resolveDir - this is passed only during yarn pnp resolve for
    // entries
    if (resolveDir) {
      _importer = normalizePath(path.join(resolveDir, '*'))
    } else {
      // map importer ids to file paths for correct resolution
      _importer = importer in qualified ? qualified[importer] : importer
    }
    const resolver = kind.startsWith('require') ? _resolveRequire : _resolve
    return resolver(id, _importer)
  }

  return {
    name: 'vite:dep-pre-bundle',
    setup(build) {
      // ...
      build.onResolve({ filter: /^[\w@][^:]/ }, /* ... */);

      build.onLoad({ filter: /.*/, namespace: 'dep' }, /* ... */);
      // ...
    }
  }
}

```

`esbuildDepPlugin` 返回的是一个名为 `vite:dep-pre-bundle` 的插件，看来就是它了。它的 `onResolve` 关键在于处理 `/^[\w@][^:]/` 也就是 Bare Import 的情况。对于每个 Bare Import，如果它出现在输入的 `qualified` 中，（也就是输入的 `deps`)，那么它是属于 esbuild 的 [namespace](https://esbuild.github.io/plugins/#namespaces) `dep`，则会被 pass 到 `build.onLoad({ filter: /.*/, namespace: 'dep' }, /* ... */);` 中处理。

在 `build.onLoad({ filter: /.*/, namespace: 'dep' }, /* ... */);` 中，Vite 对这些 `dep` 进行的令人不解的操作，也就是对其进行了一层“包裹”。 但是笔者认为这不妨碍我们理解 Vite 的大体，故不再深究。

接下来，我们跳出 `esbuildDepPlugin`，回到 `optimizeDeps`。我们可以看到 esbuild 的结果是什么：

```ts
  const result = await build({
    entryPoints: Object.keys(flatIdDeps),
    bundle: true,
    format: 'esm',
    external: config.optimizeDeps?.exclude,
    logLevel: 'error',
    splitting: true,
    sourcemap: true,
    outdir: cacheDir,
    treeShaking: 'ignore-annotations',
    metafile: true,
    define,
    plugins: [
      ...plugins,
      esbuildDepPlugin(flatIdDeps, flatIdToExports, config)
    ],
    ...esbuildOptions
  })

  const meta = result.metafile!

  // the paths in `meta.outputs` are relative to `process.cwd()`
  const cacheDirOutputPath = path.relative(process.cwd(), cacheDir)

  for (const id in deps) {
    const entry = deps[id]
    data.optimized[id] = {
      file: normalizePath(path.resolve(cacheDir, flattenId(id) + '.js')),
      src: entry,
      needsInterop: needsInterop(
        id,
        idToExports[id],
        meta.outputs,
        cacheDirOutputPath
      )
    }
  }

  writeFile(dataPath, JSON.stringify(data, null, 2))

  debug(`deps bundled in ${Date.now() - start}ms`)
  return data
```

注意这里 `cacheDir` 就是用户指定的 Prebundling Cache 的地址，Vite 忠于原味，将 esbuild 的结果直接放入了这个文件夹。

```
node_modules/.vite
├── _metadata.json
├── chunk-M6WV3DSO.js
├── chunk-M6WV3DSO.js.map
├── react-dom.js
├── react-dom.js.map
├── react.js
└── react.js.map
```

因此这些 chunk 都是 esbuild render 的结果，而这些名字熟悉的 `react.js`, `react-dom.js` 正是我们刚刚 `build` 的 entry 的结果！

那么我们第三个问题的答案也就呼之欲出了：Vite 在 Prebundling 时最终使用的是 esbuild 的 build 函数。esbuild 原生支持多个 entry，因此依赖之间的共享依赖问题是在 esbuild 内部解决的（怎么像是提出了另外一个问题，LOL）。

## 总结

以上就是 Vite 源代码的沧海一粟：带读者了解了 Vite Prebundling 的基本过程。我们总结过程要点如下：

1. Vite 通过 esbuild 的 build 方法，扫描各个入口的依赖，获得每个 dep 的 entry。插件是 `esbuildScanPlugin`。这一步虽然调用了 build 但并不输出任何文件。
2. Vite 通过 esbuild 的 build 方法，将各个 dep entry 编译成 js，输出到缓存目录下。
3. Vite 的 Prebundling 缓存机制并非万全，需要 plugin 开发者多注意。

最后，点评一下 Vite 的代码质量。我个人认为是代码质量一般般，各个地方经常出现 ad hoc 的解法，例如 `createPluginContainer` 就被多处调用，明明只需要调用一次。

另外竟然出现了这样的神奇代码，用 `ext.endsWith('x')` 来判断是不是 `tsx` 文件。还能再实用主义一点吗？

```ts
        let contents = fs.readFileSync(id, 'utf-8')
        if (ext.endsWith('x') && config.esbuild && config.esbuild.jsxInject) {
          contents = config.esbuild.jsxInject + `\n` + contents
        }
```

整个 Vite 给我的感觉仿佛是在写一段脚本，作者似乎没有对全局有特别的掌控意识，而是给人能用就行的感觉。其他 “works but unsound” 的写法不胜枚举，例如：

```ts
          if (js.includes('import.meta.glob')) {
            return {
              // transformGlob already transforms to js
              loader: 'js',
              contents: await transformGlob(js, path, config.root, loader)
            }
          }
```

这里显然没考虑词法的问题。

同时，框架本来应该是 Framework Agnostic 的，可是又硬编码处理了 `.swelte`, `.vue` 这类文件，给人一种杂糅的感觉。

Vite 虽然用起来香，但是实验的味道也非常重，希望社区继续努力吧！
