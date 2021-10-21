# 前言

ES Module 和 CommonJS 是 JS 的老大难问题，也是许多文章老生常谈的问题。笔者也看过不少相关的文章，可是总觉得看着懂，动手的时候又会出现不少的问题。比如 Node 中类似 `ERR_REQUIRE_ESM` 这样的 error 是怎么回事？为什么使用 webpack/rollup/vite 等打包工具没有出现问题，Node 中就会出现问题？什么时候需要 `importObject.default`， 什么时候又不需要？ TypeScript 中的 `esModuleInterop` 是做什么用的？为什么打包产物中会有 `__esModule` 这样的东西？这些疑难的问题，一言以蔽之，就是 JS 社区采用 ES Module 的历史遗留问题，也是实践和标准不一致的问题。本文来一一探讨其来龙去脉。

# CommonJS 是什么？

正如我们所知，CommonJS 就是一种 module format，这样一种 format 被 NodeJS 采用作为其 module 的格式。CommonJS 起源于 2009 年，比 ES Module 在 ES2015 年出现要早得多。

CommonJS 实际上非常简单，它的 `module.exports` 是一个自由涂写的 object，而 `require` 一个 module 就是获取其 `module.exports`。

CommonJS 虽然被 Node 采用，Node 也被广泛运用，但 CommonJS 最终没有成为进入语言标准的 module format。

# ECMAScript Module 是什么？

ESM 是在 ES2015 (ES6) 中加入 JS 语言规范的 format。其用法相信不需要我来赘述，这里我们谈谈几个细节。

## import 标识符

```javascript
// foo.js
export const a = 1;
const d = 1;
export default d;

// main.js
import d, { a } from './foo.js';
```

当我们在写 `import d, { a } from './foo.js';` 的时候，我们在写什么？

在这里，我们需要为 `./foo.js` 建立一个模型，也就是它等价于一个 object，而 import specifier 仅仅相当于在访问它的属性。

```javascript
const foo = {
  default: d,
  a,
}
```

`foo` 称为一个 Module Namespace Object，它正是 Namespace Import 返回的 object

```javascript
import * as foo from './foo.js';
// foo.default === d, foo.a === a
```

也就是说我们说下面两者各自等价：

```javascript
import d from './foo.js';
//////
import * as foo from './foo.js';
const d = foo.default;
```

```javascript
import { a } from './foo.js';
//////
import * as foo from './foo.js';
const a = foo.a;
```

# 实践中的 ESM 和 CJS

众所周知，CJS 一直是具有统治地位的 format。如果引入了 ESM 作为新的 format，我们会遇到两个问题。

1. ESM 格式写成的 JS，如何引入老 CJS 格式的代码？
2. CJS 格式写成的 JS，如何引入新 ESM 格式的代码？

这里是“标准”的灰色地带，也是许多问题诞生的源泉。围绕这两个问题，答案零零散散在网络的各个角落，我们来简单概括一下各种办法。

## 转译派

