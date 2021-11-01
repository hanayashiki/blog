---
title: 在 JavaScript Project 文件夹中套 Project 时，请当心意想不到的事情！ 
slug: be-careful-with-js-project-within-js-project
date: 2021-01-14
abstract: 父级目录的文件，大多数情况下会影响子目录的编译行为。
---

笔者最近碰到了一个很奇怪的现象，下面是一个项目的简化过的结构：

```
├── node_modules
├── subproject
│   ├── index.ts
│   └── tsconfig.json
└── tsconfig.json
```

subproject 的 `tsconfig.json` 的内容是默认的

```
{
  "compilerOptions": {
    /* Visit https://aka.ms/tsconfig.json to read more about this file */

    /* Basic Options */
    // "incremental": true,                   /* Enable incremental compilation */
    "target": "es5",                          /* Specify ECMAScript target version: 'ES3' (default), 'ES5', 'ES2015', 'ES2016', 'ES2017', 'ES2018', 'ES2019', 'ES2020', or 'ESNEXT'. */
    "module": "commonjs",                     /* Specify module code generation: 'none', 'commonjs', 'amd', 'system', 'umd', 'es2015', 'es2020', or 'ESNext'. */
    // "lib": [],                             /* Specify library files to be included in the compilation. */
    // "allowJs": true,                       /* Allow javascript files to be compiled. */
    // "checkJs": true,                       /* Report errors in .js files. */
    // "jsx": "preserve",                     /* Specify JSX code generation: 'preserve', 'react-native', or 'react'. */
    // "declaration": true,                   /* Generates corresponding '.d.ts' file. */
    // "declarationMap": true,                /* Generates a sourcemap for each corresponding '.d.ts' file. */
    // "sourceMap": true,                     /* Generates corresponding '.map' file. */
    // "outFile": "./",                       /* Concatenate and emit output to single file. */
    // "outDir": "./",                        /* Redirect output structure to the directory. */
    // "rootDir": "./",                       /* Specify the root directory of input files. Use to control the output directory structure with --outDir. */
    // "composite": true,                     /* Enable project compilation */
    // "tsBuildInfoFile": "./",               /* Specify file to store incremental compilation information */
    // "removeComments": true,                /* Do not emit comments to output. */
    // "noEmit": true,                        /* Do not emit outputs. */
    // "importHelpers": true,                 /* Import emit helpers from 'tslib'. */
    // "downlevelIteration": true,            /* Provide full support for iterables in 'for-of', spread, and destructuring when targeting 'ES5' or 'ES3'. */
    // "isolatedModules": true,               /* Transpile each file as a separate module (similar to 'ts.transpileModule'). */

    /* Strict Type-Checking Options */
    "strict": true,                           /* Enable all strict type-checking options. */
    // "noImplicitAny": true,                 /* Raise error on expressions and declarations with an implied 'any' type. */
    // "strictNullChecks": true,              /* Enable strict null checks. */
    // "strictFunctionTypes": true,           /* Enable strict checking of function types. */
    // "strictBindCallApply": true,           /* Enable strict 'bind', 'call', and 'apply' methods on functions. */
    // "strictPropertyInitialization": true,  /* Enable strict checking of property initialization in classes. */
    // "noImplicitThis": true,                /* Raise error on 'this' expressions with an implied 'any' type. */
    // "alwaysStrict": true,                  /* Parse in strict mode and emit "use strict" for each source file. */

    /* Additional Checks */
    // "noUnusedLocals": true,                /* Report errors on unused locals. */
    // "noUnusedParameters": true,            /* Report errors on unused parameters. */
    // "noImplicitReturns": true,             /* Report error when not all code paths in function return a value. */
    // "noFallthroughCasesInSwitch": true,    /* Report errors for fallthrough cases in switch statement. */

    /* Module Resolution Options */
    // "moduleResolution": "node",            /* Specify module resolution strategy: 'node' (Node.js) or 'classic' (TypeScript pre-1.6). */
    // "baseUrl": "./",                       /* Base directory to resolve non-absolute module names. */
    // "paths": {},                           /* A series of entries which re-map imports to lookup locations relative to the 'baseUrl'. */
    // "rootDirs": [],                        /* List of root folders whose combined content represents the structure of the project at runtime. */
    // "typeRoots": [],                       /* List of folders to include type definitions from. */
    // "types": [],                           /* Type declaration files to be included in compilation. */
    // "allowSyntheticDefaultImports": true,  /* Allow default imports from modules with no default export. This does not affect code emit, just typechecking. */
    "esModuleInterop": true,                  /* Enables emit interoperability between CommonJS and ES Modules via creation of namespace objects for all imports. Implies 'allowSyntheticDefaultImports'. */
    // "preserveSymlinks": true,              /* Do not resolve the real path of symlinks. */
    // "allowUmdGlobalAccess": true,          /* Allow accessing UMD globals from modules. */

    /* Source Map Options */
    // "sourceRoot": "",                      /* Specify the location where debugger should locate TypeScript files instead of source locations. */
    // "mapRoot": "",                         /* Specify the location where debugger should locate map files instead of generated locations. */
    // "inlineSourceMap": true,               /* Emit a single file with source maps instead of having a separate file. */
    // "inlineSources": true,                 /* Emit the source alongside the sourcemaps within a single file; requires '--inlineSourceMap' or '--sourceMap' to be set. */

    /* Experimental Options */
    // "experimentalDecorators": true,        /* Enables experimental support for ES7 decorators. */
    // "emitDecoratorMetadata": true,         /* Enables experimental support for emitting type metadata for decorators. */

    /* Advanced Options */
    "skipLibCheck": true,                     /* Skip type checking of declaration files. */
    "forceConsistentCasingInFileNames": true  /* Disallow inconsistently-cased references to the same file. */
  }
}

```

