---
title: 回顾运算符优先级
slug: revisit-operator-precedence
date: 2021-12-01
abstract: 重新理解运算符优先级，实现简单的中缀表达式 AST
---

## 自顶向下分析的困局

对于 `1 + 2 * 3` 这样的表达式，小学的数学老师会告诉我们， `*` 比 `+` 的“优先级”要高，所以要先算 `*` 后算 `+`，最后的结果是 `1 + 2 * 3 = 1 + (2 * 3) = 1 + 6 = 7`。这对于哪怕小学生来说也是容易理解的，因为人眼会从中间开始解析，我们先找到 `*`，然后看看两边是什么，再去找 `+` 等优先级低于 `*` 的算符。

根据百科[运算符优先级](https://baike.baidu.com/item/%E8%BF%90%E7%AE%97%E7%AC%A6%E4%BC%98%E5%85%88%E7%BA%A7/4752611)，优先级的定义是：

> 表达式的结合次序取决于表达式中各种运算符的优先级。优先级高的运算符先结合，优先级低的运算符后结合，同一行中的运算符的优先级相同。

换到 AST 解析中，所谓运算符优先级高，应该等价于“该运算符对应的语法树深度要更深”。例如 `1 + 2 * 3` 的[Babel 语法树](https://astexplorer.net/#/gist/73b0bad02c9a9f9d4ee8b4d2b48268dd/03c8d6ad3a1a377eed4fcf1324108c5cc4523d0b)如下(删减了位置信息)：

```json
{
  "type": "BinaryExpression",
  "left": {
    "type": "NumericLiteral",
    "value": 1
  },
  "operator": "+",
  "right": {
    "type": "BinaryExpression",
    "left": {
      "type": "NumericLiteral",
      "value": 2
    },
    "operator": "*",
    "right": {
      "type": "NumericLiteral",
      "value": 3
    }
  }
}
```

可以看见，高级别的运算符，在树更深的位置。对这个 AST 求值时，时我们会深度优先地遍历这棵树，因此会先计算乘法，再计算加法。

我们可以用[上下文无关文法](https://baike.baidu.com/item/%E4%B8%8A%E4%B8%8B%E6%96%87%E6%97%A0%E5%85%B3%E6%96%87%E6%B3%95/2001908)来描述这样的表达式：

```
expr -> add $
add -> mul | add + add
mul -> numeric | mul * mul
numeric -> 0 - 9
```

这样我们保证这样文法产生的语法树，mul 的节点一定在某个 add 后面（add 的产生式包含 mul，mul 却不包含 add）。但是这样的语法树，却无法直接转换成自顶到底分析的代码。自顶到底分析要求我们可以通过查看 token 流的当前 token 来判断选择哪个产生式，然而，这里无论 `add` 还是 `mul` 的两个产生式的第一个 token 都是 `numeric`。

一个改版是
```
expr -> add $
add -> mul add_tail
add_tail ->
  + mul add_tail | <empty>
mul -> numeric mul_tail
mul_tail ->
  * numeric mul_tail | <empty>
```
这个改版使得我们可以用自顶向下分析法。例如 `add_tail` 在看到加号的时候选择第一个产生式，否则第二个；`mul_tail` 在看到乘号的时候选择第一个产生式，否则第二个。可行性的问题得到解决，但随之而来一个问题是，如果我们坚持这样的文法，当不同优先级的运算符很多的时候，我们将生成非常深的语法树，不利于后续的处理。例如我们见到 `1 * 2` 这样的表达式的时候，我们希望生成简单的树：

```
   expr
   |
  mul
  / \
 1   2
```

而不是如上文法那样复杂的树：

```
   expr
   |
   add
   |   \
   mul   add_tail
   /  \           \
  1     mul_tail  <empty>
      / \        \     
     *   numeric  mul_tail
         |          |
         1        <empty>
```

这样的树引入了 `add_tail` 这些辅助符号的杂音，让 AST 变得臃肿起来。

而我们仔细观察刚刚的语法树 `1 + 2 * 3`，即使 JS 中有比加号优先级更高的运算符，其也没有在 AST 中出现。Babel 返回的是我们期望的最简单的 AST。

## 带条件的自顶到底分析

为了避免抽象的描述，我们先上分析器的代码。

```js
const pred = {
  '+': 1,
  '*': 2,
}

const code = '1 * 2';

const Lexer = () => {
  let pos = 0;
  let currentToken = undefined;

  const next = () => {
    while (code[pos] === ' ') {
      pos++;
    }

    currentToken = code[pos];
    pos++;

    return currentToken;
  };

  const peek = () => currentToken;

  return {
    next,
    peek,
  };
}

const lexer = Lexer();
lexer.next();

const parseExpr = (level = 0) => {
  const prefix = parsePrefix();

  return parseSuffix(prefix, level);
};

const parsePrefix = () => {
  if (lexer.peek() >= '0' && lexer.peek() <= '9') {
    const value = parseInt(lexer.peek())
    lexer.next();
    return {
      type: 'NumericLiteral',
      value,
    }
  }
  throw new Error();
}

const parseSuffix = (left, level) => {
  while (true) {
    const op = lexer.peek();
    
    if (op === undefined || level >= pred[op]) {
      return left;
    }
    if (pred[op] === undefined) {
      throw new Error('unexpected operator ' + pred[op])
    }
    lexer.next();

    left = {
      type: 'BinaryExpression',
      left,
      operator: op,
      right: parseExpr(pred[op]),
    }
  }
};

console.log(JSON.stringify(parseExpr(), null, 2));
```

你可以修改 `code` 的内容然后观察运行的结果。下面给几个例子：

0. `code = 1`

    ```json
    {
      "type": "NumericLiteral",
      "value": 1
    }
    ```

1. `code = 1 * 2`

    ```json
    {
      "type": "BinaryExpression",
      "left": {
        "type": "NumericLiteral",
        "value": 1
      },
      "operator": "*",
      "right": {
        "type": "NumericLiteral",
        "value": 2
      }
    }
    ```

2. `code = 1 * 2 + 3`

    ```json
    {
      "type": "BinaryExpression",
      "left": {
        "type": "BinaryExpression",
        "left": {
          "type": "NumericLiteral",
          "value": 1
        },
        "operator": "*",
        "right": {
          "type": "NumericLiteral",
          "value": 2
        }
      },
      "operator": "+",
      "right": {
        "type": "NumericLiteral",
        "value": 3
      }
    }
    ```

上面那段程序不同于传统的自顶向下分析。一般的自顶向下分析中，文法元素通常和解析函数一一对应，并且每个解析函数只能返回一个固定类型的元素。这里的 `parseExpr` 则可以返回任意的 `type = 'BinaryExpression' | 'NumericLiteral'` 的节点，而 `parseSuffix` 可以处理任何中缀的运算符，代码也非常简洁。那么它是如何运作的呢？

我们首先观察调用关系。顶层函数是 `parseExpr`，它会先调用 `parsePrefix` 处理一个 `numeric` 符号，然后调用 `parseSuffix`。`parseSuffix` 要么直接返回，要么递归调用 `parseExpr`。

所以假如我们在 `parseSuffix` 执行中任意时刻，调用栈一定是这样的样子：

```
parseExpr level=l_0
  parseSuffix level=l_0
    parseExpr level=l_1
      parseSuffix level=l_1
    ...
    parseExpr level=l_n
      parseSuffix level=l_n     
```

其中 `l_0` 一定是 0（起初传入的默认值）。

此外我们有这样的观察：

```
l_0 = 0 < l_1 < l_2 < ... < l_n
```

因为 `parseSuffix` 调用下一层函数的前提条件是

```js
(level >= pred[op]) === false
```

因为如果这个判断不成立，就会进入 `return left;` 分支返回上层了。

接下来，我们需要证明一个问题，就是 `parseExpr` 可以返回一颗语法树，这个语法树要满足

> 条件 1. 这个树能够正确对应源代码各个语法成分。
>
> 条件 2. 要符合运算符的优先级，即任何树的子节点的优先级大于等于它自己。

第一点不太容易完全证明，但是直观上讲，我们每次建立的节点都源自于 lexer 的解析，不会无中生有；同时解析不会停止，除非我们遇到了文件末尾或者发生文法错误。

为了证明第二点，我们有如下观察（*）：

> （假设输入符合文法）
> 
> 当 `level = l`，在 `parseSuffix` 返回时，当前的 `token` 要么是文件末尾，要么其优先级小于等于 `l`。也可以说，`parseSuffix` 的**副作用**是使得当前读入符号的优先级**小于等于** `l`。

观察 `while` 循环返回的条件可以说明上面的问题。

另外有观察(**)：

> （假设输入符合文法）
> 
> `parseExpr(level)` 会返回优先级大于等于 `level` 的 `BinaryExpression` 或者 `NumericLiteral`。

(1) 接下来我们看 `parseSuffix` 构造 `BinaryExpression` 时，`left` 要么来自参数 `left` 的原始值。这个原始值因为是上级 `parseExpr` 传入的，其为 `NumericLiteral`；要么是来自上一次迭代得到的 `left`，它的 `operator` 是当前从 lexer 读取的 `op`。注意到，如果我们经过了一次迭代，`right: parseExpr(pred[op]),` 这一行肯定已经执行过了，而 `parseExpr` 必然调用下一级 `parseSuffix`。根据观察（*），我们知道当前新一轮的运算符优先级 `pred[op']` 一定比上轮递归调用 的 `pred[op]` 要低，或相等。

```
pred[op'] < pred[op]

=>

pred[left'.operator] < pred[left'.left.operator]
```

(2) 而 `right` 自不必说，根据观察（**）其优先级必然大于等于 `pred[op]`。

根据 (1) (2) 得出任何 `BinaryExpression` 的结点，它的 `left`, `right` 子树的优先级大于等于它自己，所以条件 2 成立。

以上说明了分析器是如何工作的。

通过证明，我们也可以直观地窥见，当 `parseSuffix` 在运行这一行时，实际上是在限制其能 parse 的范围的基础之上（`parseExpr(level)` 只可能返回 `NumericLiteral` 或者优先级严格大于 `level` 的节点），继续进行 parse 的。

```js
left = {
  type: 'BinaryExpression',
  left,
  operator: op,
  right: parseExpr(pred[op]),
}
```

这样让低优先级的算符像“挡板”把表达式隔开——当我们观察到一个高的挡板（优先级低的），在跨过下一个比它更高的挡板之前，只能 parse 更矮的挡板。

```
1 + 2 * 3 + 4 * 5 ^ 6 * 7 
=>
1
+++++++
2
******
3
+++++++
4
******
5
^^^^^
6
******
7
+++++++
```

这和符合人类习惯的解析殊途同归。不过，人类习惯于先找高优先级的符号，然后往两边出发，从高到低“加括号”，实际上我们的脑子里也会有一个语言本能产生的 AST。而计算机则是“随遇而安”，根据看到的符号动态调整自己的解析方法，最后也完成了“加括号”（构建AST）的任务。