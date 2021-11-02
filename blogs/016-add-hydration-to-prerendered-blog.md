---
title: 为预渲染的静态博客增加 hydrate 功能
slug: add-hydration-to-prerendered-blog
date: 2021-11-02
abstract: 纯粹的 SSR 页面只能给用户返回静态不可交互的页面，preact.hydrate 让静态页面重回可交互的怀抱。
---

上接前一篇文章，我用 esbuild 等工具建立了由 preact（在服务端）渲染成的静态博客。preact 和 react 一样，提供了 `hydrate` 函数。hydrate 的函数使用也很简单，假设我们预渲染的网页挂载在 `document.getElementById("root")` 下，那么只要以下两行代码即可让静态渲染而成的元素重新和 preact 绑定，从而“恢复”交互性。

```js
import { hydrate } from 'preact';

hydrate(<Page />, document.getElementById('root'));
```

下称这段代码为 “entry”。

用户需要做的是定义 `Page` 组件，然后在 `pages/` 下对应路由的下的 `.tsx` 文件中打开它。

但是我们有几个问题需要解决：

1. 如何插入并把它加入编译中？

    第一种可能性是用 esbuild 单独编译 entry，然后将 entry 单独插入到 script tag 中。

    注意这里的 `preact` 必须和 Page 组件 import 的那个 `preact` 是同一个包，否则不仅仅是体积膨胀的问题，而且在使用 hooks 的时候也会因此有运行时错误。

    因此，我们不能单独编译 entry，而必须将之与用户的组件一并编译。

    那么是否将 entry 加入 esbuild 的 `config.entryPoints` 就能解决问题呢？恐怕也不太方便。其一是必须打开 `splitting` 功能，这样 preact 会作为公共 chunk 共享，从而化解了多个 preact 模块并存的问题。但第二个问题随之而来：entry 的 Page 是需要根据所在页面决定的，因此 entry 的内容实际上需要动态生成。这引入了生成临时文件的麻烦。其次，preact 是比较小的包，将其分离出来单独下载性能上不理想（强迫症犯了）。

    最终我采用了使用 esbuild 的插件 `onLoad` 钩子函数的办法。具体的代码也很短：

    ```js
    build.onLoad({ filter: /pages\/.*\.tsx/ }, async ({ path }) => {
      const input = (await fs.readFile(path)).toString();
      const exportDefaultName = /^\s+export\s+default\s+function\s+(\w+)/m.exec(input)?.[1];
      if (exportDefaultName === undefined) {
        throw new Error(`Didn't find a default export for page: ${path}. Did you use 'export default function PageName() {}' to define the page component?`);
      }

      let transformedInput = input
        + '\n'
        + clientEntry.replace(/__PAGE__/g, exportDefaultName);

      return {
        contents: transformedInput,
        loader: 'tsx',
      };
    });
    ```

    这里需要匹配所有 pages 目录下的页面，然后用正则匹配的方式提取其 default export 的名称，将模板进行替换并插入尾部。

    注意这里有些 esbuild 的问题需要注意：

    1. esbuild 不提供公开的 AST，因此只能用正则表达式来粗略匹配。
    2. esbuild 默认会按照 JS 进行后续的处理，而不是原来文件的扩展名。我们需要返回 `loader: "tsx"` 来告诉 esbuild 按照 tsx 的语法进行解析。
    3. esbuild 会根据 onLoad 的结果进一步解析所依赖的模块。
  

2. 接下来如何进行预渲染？
   
    之前，我们仅仅使用了 `preact` 和 `preact-render-to-string` 来进行预渲染

    ```js
    const SourceModule: PageModule = await eval(`import(${JSON.stringify(renderModule)})`);
    const prerendered = render(<SourceModule.default {...props} />);
    ```

    `renderModule` 是 esbuild 编译的结果。而这里 eval 是为了绕过 TypeScript 将 import expression 编译为 require，而无法导入 esmodule 的问题。而引入 Hook 以后，则会出现问题：`renderModule` 引入了自己的 `preact` 模块，而 `render` 因为在 node 的环境中引入的是 node_modules 中的模块。这样多重 preact 的模块会导致 render 时出现 hooks 会失败。

    因此解决的方案是改成用 `require` 来直接导入未编译的 page module。这里因为我们用的是 `ts-node`，所以我们会按照 TypeScript 的方式去编译并导入源文件的模块。注意，这里我们已经在类似 next 一样，使用不同的编译结果来做客户端和服务端的渲染。

    ```js
    const SourceModule: PageModule = require(renderModule); // 这里 renderModule 改为了 module 的源文件。
    const prerendered = render(<SourceModule.default {...props} />);
    ```

3. 避免重复的数据。

    在最后生成的 html 中，我们需要同时插入 props 和 js 才能完成 `hydrate` 的过程。因此实际的 html tags 长这样：

    ```html
    <script>window.__PROPS__ = JSON.parse("DATA...");</script>
    <script type="module" src="index-YPPFTRMR.mjs"></script>
    ```

    假设我们的文章很长，那么为了渲染这篇文章，文章的内容需要出现两次：html 中和 `__PROPS__` 中。这样的话，会有等同你文章长度的额外开销，而文章内容本身其实我们是不需要 hydrate 的，因为它根本不会和用户交互。

    参考 Preact 的[官方教程](https://preactjs.com/guide/v10/external-dom-mutations)，在这里我们定义称为 `StaticBoundary` 的类组件：

    ```js
    import { Component } from "preact";

    export default class StaticBoundary extends Component {
      shouldComponentUpdate() {
        return false;
      }

      render() {
        return this.props.children;
      }
    }
    ```

    这样该组件将永不更新，即使它的子组件 props 发生变化。

    然后我们在单条博客的页面组件 `Blog` 中引入它包裹博客自身：


    ```jsx
    export default function Blog(props) {
      const {
        entry,
      } = props;

      const date = new Date(entry.data.date);

      return (
        <Layout>
          <StaticBoundary>
            <div class="md py-4" dangerouslySetInnerHTML={{ __html: entry.html! }} />
          </StaticBoundary>
        </Layout>
      );
    }
    ```

    在服务端预渲染的时候，我们将整个 entry 输入 Blog 中，得到完整的页面；在客户端，我们不需要传入 `entry.html`。而因为 preact 在 hydrate 的时候，并不考虑和现有的 DOM 是否一致，也不进行渲染，只是将事件的回调函数进行配置，加上 `StaticBoundary` 的 `shouldComponentUpdate` 永远返回 `false`，所以 `StaticBoundary` 对应的 DOM 成为了名副其实的“自由王国”，不受 preact 虚拟 DOM 的拘束，因此我们也不需要把完整的博客 html 传入了。

    当文章很长的时候，可以节约可观的资源。例如 [从实现和标准理解 ECMAScript Module 和 CommonJS Module](understanding-ecma-modules-and-commonjs-from-implementation-and-standards) 的 HTML 体积便由 35.4Kb 下降到了 19.9Kb，为保护环境做了一点微小的贡献。

    Vue 中也有类似的机制，通过跳过静态的组件来减少 diff 和 rerender 的开销，实际上 React 也非不能做到。

大功告成，可以写可交互的页面了！