其中 `index.ts` 的内容包含如下的调用：

```
Object.entries({
    "a": 1,
    "b": 2,
})
```

由于 `Object.entries` 是 [es2017](https://github.com/microsoft/TypeScript/blob/master/lib/lib.es2017.object.d.ts#L38) 加入的特性，所以如果我们将 `subproject` 单独编译，编译不会通过。我们需要设置 `tsconfig.json` 的 `compilerOptions.lib: ["es2017"]` 或者 `compilerOptions.lib: ["esnext"]` 才可以引用 `lib.es2017.d.ts` 的定义，从而得到 `Object.entries` 的定义。

但是，在 `subproject` 位于某个 TypeScript Project 内部时，即使我们不设定 `compilerOptions.lib: ["es2017"]`，编译也有可能通过！

由于 TypeScript 检索 `@types` 的[机制](https://www.typescriptlang.org/tsconfig#typeRoots)和 NodeJS 相似，它会从当前目录开始，不断查找 `./node_modules/@types`, `../node_modules/@types`, `../../node_modules/@types`, ... 包含的类型定义。

假如某一个上层的类型定义包含了 `Object.entries` 的定义，那么 ts 就会读取这个定义，从而不需要 `compilerOptions.lib: ["es2017"]`，也能编译通过！

如果你希望不要检索上级的 `@types` 目录，可以把 `typeRoots` 设为 `["node_modules/@types"]`，这样 TypeScript 的类型就不会自动被上级目录影响了。

事实上，不光是 TypeScript，NodeJS, Webpack, Babel 等的 Module Resolution 机制，都会受到目录位置的影响。例如 NodeJS 在查找 JS Module 时，也会不断查找 `./node_modules`, `../node_modules`, `../../node_modules`... 中的文件。如果你希望一个内部的 project 可以独立编译，那么即使内部 project 的 `node_modules` 没有相应的 package，只要父级目录的 `./node_modules` 有，那么该内部 project 就可以编译，只是单独拿出来便会缺失依赖。

如何解决这个问题呢？首先，应该避免 project 套 project 的情况，而改成平级的形式，例如 `project` 依赖两个私有 lib `lib1`, `lib2`，那么可以这样安排：

```
├── project
│   └── node_modules
├── lib1
└── lib2
```

然后可以用软连接的方式把 `lib1` 和 `lib2` 引入到 `node_modules` 里面来（[lerna](https://github.com/lerna/lerna) 提供自动化的解决方案）。但是问题是如果你用 VS Code 有时候 TypeScript Server 感知不到 `lib1` 和 `lib2` 内部的变动，对此我除了重启 TS Server 还没有别的办法。也许你可以试试用复制的办法？

如果你必须要 project 套 project，还要保证内部 project 成功独立编译，建议用 git submodules 来管理内部的 project，然后在外部把内部 project clone 一下，涉及编译和依赖的改动尽量在外部的工作区完成，然后同步主 project 的 submodules。

由于种种“feature”，JavaScript Project 管理依赖一直是个头疼的问题，如果你有解决方案，不妨在 github 分享一下。
