---
title: JavaScript 语法细节：词法分析器如何判断下一个 Token 是除号还是正则表达式的开始？
slug: regex-or-division
date: 2022-10-07
abstract: 
---

## 问题来源

当我们需要分析转换 JavaScript/TypeScript 源代码的时候，很多时候[并不需要](https://github.com/alangpierce/sucrase#motivation)分析完整的代码结构，而是利用 JS 的语法特性跳过一些部分，而只分析我们感兴趣的部分。接下来我们提出一个问题：如何在不知道具体 AST 的前提下，在 Lexer 读取到 `/` 的时候，准确判断这是一个除号 `/`，还是一个正则表达式字面量 `/regex/` 的开头？

## 解决思路

在 [ECMAScript Spec](https://tc39.es/ecma262) 没有明确提出 Parser 的实现应该如何处理这两者，但是我们应该明确的是下面两个规则：

1. 如果我们需要一个 `Expression`，那么 `/` 只可能是正则表达式字面量的开头；
2. 如果我们需要一个 `Punctuator`，例如 `, ; { }`，那么 `/` 只可能是除号相关的开头，包括 `/`, `/=`。

那么接下来，我们只要知道何时我们需要一个 `Expression`，就知道接下来是正则还是除法了。

1. 上一个 Token 是中缀运算符，那么下一个 `/` 一定是 `Expression`。例如

    ```js
    call(f, /=/)
    //      ^
    ```

    这里不可能是除号，因为除号前面必须紧跟一个完整的 `Expression`。其他中缀符号也是同样的道理。

    ```js
    a * /=/
    b && /=/
    ```

    即使它语义上是不合理的——我们不能去“乘”或者“且”一个 `RegExp`。
  
2. 上一个 Token 是前缀运算符，例如 `+ ++`，同样的道理，下一个 `/` 一定是 `Expression`。
3. 上一个 Token 是括号的结束，也就是 `) ] }`，这是一个稍微复杂的问题。假如我们武断地认为 `)` 后面的 `/` 一定是除号： 

    ```js
    (a + b) / 3
    //      ^

    call() / 4
    //     ^
    ```

    好像确实没错。但是考虑下面和关键字 `if`, `while`, `for` 有关的情况：

    ```js
    if (something)
      /regex/.text(something);
    //^

    while (something)
      /regex/.text(something);
    //^

    for (let i = 0; i < 1; i++)
      /regex/.text(something);
    //^
    ```

    虽然我们在一个圆括号结束 `)` 的下一个 Token 开头，但是这里却可以放一个 `Expression`！事实上这里是任意 `Statement` 的开头。

    因此，我们还需要考虑关键字附带的括弧的情况。为了判断当前的括弧是否属于 `if`, `while`, `for` 关键字，我们还需要处理括号栈的情况。

    我们后面需要详细讨论括号的问题。

4. 上一个 Token 是 `Identifier` 或者 `Literal`。很显然，我们不能有像下面的代码，因为这里出现了连续两个原子 `Expression`：

    ```js
    id /regex/
    "string" /regex/
    213 /regex/
    ```

    因此下一个 `/` 一定是除号。

5. 关键字 + `Expression`。下面这些关键字后可以接 `Expression`，因此 `/` 应该判断为 `RegExr`。

    ```js
    case, debugger, delete, do, else, in, instanceof, new, return, throw, typeof, void, yield, await
    ```

    例如 

    ```js
    return /regex/;
    //     ^
    for (const i in /[0-9]/.exec("123")) {}
    //              ^
    ```

## 括号的难题

### 圆括号 `()`

根据上面的讨论，我们可以把圆括号分为两类：

1. 与 `Expression` 相关的圆括号，包括优先运算的圆括号、`call()` 调用函数的圆括号、`function f() {}` `() => {}` 参数列表的圆括号。
2. 与 `if`, `while`, `for` 相关的圆括号。

我们只需要提取出所有第二种的圆括号，就可以判断当前的 `)` 之后是不是 `Expression` 了！

### 方括号 `[]`
  
JS 中的方括号，都是与 `Expression` 结合的，例如：

```
arr[0]
const arr = [1, 2, 3]
```

因此 `]` 表明了一个 `Expression` 的结尾，后面一定是除号。

### 花括号 `{}`

JavaScript 中的花括弧，同样分成两种
1. 表示一个 `Block` 的花括弧。例如 
    ```js
    function () {}
    //           ^

      {
        doSomething();
      }
    //^

      {
        a
      }
    //^
    ```

    注意第三种情况 `{ a }` 会被处理成一个块，而不是对象字面量 `{ a: a }`。这几种情况，后面都不可以跟除号，因此 `/` 表示一个 `RegExp` 开头。


2. 表示一个对象字面量

    ```js
    const object = { a }
    ```

    这种情况，`{ a }` 是一个 `Expression`，后面不能直接跟 `Expression`，因此 `/` 表示除号。


3. ESM Import/Export

    ```js
    import { a } from 'something';
    export { a } from 'something';
    ```

    这种情况 `}` 后面既不能是除号也不能是 `RegExp`。

    对于花括弧的情况，我们需要跟踪这个 `}` 是某个 Block 的 `{` 对应的，还是某个对象字面量对应的。两种情况下，后面的判断情况会不同。这种情况，实际上在不知道 AST 的情况下非常棘手，因为我们遇到一个 `{` 的时候，需要知道当前是不是在一个“把 `{` 解释成字符串字面量”的环境下。

    我们来观察几种情况：

    ```js
      {} // 字面量 {}
    //^
      { a } // Block
    //^
      { a: 1 } // 字面量 
    //^
    ```

    在不知道完整 AST 的前提下，我现在没有什么好办法判断 `{` 是不是 `Block`。这导致如果我们总认为 `}` 后面不可以跟 `/regex/` 的情况下，可能会拒绝下面这样完全合理的代码：

    ```js
    {
      doSomething();
    }

    /regex/.text("something");
    ```

    而 `/regex/` 的 `/` 不应该解析为 `/`。

    而如果我们认为 `}` 后方总是可以接 `/regex/` 的话，则

    ```js
    const a = { a: 1 } /regex/ 2; 
    ```

    会被认为无效的代码，虽然它只是语义上有问题，而语法上完全没有问题。

    假如我们激进的认为，`}` 后面的 `/` 一定是 `/regex/`，这样至少我们可以拒绝掉对象字面量在左手边的除法运算，我认为不失为一种 "trash in trash out" 的简单办法。

## 应用

NodeJS 的依赖 [cjs-module-lexer](https://github.com/nodejs/cjs-module-lexer) 中，实现了一个简单的词法分析器，用于提取所有像

```js
module.exports = { a };
exports.b = b;
```

这样的 CommonJS Export。出于简单和性能的考虑，`cjs-module-lexer` 没有完全处理 JS 的语法树，而是简单的处理了 Token。由于需要忽略像

```js
"exports.b = b"
```

这样的假 Export，我们需要跳过字符串。为了准确判断字符串的位置，我们还需要跳过正则表达式中的 `"`，也就是需要确定正则表达式的位置。这引出了上述一个关键的问题：遇到 `/` 的时候，是除号还是正则表达式？

事实上 `cjs-module-lexer` 在处理花括弧的时候，也没能完美判断 `}` 后方是正则还是除号，可以尝试在 [CJS Module Lexer Playground](https://cjs-module-lexer-playground.vercel.app?code=ICAgIHsKICAgICAgZG9Tb21ldGhpbmcoKTsKICAgIH0KCiAgICAvWyhdLy50ZXh0KCJzb21ldGhpbmciKTs=&parser=cjs-module-lexer) 下面输入

```js
    {
      doSomething();
    }

    /[(]/.text("something");
```

会得到下面的报错，尽管这是完全合法有意义的 JS。可以参考 acorn 的[结果](https://astexplorer.net/#/gist/92c9bd4fc0b79be78d2d00b3f144cee4/e6f38aebd2275d82dc588346f94c24aacd825d82)。

```
"Error: Parse error playground.js0:1:1"
```

## 参考资料

https://stackoverflow.com/questions/5519596/when-parsing-javascript-what-determines-the-meaning-of-a-slash