对于一般的 JS 开发，我们的 JS 项目需要在一个目标平台上运行，NodeJS, 浏览器, Electron 等等。假如以此为契机，把不同模式的依赖转换为该平台支持的一种，那么就解决了不同 format 之间的互通问题。例如 [# @rollup/plugin-commonjs](https://github.com/rollup/plugins/tree/master/packages/commonjs)可以将 cjs 的模块按照一定的规范转换为 esm，而 TypeScript 等可以将 esm 模块转换为 cjs。因为 cjs 到 esm 涉及复杂的语法分析，我们重点探讨 esm 到 cjs 的转换。

### ESM -> CJS

对于同一个 ESM 源文件

```
export const a = 1;
const d = 1;
export default d;
```

我们来看看几个例子：

1. TypeScript `"module:" "commonjs"`

```js
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.a = void 0;
exports.a = 1;
const d = 1;
exports.default = d;
```

2. ESBuild `esbuild foo.js --format=cjs`

```js
var __defProp = Object.defineProperty;
var __markAsModule = (target) => __defProp(target, "__esModule", { value: true });
var __export = (target, all) => {
  __markAsModule(target);
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
__export(exports, {
  a: () => a,
  default: () => foo_default
});
const a = 1;
const d = 1;
var foo_default = d;
```

3. Babel

```js
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.a = void 0;
const a = 1;
exports.a = a;
const d = 1;
var _default = d;
exports.default = _default;
```

我们可以看到，结果都大同小异：我们给一个名为 `exports` 的名为 `NAME` 的键赋予我们 `export const NAME` 的值，同时 `exports.default` 被赋值为 `export default` 的变量。

同时还有一个不约而同的东西： `exports.__esModule`。这个 `__esModule` 是做什么用的呢？

这个要在 `import` 中寻找答案，让我们看看 `import` 是怎么变成 `require` 的。以 TS 为例。

```js
import d from './foo.js';

console.log(d);
```

```js
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const foo_js_1 = __importDefault(require("./foo.js"));
console.log(foo_js_1.default);
```

原来，这是因为在单文件编译时，如果没有 `__esModule` 作为标识，我们无法确定 `./foo.js` 是不是一个 ESM 转译过来的，这会造成如下问题：

```
const foo = require('./foo.js');
```
注意我们 `require('./foo.js')` 得到的是 foo.js 对应的 Module Namespace Object，所以实际上 

```
const foo = {
  default: d,
  a,
}
```
这样，我们需要利用 `foo.default` 才能访问到 `d` 了。

而假如 `./foo.js` 是一个 cjs 模块，内部有 `module.exports = d`，则 `const d = require('./foo.js')` 可以直接访问 `d`。为了让这 esm 和 cjs 的“默认导出”有类似的表现，我们引入了 `__esModule` 作为区分，从而不需要写显示的 `require('./foo.js').default`，而让转译器替我们完成这个工作。

值得一提的是尚不清楚为何几乎所有的转移器均支持这个特性，大概这就是进化的趋同性吧。我们只需要知道使用转译器的大多数情况下我们不需要担心要不要 `.default`了。

## 按需索取派

在支持模块特性的 JS 工具中，并非所有都支持 JS 的转译功能。没错，说的就是 NodeJS。NodeJS 作为 JS 模块化实践的先驱，自然历史负担也是非常重的，也在 CommonJS 转型到 ESM 的过程中引入了不少困惑，但如今 ESM 已经是 NodeJS 稳定支持的特性了。

那么像 NodeJS 这样的“残疾人”，如何让 cjs 和 esm 互通呢？很简单，它需要我们通过 `package.json` 和文件后缀名等，帮助 NodeJS 处理两种模块的 JS。

### NodeJS 对 ESM 的支持

#### import

import 的主要方式：

+ 相对引入 (Relative Specifier)：和浏览器一致，NodeJS 支持 `import { a } from './foo.js'` 的语法。注意后缀名是必须的，可以是 '.js' 或者 '.mjs'。与 cjs 不同的是，这里必须要以确实的相对路径结尾，不可以省略后缀名，不然会无法找到模块。这点和标准一致，但和一般的打包工具是不兼容的。
+ 模块引入 (Bare Specifier)：类似 `import React from 'react'` 这样的引入。这也是 TS, Rollup 等转译器中支持的格式。**模块引入中，同样有和通行打包工具不兼容的地方。**

#### NodeJS 的模块引入

算法可以近似如下：

1. 首先，Node 会根据一般的 node_modules 定位算法找到对应模块的 package.json。
2. 根据 package.json 的 exports, main 找到入口文件。exports 的优先级高于 main。

exports 是 Node 引入的新特性。详细请见 [Conditional Exports](https://nodejs.org/api/packages.html#conditional-exports)。

注意，NodeJS 不会考虑 `"pkg.module"`, `"pkg.browser"`这些 field 的影响，即使他们被其他 bundler 支持，但 Node 从未支持过这些 field。

#### NodeJS 对 module format 的判断算法

我们知道，无论 ESM 和 CJS，习惯上文件的后缀名都可以是 JS，因此 Node 单凭文件名是无法区分 module 是 ESM 和 CJS 的，而是根据一套简单规则来判断的，规则如下：

1. 如果后缀名是 cjs，format 就是 CJS。
2. 如果后缀名是 mjs，format 就是 ESM。
3. 否则，查找最近一级的 `package.json`，如果它的 `"type": "module"`，这个文件就是 ESM，否则是 CJS。

在确定了 format 以后，Node 才根据不同的语法规则去读取这两者。如果你想使用 ESM 的语法，而不满足判定规则，Node就会认定其为 CJS，而出现语法错误。反之，则会出现运行时错误。

#### NodeJS 中 CJS 与 ESM 的互通性

NodeJS 中，`import` 关键字可以引入 CJS 模块，而 `require` 关键字不可以引入 ESM 模块。

+ ESM 引入 CJS

`import` 完全可以引入 `.cjs` 文件，参见 https://nodejs.org/api/esm.html#commonjs-namespaces

在这里 `module.exports` 对应于于 default import，而 `module.exports.a` 对应于 `import { a }`


+ CJS 引入 ESM

根据 NodeJS 文档，https://nodejs.org/api/esm.html#commonjs-namespaces ，由于 ESM 有异步操作，所以 `require` 不可以用于引入 ESM （听起来是个牵强的理由），这是许多错误的源泉。

例如 node-fetch 的 package.json 中有 

```json
{
  "name": "node-fetch",
  "version": "3.0.0",
  "description": "A light-weight module that brings Fetch API to node.js",
  "main": "./src/index.js",
  "sideEffects": false,
  "type": "module"
}
```

根据 format 判断算法，如果 `require('node-fetch')`，那么解析到的入口文件将被认定为一个 ESM，从而引起 `ERR_REQUIRE_ESM` 这样的错误。如果要引入的话，我们可以用 [import expression](https://nodejs.org/api/esm.html#import-expressions)。在 Node 中 CJS 模块也支持 `import()` 来导入模块，从而规避了 `require` 的限制。可惜，`import()` 是异步的，如果你需要同步的方式，就只能寻求其他的方式了。例如寻找替代的模块、进行转译等方式。

为了让 Node 和其他的打包工具可以顺利按需引入 ESM 和 CJS 模块，我们需要这样组织 package.json：

```
{
  "name": "node-fetch",
  "version": "3.0.0",
  "description": "A light-weight module that brings Fetch API to node.js",
  "main": "./src/index.cjs",
  "module": "./src/index.js",
  "exports": {
    "import": "./src/index.js",
    "require": "./src/index.cjs"
  },
  "sideEffects": false,
  "type": "module"
}
```

这样，Node 会按照 [Conditional Exports](https://nodejs.org/api/esm.html#resolver-algorithm-specification) 的规则，当 `import` 这个模块的时候，选择 `exports.import`；`require` 的时候选择 `exports.require`。对于不支持 `exports` 的 Node 版本则会选择 `main` 中的 CJS 模块。

注意到 `"module": "./src/index.js"` 遵循了 [Rollup](https://github.com/rollup/rollup/wiki/pkg.module), [Webpack](https://github.com/rollup/rollup/wiki/pkg.module), [Vite](https://vitejs.dev/config/#resolve-mainfields) 等支持 ESM 的打包工具的解析方式，使得它们可以优先选择 ESM 而不是 `"main"` 的 CJS 模块。（实际上它们的新版本也应该都支持了 `"exports"` 优先的模式，`"module"` 属于 legacy 的支持）。

#### Node 的总结

NodeJS 对 ESM 支持已经稳定了，但和大多数转译打包工具不兼容。一般来说 App 等项目还是建议全部使用 CommonJS 作为转译的方式，规避 NodeJS 和通行工具的不兼容之处。

# 总结

ESM 和 CJS 在实践中引入了比较困惑的现象，但是从标准的概念来讲两者并不困难。打包转译工具为 JS 的编写带来了复杂性，由于支持的程度和兼容的具体方式不同，对于具体的工具如何处理 ESM 和 CJS 不可以想当然，遇到问题要去文档中寻找答案。

本文只是 ESM 和 CJS 相关复杂问题的冰山一角，还有很多复杂的表现恐怕需要深入标准、文档和源码中去寻找答案。

# 参考资料

1. Modules: ECMAScript modules https://nodejs.org/api/esm.html
2. Modules: Packages  https://nodejs.org/api/packages.html
3. Rollup on publishing ES Modules: https://rollupjs.org/guide/en/#publishing-es-modules
4. Conditional Exports: https://nodejs.org/api/packages.html#conditional-exports
5. Discussion: *TypeScript cannot emit valid ES modules due to file extension issue* https://github.com/microsoft/TypeScript/issues/42151



