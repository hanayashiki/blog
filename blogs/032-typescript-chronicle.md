---
title: TypeScript 类型编年史
slug: typescript-chronicle
date: 2026-09-05
abstract: TypeScript 支持类型的演进历史
---

TypeScript 1.0 于 2014 年发布，而现在（2026），已经迁移到 Go 的 TypeScript 进入了 7.0 版本。TS 的发迹史，Anders Hejlsberg 在访谈中讲过很多，但作为一个对编程语言理论抱有兴趣的工程师，我更想从它类型支持的演进角度切入，观察它是如何从简单变复杂的。

注意：本文基于对仓库 [https://github.com/Microsoft/TypeScript](https://github.com/Microsoft/TypeScript) 的历史分析。最早能追溯到的版本是 1.0.1。此前历史未开源。

## 最古早的类型（v1.0.1，2014-07-12）

最早的 TS 版本仅仅是一个约 14000 行的小项目。有意思的是 [checker.ts](https://github.com/microsoft/TypeScript/blob/214df64e287804577afa1fea0184c18c40f7d1ca/src/compiler/checker.ts) 此时已经有 5000 多行，超过了 1/3 的体量。之后它将会发育成八万多行的巨型模块。

### 全部能写的类型

当时的语言规范里，类型只有四种来源：关键字、名字、`typeof` 查询、类型字面量。
关键字一共五个——`any`、`number`、`boolean`、`string`、`void`。没了。

```ts
interface Store {
  name: string;                 // 属性
  version?: number;             // 可选属性
  tags: string[];               // 数组
  get(k: string): any;          // 方法
  new (n: number): Store;       // 构造签名
  [k: string]: any;             // 索引签名
}

var f: (a: number, b?: string) => void;   // 函数类型，b 是可选参数
var c: new (n: number) => Store;          // 构造函数类型
var q: typeof f;                          // 类型查询
```

这段在 2014 年的编译器下零报错。它已经覆盖了今天绝大部分 `.d.ts` 的日常写法：
结构化的对象类型、可选属性和可选参数、索引签名、构造签名。

有趣的是，`?` 在这里只表示"这个成员可以缺席"，和类型无关 —— `version` 的类型就是 `number`，不是 `number | undefined`。`?` 变成"并上一个 `undefined`"要等 2.0 的 `strictNullChecks`，何况此时还不存在 1.4 才有的联合类型。

### `any` 既是所有类型的子类型也是父类型

```ts
var a: any = 0;
var b: number = <any>("casted");
```

任何类型都可以赋给 `any`，`any` 也可以赋给任何类型。语义上不存在这样的值，但它是 TS 向工程现状妥协的标志。在生态和人力的制约下，无法标注所有类型时，`any` 就是简单粗暴的逃生舱。

### 枚举：结构化系统里的第一个例外

```ts
enum A { X }
enum B { X }

var a: A = B.X;      // Type 'B' is not assignable to type 'A'.
var n: number = A.X; // 通过
var a2: A = 1;       // 通过
```

两个结构完全相同的枚举互不兼容，但枚举和 `number` 双向兼容。
在一门以结构化子类型为基础的语言里，这是第一处按名字而不是按结构判断的地方。

### 字符串字面量类型：只能出现在一个位置

`"read"` 在 2014 年就已经是一个类型了。但它只允许出现在**函数参数的类型注解**上，
而且这个函数必须是一个没有函数体的重载签名。规范说得很死：

> String literal types are permitted only in that context and nowhere else.

写在别处连语法都过不了：

```ts
var mode: "read";
// (1,11): Type expected.
```

带函数体也不行：

```ts
function g(k: "a"): number { return 1; }
// (1,1): A signature with an implementation cannot use a string literal type.
```

还有一条额外规则：每个用了字符串字面量的签名，必须能赋值给同一个对象类型里
至少一个没用字符串字面量的签名。也就是说，字面量重载只能当作"更精确的特例"，
不能凭空引入新能力：

```ts
interface E { h(k: "a"): number; }
// (1,15): Specialized overload signature is not assignable to any non-specialized signature.
```

补上兜底签名就对了：

```ts
interface D {
  get(k: "a"): number;
  get(k: "b"): string;
  get(k: string): any;    // 兜底签名必须写在最后
}

var d: D;
var n: number = d.get("a");   // 通过
var s: string = d.get("b");   // 通过
var w: number = d.get("b");   // Type 'string' is not assignable to type 'number'.
```

这个特性为什么会存在，规范第一章里写得非常直白：

> An important goal of TypeScript is to provide accurate and straightforward types
> for existing JavaScript programming patterns. [...] JavaScript programming interfaces
> often include functions whose behavior is discriminated by a string constant passed
> to the function. The Document Object Model makes heavy use of this pattern.

不是从类型论推出来的，是从 DOM 逆推出来的。当时随编译器分发的 `lib.dom.d.ts` 里，
光 `createElement` 就手写了 121 个重载：

```ts
createElement(tagName: "a"): HTMLAnchorElement;
createElement(tagName: "abbr"): HTMLPhraseElement;
createElement(tagName: "acronym"): HTMLPhraseElement;
createElement(tagName: "address"): HTMLBlockElement;
// ... 共 121 行
```

整个文件里带字符串字面量参数的声明有 1871 行，`addEventListener` 也是同样的手写重载堆。

这个特性可以说完全是为了标注 DOM API，而非完美支持 Literal Type。

### 泛型：2014 年就已经很完整

泛型是 0.9（2013-06）加的，早于这个仓库的历史。到 1.0 时它已经是成品：
类型参数、约束、约束互相引用、类型实参推断、泛型类、泛型方法，全都在。

规范里的例子，逐字拿来跑：

```ts
interface A { a: string; }
interface B extends A { b: string; }
interface C extends B { c: string; }

interface G<T, U extends B> { x: T; y: U; }

var v1: G<A, C>;               // 通过
var v2: G<{ a: string }, C>;   // 通过，结构化，等价于 G<A, C>
var v3: G<A, A>;               // Type 'A' does not satisfy the constraint 'B':
                               //   Property 'b' is missing in type 'A'.
var v6: G<any>;                // Generic type 'G<T, U>' requires 2 type argument(s).
var v7: G;                     // Generic type 'G<T, U>' requires 2 type argument(s).
```

约束是结构化检查的（`{ a: string }` 直接满足 `A`），错误信息也已经会展开到具体缺哪个属性。

推断也早就能穿过回调：

```ts
var xs: Array<number> = [1, 2, 3];
var ys = xs.map(function (n) { return n.toFixed(2); });
// ys 推断为 string[]，回调参数 n 推断为 number
```

泛型类和泛型方法可以嵌套，类型参数之间可以互相约束：

```ts
class Pair<K extends { id: number }, V> {
  constructor(public k: K, public v: V) {}
  swap<W>(w: W): Pair<K, W> { return new Pair(this.k, w); }
}
```

零报错。今天写这段代码，一个字都不用改。

泛型在 2014 年缺的只有两样：**默认值**和**泛型类型别名**。

```ts
interface Box<T = string> { v: T; }   // (1,17): ',' expected.
type Wrap<T> = { v: T };              // (1,6): ';' expected.
```

第一个要等 2.3（2017），第二个要等 1.6（2015）——因为 1.0 连类型别名本身都还没有。

**TS 1.0 的语言复杂度，在今天的大模型加持下，一个下午就能实现出来。**

### 还未支持的类型

联合类型（1.4）：

```ts
var x: string | number;
// (1,15): ',' expected.
```

类型别名（1.4）：

```ts
type Name = string;
// (1,6): ';' expected.
```

元组（1.3）：

```ts
var x: [string, number];
// (1,8): Type expected.
// (1,9): ']' expected.
```

任意位置的字符串字面量类型（1.8）：

```ts
var mode: "read";
// (1,11): Type expected.
```

泛型类型别名（1.6）、泛型参数默认值（2.3）：

```ts
type Wrap<T> = { v: T };            // (1,6): ';' expected.
interface Box<T = string> { v: T; } // (1,17): ',' expected.
```

`readonly`（2.0）：

```ts
interface I { readonly x: number; }
// (1,15): Property or signature expected.
```

`as` 语法断言（1.6）：

```ts
var y = x as string;   // (1,23): ',' expected.
var y = <string>x;     // 通过
```

`<string>x` 是早期的语法，很显然是抄的 C#。

`let` / `const`（1.4）：

```ts
let a = 1; const b = 2;
// (1,5): ';' expected.
```

收窄（1.4 类型守卫，2.0 控制流分析）——语法能过，类型不变：

```ts
class A { a: number; }
class B extends A { b: number; }
function f(x: A) {
  if (x instanceof B) { x.b; }
  // Property 'b' does not exist on type 'A'.
}
```

`null` / `undefined` 不是独立类型（2.0 `strictNullChecks`）——不报错：

```ts
var s: string = null;
var t: number = undefined;
```

## Tuple, Union (|), Type Guards, Intersection (&)（v1.3 ~ 1.6，2014-10-27 ~ 2015-09-11）

### Tuple（1.3）

```ts
var t: [number, string];
```

JS 没有定长数组类型，Tuple 是一个不太直观的抽象 —— 可 TS 在相当早期就引入了它。不少读者在工作中可能并不会亲手定义 Tuple。

```ts
var t0 = t[0];   // number
var t1 = t[1];   // string

t = [];               // Error
t = [1];              // Error
t = [1, "hello"];     // Ok
t = ["hello", 1];     // Error
t = [1, "hello", 2];  // Ok，多出来的元素不检查
```

元组在标准库里的第一个消费者是 ES6 的 `Map` / `Set`。ES6 规范当时正在定稿（2015-06 批准），
`Map` 的构造和迭代协议全部建立在键值对上。

```ts
var m = new Map<string, number>([["a", 1], ["b", 2]]);

for (var e of m.entries()) {
  // e: [string, number]
}
```

元组是先为 ES6 集合类型准备的，日常代码里手写元组要等到解构（1.5）普及之后。

### 联合类型（1.4）

联合类型（Union Type）可谓是建模动态语言的重要工具，可它到 1.4 才姗姗来迟。在这之前，大多数能接受两个及以上类型的位置，都只能无奈地标注为 `any`。联合类型是 TS 灵活性和严格性的重要构成成分，但要注意，在 `null`、`undefined` 还不是类型的年代，我们现在习以为常的 nullable type `number | null` 还写不出来。

下面给出例子。

```ts
var x: string | number;
var test: boolean;

x = "hello";            // Ok
x = 42;                 // Ok
x = test;               // Type 'boolean' is not assignable to type 'string | number'.
x = test ? 5 : "five";  // Ok
x = test ? 0 : false;   // Type 'number | boolean' is not assignable to type 'string | number'.
```

`null` 是个例外。1.4 时期它还是所有类型的子类型，所以往联合里塞 `null` 不报错，
`string | null` 这种写法也不存在：

```ts
var x: string | number;
x = null;               // 1.4: 通过
x = undefined;          // 1.4: 通过

var y: string | null;   // 1.4: Type expected.
```

引入的理由，看 DOM 声明文件在这个版本前后的差别最直接。1.3 的 `lib.dom.d.ts`：

```ts
createImageData(imageDataOrSw: any, sh?: number): ImageData;
createPattern(image: HTMLElement, repetition: string): CanvasPattern;
drawImage(image: HTMLElement, offsetX: number, offsetY: number, ...): void;
```

`createImageData` 的第一个参数在运行时接受 `number` 或 `ImageData`，写不出来，标成 `any`，
检查直接关掉。`createPattern` 和 `drawImage` 只接受 `<img>` / `<canvas>` / `<video>` 三种元素，
写不出来，标成公共基类 `HTMLElement`，于是传 `<div>` 也不报错。

1.6 的同一个文件：

```ts
createImageData(imageDataOrSw: number | ImageData, sh?: number): ImageData;
createPattern(image: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
              repetition: string): CanvasPattern;
height: string | number;
```

#### 赋值规则

规范里只有四条，两两对称：

- `A | B` 可以赋给 `T`：要求 `A` 和 `B` **都**能赋给 `T`
- `T` 可以赋给 `A | B`：要求 `T` 能赋给 `A` **或** `B` 之一

```ts
declare var u: string | number;
var s: string = u;   // Error：number 不能赋给 string
var a: any = u;      // Ok：string 和 number 都能赋给 any

var v: string | number;
v = "x";             // Ok
v = 42;              // Ok
v = true;            // Error
```

#### 哪些表达式会产生 union

不需要手写 `|`，1.4 之后有三处会自动生成联合类型：

```ts
declare var s: string; declare var n: number; declare var t: boolean;

var a = t ? s : n;        // string | number   条件表达式
var b = s || n;           // string | number   || 运算
var c = [1, "x", true];   // (string | number | boolean)[]   数组字面量
```

第三条替换掉了 1.3 那套 best common type 的做法。以前 `[1, "x"]` 挑不出公共类型，
退化成 `{}[]`；现在直接是 `(string | number)[]`。

数组字面量里如果元素之间存在子类型关系，仍然会先归约再决定：

```ts
class Animal { a: number }
class Dog extends Animal { d: number }

var xs = [new Dog(), new Animal()];   // Animal[]，不是 (Dog | Animal)[]
```

重复的成分也会去掉，`string | string` 就是 `string`。

#### 分配（distribution）

联合类型最核心的一条规则：**对联合做的操作，逐个成分做完再合并**。1.4 落地时这条规则
体现在属性访问和函数调用上。规范给的例子：

```ts
interface A { a: string; b: number; }
interface B { a: number; b: number; c: number; }

declare var x: A | B;

x.a   // string | number   两边类型不同，结果是联合
x.b   // number            两边都是 number，合并后不产生联合
x.c   // Error: Property 'c' does not exist on type 'A | B'.
```

三条结果对应三种情况：类型不同就分配成联合；类型相同就直接是那个类型；
**只要有一个成分缺这个属性，就整个不能访问**。最后一条是联合类型安全性的来源——
你拿到的值只可能是其中一个，所以只能碰它们都有的东西。

方法调用同理，分配发生在返回类型上：

```ts
interface A { f(): string }
interface B { f(): number }

declare var x: A | B;
x.f()   // string | number
```

1.4 时期这条规则要求各成分的调用签名"除返回类型外完全一致"，
否则整个联合就没有调用签名：

```ts
declare var g: ((x: string) => void) | ((x: number) => void);
g("a");
// 1.4: Cannot invoke an expression whose type lacks a call signature.
```

返回值分配、参数取交叉，这个方向上的不对称在后面会反复出现（比如 `keyof (A | B)`
等于 `keyof A & keyof B`）。

#### 赋值方向上不分配

读的时候分配，写的时候不分配，这里 1.4 到今天都是不安全的：

```ts
interface A { p: string }
interface B { p: number }

declare var x: A | B;
x.p = "s";   // 1.4 到 5.8 都不报错
```

`x` 运行时可能是 `B`，`B.p` 是 `number`，但检查器把写入目标当成 `string | number`，
`"s"` 就通过了。

#### 联合类型在泛型参数位置

1.4 的联合类型在地位上与其他类型无异：

```ts
interface Box<T> { v: T }
var b: Box<string | number>;       // Ok，b.v 是 string | number

declare function id<T>(x: T): T[];
declare var u: string | number;
var r = id(u);                     // T 推断为 string | number，r 是 (string | number)[]

declare function f<T extends string>(x: T): T;
f(u);                              // Argument of type 'string | number' is not assignable
                                   // to parameter of type 'string'.
```

需要注意的是，Union Type 此时还没有分配律 —— 经典的 `Extract` helper type 还不存在，因为 `T` 必须作为类型参数、且直接位于 `extends` 左边才会触发分配：

```ts
type Extract<T, U> = T extends U ? T : never;

type Status = "success" | "error" | "pending" | 404 | 500;
type NumericErrors = Extract<Status, number>; // type NumericErrors = 404 | 500
```

在这段 2.8 以后才成立的语法（条件类型）中，`Status` 被拆散并逐个和 `number` 比较，是子类型的留下，不是的过滤掉。

表示空联合的 `never`（2.0），此时也尚不存在。

### 类型守卫（1.4 / 1.6）

联合类型只解决了"怎么写下来"。要用它，必须能把 `string | number` 缩回 `string`。
JS 代码本来就在用 `typeof` 和 `instanceof` 做这件事，检查器要做的是把这些运行时判断读进类型系统：

```ts
function foo(x: number | string) {
  if (typeof x === "string") {
    return x.length;   // x: string
  } else {
    return x + 1;      // x: number
  }
}
```

今天常见的 `instanceof C` 也在此版本推出。但早期版本的分析粒度更粗、规则更少，许多今天能自动收窄的地方，当年需要手动标注。

### 交叉类型（1.6）

针对的 JS 写法是**在运行时把两个对象合并成一个**：`$.extend`、`_.assign`、
`Object.assign`、mixin 工厂、React 的 props 合并。这类函数的返回值同时具备两组成员，
在 1.6 之前只能返回 `any`。

规范给出的动机例子就是这个：

```ts
function extend<T, U>(first: T, second: U): T & U {
  // 把 second 的属性拷进 first
}

var x = extend({ a: "hello" }, { b: 42 });
var s: string = x.a;    // Ok
var n: number = x.b;    // Ok
var bad: number = x.a;  // Type 'string' is not assignable to type 'number'.
```

## Strict Null Checks, readonly（v2.0，2016-09-22）

2.0 干了一件前面所有版本都没干过的事：**撤销规则**。1.0 规范里白纸黑字写着 Null 和 Undefined 是所有类型的子类型，2.0 把这条删了。删一条已经用了两年半的规则，意味着几乎所有存量代码都会开始报错，所以它只能做成一个开关 —— 这就是 `--strictNullChecks` 的由来，也是后来 tsconfig 里那一大排 `strict*` 开关的源头。从今天来看，2.0 是 TS 从工程妥协转向严格化的标志性版本。

### `readonly`（2.0）

在对象类型中，之前没有任何办法表达"这个属性不许改"，而 `readonly` 可以标注该属性不可再赋值。

```ts
interface P { readonly id: number }

declare var p: P;
p.id = 1;
// Left-hand side of assignment expression cannot be a constant or a read-only property.

var a: ReadonlyArray<number> = [1, 2];
a.push(3);   // Property 'push' does not exist on type 'ReadonlyArray<number>'.
a[0] = 9;    // Left-hand side of assignment expression cannot be a constant or a read-only property.
```

`readonly` 只管一层。它约束的是"不能给这个属性重新赋值"，属性指向的东西该怎么改还怎么改：

```ts
interface Inner { v: number }
interface Outer { readonly inner: Inner; readonly list: number[] }

declare var o: Outer;

o.inner = { v: 1 };   // Error，不能重新赋值
o.inner.v = 99;       // Ok，里面随便改
o.list.push(1);       // Ok
o.list[0] = 9;        // Ok
```

想让 `list` 真的不可变，得把它的类型也换掉，写成 `readonly list: ReadonlyArray<number>`。TS 至今没有内置的深度只读。

`ReadonlyArray<T>` 不是什么特殊构造，就是标准库里手写的一个 interface，把 `Array<T>` 上会改动自身的方法删掉，再给 `length` 和下标签名加上 `readonly`：

```ts
interface ReadonlyArray<T> {
  readonly length: number;
  readonly [n: number]: T;
  concat(...): T[];  slice(...): T[];  map(...): U[];   // 返回新数组的都留着
  // push / pop / shift / unshift / splice / sort / reverse / fill / copyWithin 一个都没有
}
```

所以它和 `Array<T>` 之间没有任何声明上的关系 —— `interface Array<T>` 并不带 `extends ReadonlyArray<T>`。两者的关系纯粹是结构化推出来的：`Array<T>` 是 `ReadonlyArray<T>` 的子类型。

```ts
var a: number[] = [1, 2];
var r: ReadonlyArray<number> = a;   // Ok，Array 有 ReadonlyArray 要求的全部成员

declare var r2: ReadonlyArray<number>;
var a2: number[] = r2;
// Type 'ReadonlyArray<number>' is not assignable to type 'number[]'.
//   Property 'push' is missing in type 'ReadonlyArray<number>'.
```

此外，有意思的是 `readonly` 从一开始就有个洞：**它不参与赋值兼容性检查**。

```ts
interface RO { readonly x: number }
interface RW { x: number }

declare var ro: RO;
var rw: RW = ro;   // 2.0 到 5.8 都不报错
rw.x = 99;         // 于是就改掉了
```

先赋给一个可写的类型，再重新赋值，只读就被绕开了。这是 TS 对工程现状的一贯妥协 —— 如果 `readonly` 参与结构化兼容，大量把 `readonly` 加进 `.d.ts` 的改动都会变成 breaking change。但 3.4 引入的 `readonly T[]` 并不允许这样的赋值：

```ts
declare const a: readonly number[];
const b: number[] = a;
// 5.8: The type 'readonly number[]' is 'readonly' and cannot be assigned to the mutable type 'number[]'.
```

同一个修饰符，作用在属性上不检查，作用在数组上检查。

### `strictNullChecks`（2.0）

打开这个开关之后，`null` 和 `undefined` 从"万能子类型"变成了两个普通的类型成分：

```ts
var s: string = null;        // Type 'null' is not assignable to type 'string'.
var t: number = undefined;   // Type 'undefined' is not assignable to type 'number'.

var u: string | null = null; // 要写成这样
var v: string | undefined;
```

为了服务于 nullish check，此版本还引入了更完善的控制流分析（`if (u !== null) { ... }`）和非空断言 `!`，写起来和今天打开 `strict: true` 的 TS 已经很像。2.0 时还不存在 `strict: true`，之后严格选项越来越多，才有了这个总开关。

## keyof T, T[K], Mapped Types（v2.1，2016-12-05）

前面所有的类型特性，无论联合、交叉还是元组，做的都是同一件事：描述一个值长什么样。2.1 是分水岭 —— 从这个版本起，类型可以拿另一个类型当输入去算出新的类型。今天大家熟悉的 `Partial`、`Pick`、`ReturnType` 这些"类型函数"，源头都在这里。

### `keyof T`

```ts
interface P { name: string; age: number }

var k: keyof P;   // "name" | "age"
k = "name";       // Ok
k = "nope";       // Type '"nope"' is not assignable to type '"name" | "age"'.
```

`keyof P` 的结果是一个字符串字面量联合。1.8 那个"可以随便写在任何位置的字符串字面量类型"，直到这里才真正兑现价值 —— 在此之前它主要用来手写 DOM 重载，属于给标准库作者用的东西；有了 `keyof`，它变成了每个业务代码都会碰到的类型。

顺带一提，2.1 的 `keyof` 只认字符串键。`keyof any` 在当年是 `string`，数字和 symbol 键要等到 2.9 才补上，今天它是 `string | number | symbol`。

### `T[K]`

用 `K` 可以取出 `T` 中对应属性的类型，写法和 JS 的属性访问 `obj[key]` 类似。

```ts
interface P { name: string; age: number }

// 值的层面：从一个对象里取属性
declare var p: P;
var v = p["name"];      // string

// 类型的层面：从一个类型里取属性的类型
type N = P["name"];     // string
type A = P["age"];      // number
```

两行长得一模一样，区别只在于左边一个是值、一个是类型。键传联合进去，取出来的也是联合：

```ts
type B = P["name" | "age"];   // string | number
type C = P[keyof P];          // string | number，等价写法
```

不过有一处和 JS 不同：键不存在时，`p["nope"]` 在运行时是 `undefined`，类型层面则直接拒绝。

```ts
type D = P["nope"];
// Property 'nope' does not exist on type 'P'.
```

配上 `keyof` 做约束，就能写出那个从 2.1 开始随处可见的取值函数：

```ts
declare function get<T, K extends keyof T>(o: T, k: K): T[K];

var a: string = get(p, "name");   // Ok
var b: number = get(p, "age");    // Ok
var c: string = get(p, "age");    // Type 'number' is not assignable to type 'string'.
get(p, "nope");                   // Argument of type '"nope"' is not assignable to
                                  // parameter of type '"name" | "age"'.
```

2.1 之前这个函数的返回类型只能是 `any`。而 `obj[key]` 这种写法在动态语言里是绕不开的，lodash 的 `_.get`、`_.pick`，ORM 的 `select`，表单库的字段路径，全都建立在它上面。

### Mapped Types

`{ [P in K]: X }` 是类型层的 `for...in`。2.1 同时把四个工具类型塞进了标准库：

```ts
type Partial<T>  = { [P in keyof T]?: T[P] };
type Readonly<T> = { readonly [P in keyof T]: T[P] };
type Pick<T, K extends keyof T> = { [P in K]: T[P] };
type Record<K extends string, T> = { [P in K]: T };
```

下面三条是映射类型里比较有意思的部分。

#### 一、同态映射会保留 `?` 和 `readonly`

当映射的键来源写成 `keyof T` 时（规范里叫同态，homomorphic），原类型上的可选标记和只读标记会被一起搬过去：

```ts
interface P { readonly id: number; name?: string }

type M = { [K in keyof P]: P[K] };   // 看起来只是原样拷贝

declare var m: M;
m.id = 1;
// Cannot assign to 'id' because it is a constant or a read-only property.

var s: string = m.name;
// (strictNullChecks) Type 'string | undefined' is not assignable to type 'string'.
```

注意这段代码里没有任何地方写了 `readonly` 或 `?`，它们是被规则自动带过来的。这不是从语法推出来的结果，而是检查器对 `keyof T` 这个形状的特判 —— 换成 `{ [K in "id" | "name"]: P[K] }`，修饰符就丢了。`Partial<T>` 之所以能"只加一个 `?`、其他不变"，靠的正是这条规则。

#### 二、同态映射对联合分配

```ts
interface A { a: string }
interface B { b: number }

declare var x: Partial<A | B>;   // Partial<A> | Partial<B>
```

前面讲联合时提过，普通的泛型实例化不分配，`Box<A | B>` 就是 `Box<A | B>`。可映射类型是个例外，它会拆开联合逐个映射再合回去。

时间上这一点值得留意：映射类型的分配是 2.1（2016-12）就有的，比条件类型那条广为人知的分配律（2.8，2018-03）早了一年半。也就是说"对联合逐成分求值"这个想法，最先是在映射类型上试出来的。

#### 三、映射类型可以反着推

这是 2.1 里最出乎意料的一个能力。映射类型不只能从 `T` 算出结果，编译器还能从结果反推 `T`：

```ts
declare function unbox<T>(o: { [K in keyof T]: { value: T[K] } }): T;

var r = unbox({ a: { value: 1 }, b: { value: "s" } });
// r 的类型是 { a: number; b: string }
```

参数类型是一个映射类型，实参是一个具体对象，编译器要做的是解方程：什么样的 `T` 经过这个映射会得到实参的形状。答案是把每个属性的 `{ value: X }` 剥掉一层。这个特性叫 reverse mapped type，在 2.1 的 PR 里就已经一并实现了，今天 Vue 的 `props` 推断、各种 schema 库的 `infer` 都在用它。

### 2.1 时还做不到的

映射类型在 2.1 只能改值的类型和修饰符，键本身动不了，也不能去掉可选性 `?`。

```ts
type R = { [K in keyof P]-?: P[K] };
// 2.1: ';' expected.
```

## strict 家族（v2.3 ~ 4.4，2017-04-04 ~ 2021-08-24）

2.0 用 `--strictNullChecks` 开了个头之后，"想加一条更严的规则，就做成一个开关"变成了固定套路。开关越加越多，用户得挨个往 tsconfig 里补，于是 2.3 给了个总开关：

2.3 引入 `--strict`，`tsc --init` 生成的模板里那行 `"strict": false` 被改成了 `"strict": true`。后半件事才是关键 —— 严格模式从"要主动打开的选项"，变成了新项目的事实默认。

`strict` 的实现是"子开关没显式设置时取 `strict` 的值"，这带来一个副作用：**它是一个会长大的开关**。每个新版本往里塞一个子项，你的项目升级 TypeScript 之后就会多出一批错误，而 tsconfig 一个字都没改。今天它底下有九个：

| 子开关 | 加入版本 |
|---|---|
| `noImplicitAny` | 1.0（元老，早于 `strict` 本身） |
| `strictNullChecks` | 2.0 |
| `noImplicitThis` | 2.0 |
| `alwaysStrict` | 2.1 |
| `strictFunctionTypes` | 2.6 |
| `strictPropertyInitialization` | 2.7 |
| `strictBindCallApply` | 3.2 |
| `useUnknownInCatchVariables` | 4.4 |
| `strictBuiltinIteratorReturn` | 5.6 |

下面挑四个和结构化类型直接相关的讲，其余的大多是静态分析或运行时安全方面的问题，在此不论。

### `strictFunctionTypes`（2.6）

TS 从 1.0 起，函数参数就是 bivariant 的：`(x: Dog) => void` 和 `(x: Animal) => void` 可以互相赋值。这在类型论上是错的 —— 一个只会处理 `Dog` 的函数，不能拿去当"能处理任何 `Animal`"用。2.6 把它改成了正确的逆变检查。

有意思的是这个修正只改了一半。同一个类型写成两种语法，检查规则不同：

```ts
class Animal { a: number; }
class Dog extends Animal { d: number; }

interface WithMethod { f(x: Dog): void }        // 方法语法
interface WithProp   { f: (x: Dog) => void }    // 属性语法

declare var m: WithMethod;
declare var p: WithProp;

var m2: { f(x: Animal): void } = m;        // Ok，方法语法仍然双变
var p2: { f: (x: Animal) => void } = p;    // Error
// Type '(x: Dog) => void' is not assignable to type '(x: Animal) => void'.
//   Types of parameters 'x' and 'x' are incompatible.
//     Type 'Animal' is not assignable to type 'Dog'.
```

`f(x: Dog): void` 和 `f: (x: Dog) => void` 描述的是同一个东西，但前者按老规则、后者按新规则检查。

留这个例外的原因很实际 —— 数组：

```ts
var xs: Animal[] = [] as Dog[];   // 不报错，但允许往本来只放 Dog 的数组里插入非 Dog 的元素 —— 运行时不安全
```

`Array<T>` 的 `push`、`indexOf` 这些方法在标准库里都是用方法语法（双变）声明的，如果方法也走逆变，`Dog[]` 就不能赋给 `Animal[]` 了。而这个写法在存量代码里到处都是。所以 2.6 的做法是：把逆变检查加进来，但给"方法"留一扇后门，让标准库和大部分面向对象代码继续按老规则走。

### `noUncheckedIndexedAccess`（4.1）

`arr[i]` 在 JS 里可能返回 `undefined`，可 TS 一直当它必定有值。这个开关把下标访问的结果并上 `undefined`：

```ts
const arr: string[] = ["a", "b"];
const t: [string, number] = ["a", 1];
const rec: Record<string, number> = {};

arr[0];       // string | undefined
arr[999];     // string | undefined
t[0];         // string，元组长度已知，不受影响
rec["k"];     // number | undefined

for (const x of arr) { x.length; }   // Ok，for-of 不受影响
arr[0] = "z";                        // Ok，写入不受影响
```

注意它并不做任何边界分析 —— `arr[0]` 明明有值，照样是 `string | undefined`。它做的只是把"下标访问可能取不到"这件事变成类型上的事实，剩下的交给收窄。

正因如此，它不在 `strict` 里。几乎所有带循环和下标的存量代码打开它之后都会报错，而绝大部分报错在人看来是误报。

### `noPropertyAccessFromIndexSignature`（4.2）

一个纯风格性的开关。它要求：命中索引签名的属性必须用下标写法，只有显式声明过的属性才能用点：

```ts
interface Conf { name: string; [k: string]: string }
declare const c: Conf;

c.name;      // Ok，显式声明过
c.debug;     // Property 'debug' comes from an index signature,
             // so it must be accessed with ['debug'].
c["debug"];  // Ok
```

目的是让代码里"这个属性是约定好的"和"这个属性是随便拼的"在写法上区分开。类型安全性上没有任何增益 —— `c.debug` 和 `c["debug"]` 的类型完全一样。所以它也不在 `strict` 里。

### `exactOptionalPropertyTypes`（4.4）

这是 `?` 的第三次含义变化。

回顾一下：1.0 的 `a?: number` 只表示"这个成员可以缺席"，取出来的类型是 `number`；2.0 的 `strictNullChecks` 把它变成了 `number | undefined`。但 2.0 那次改动做得有点粗 —— 它把"属性不存在"和"属性存在、值是 `undefined`"当成了一回事，而这两件事在 JS 里是能区分的（`"a" in obj` 的结果不同，`Object.keys` 的结果也不同）。

4.4 把它们分开了：

```ts
interface P { a?: number }

const p1: P = {};                 // Ok，缺席
const p2: P = { a: 1 };           // Ok
const p3: P = { a: undefined };   // Error
// Type '{ a: undefined; }' is not assignable to type 'P' with
// 'exactOptionalPropertyTypes: true'.

declare const p: P;
p.a = undefined;                  // Error
```

想允许显式的 `undefined`，得自己写出来：

```ts
interface Q { a?: number | undefined }
const q: Q = { a: undefined };    // Ok
```

它同样没有进 `strict` —— 存量代码里把可选属性显式赋成 `undefined` 的写法太常见了。

### 加入 strict 的条件

四个开关，一个在 `strict` 里，三个不在，取决于 TS 组认为会炸多少现有代码：

- `strictFunctionTypes` 进了伞下，但代价是给方法语法留了永久后门。
- 另外三个都是"规则本身没问题，但打开之后现有代码大面积飘红"，于是留在伞外，由项目自己选。

同一批被排除在外的还有 `noImplicitOverride`（4.3）。这几个开关加起来，构成了 tsconfig 里那片"比 strict 更严格"的少数派空间。还有一个我没有探索过的问题：如果 node_modules 里的依赖基于这些更严格的选项编写，而你的项目没有打开它们，会有多少影响。


## typeof, as const, satisfies, const T（v1.0 ~ 5.0，2014-07-12 ~ 2023-03-15）

最后一条线索。TS 的类型和值是两套独立的空间，可 JS 程序员的信息大量藏在值里 —— 配置对象、常量表、路由表、枚举字典，这些东西的形状在源码里写得清清楚楚，只是写在值那一侧。把这些信息搬到类型空间去，是一条从 1.0 一直修到 5.0 的线。

### `typeof`（1.0）

元老里唯一一个跨空间的入口。它在创世快照里就有：

```ts
function f(a: number): string { return ""; }

var q: typeof f;
var r: typeof f = 1;
// 1.0: Type 'number' is not assignable to type '(a: number) => string'.
```

`typeof f` 不是 JS 那个运行时的 `typeof`（那个只会返回 `"function"`），而是一个类型层的操作符，读取一个值的静态类型。有了它，`.d.ts` 里就不必把一个复杂对象的形状抄两遍。

但 1.0 的 `typeof` 只能拿到**加宽之后**的类型。当时既没有 `const`（1.4 才有），也没有字面量类型，所以从一个字符串变量身上什么细节也读不出来。这条线后面的三次改进，本质上都在解决同一件事：**怎么让 `typeof` 少丢一点信息**。

### 加宽规则：`const` 与 `let`（2.1）

字面量类型是 1.8 加的，但直到 2.1，`const` 声明才开始保留字面量类型：

```ts
let a = "hello";      // string
const b = "hello";    // 2.1 起是 "hello"；2.0 及以前还是 string
```

这个差别不是从类型论推出来的，是照着 JS 程序员对 `const` 和 `let` 的直觉定的 —— `let` 声明的变量后面还要改，推成 `string` 才有用；`const` 不会再变，那就把话说死。

不过这条规则只作用在一层。数组和对象字面量照样被加宽：

```ts
const c = ["a", "b"];        // string[]，不是 ["a", "b"]
const e = { k: "a" };        // { k: string }，不是 { k: "a" }
```

原因也很实际：绝大多数对象字面量声明出来就是要改的，全部推成字面量类型会让正常代码寸步难行。于是就留下了一个缺口 —— 那些确实不打算改的常量表，没办法告诉编译器。

### `as const`（3.4）

3.4 补上了这个缺口，办法是给一个显式的退出机制：

```ts
const c = ["a", "b"];              // string[]
const d = ["a", "b"] as const;     // readonly ["a", "b"]
const e = { k: "a", n: 1 } as const;
e.k;                               // "a"
```

`as const` 一次做了三件事：字面量不加宽、数组变成元组、所有属性变成 `readonly`。而且是递归的。

```ts
d.push("c");   // Property 'push' does not exist on type 'readonly ["a", "b"]'.
e.k = "z";     // Cannot assign to 'k' because it is a read-only property.
```

它的用途很快超出了"标注一个常量"。因为类型层从 2.1 起就能对键做计算，`as const` 实际上变成了**给类型层喂数据的手段** —— 写一个普通的 JS 数组或对象，加上 `as const`，然后用 `typeof`、`keyof`、`[number]` 把它读进类型空间：

```ts
const ROUTES = ["/home", "/about"] as const;
type Route = typeof ROUTES[number];   // "/home" | "/about"
```

一份数据，运行时和类型层各用一遍，不用写两遍也不会写歪。

### `satisfies`（4.9）

`as const` 解决了"信息丢失"，但还有另一个缺口：**标注会摧毁推断**。

给一个对象加类型标注，你得到了检查，但它的类型也就变成了标注的那个类型，自己写了什么不算数了：

```ts
const a: Partial<Record<string, number>> = { x: 1, y: 2 };

a.x.toFixed(1);   // 'a.x' is possibly 'undefined'.
a.zzz;            // Ok，任意键都通过
```

明明第一行就写着 `x: 1`，可标注一加，`a.x` 变成了 `number | undefined`，还得再判一次空。而且因为 `Record<string, number>` 带索引签名，写错的键也照单全收。

反过来，不加标注就没有检查，值写错了也没人管。

两难。4.9 的 `satisfies` 就是拒绝二选一 —— 检查照做，推断出来的窄类型照留：

```ts
const b = { x: 1, y: 2 } satisfies Partial<Record<string, number>>; // { x: number; y: number }

b.x.toFixed(1);   // Ok，b 的类型是 { x: number; y: number }
b.zzz;            // Property 'zzz' does not exist on type '{ x: number; y: number; }'.

const c = { x: "1" } satisfies Partial<Record<string, number>>;
// Type 'string' is not assignable to type 'number'.
```

`b` 的类型是编译器推断出来的 `{ x: number; y: number }`，标注那一侧只用来检查、不参与结果。

### `const` 类型参数（5.0）

到这一步，`as const` 已经成了写库时的常见负担 —— API 需要精确的字面量类型，可这个 `as const` 必须由**调用方**写，而调用方通常不明白为什么要写：

```ts
declare function plain<T>(x: T): T;

const a = plain(["a", "b"]);   // string[]，字面量信息在这里就没了
```

5.0 允许把这个要求挪到声明一侧：

```ts
declare function konst<const T>(x: T): T;

const b = konst(["a", "b"]);   // readonly ["a", "b"]
const d = konst({ k: "v" });   // { readonly k: "v" }
```

调用点一个字都不用改。写库的人在类型参数上加一个 `const`，所有调用方就自动按字面量推断了。

### 五步回头看

| 版本 | 特性 | 解决了什么 |
|---|---|---|
| 1.0 | `typeof` | 能读一个值的类型，但只能读到加宽后的 |
| 2.1 | `const` 保留字面量 | 单个字面量不再被加宽 |
| 3.4 | `as const` | 整个数组/对象都不加宽，由调用方决定 |
| 4.9 | `satisfies` | 既检查又不丢推断 |
| 5.0 | `const T` | 把 `as const` 的决定权还给库作者 |

从 1.0 到 5.0，TS一步一步让写在值里的信息尽量少地在进入类型空间时被磨掉，使得各种体操黑魔法成为可能。这激发出了丰富的元编程能力，使得使用者在给出值时便直接映射到类型表现，使得 TS 的库可以提供非常优雅的界面。TS 生态也逐渐走进了当下类型推导频密、类型体操成为库标配、大量消灭重复性代码的 DX 优先时代。这让 TS 在许多新兴领域成为首选语言。

## 回望历程

类型支持的不断丰富只是 TypeScript 的一个断面。跟随 JS 标准的同步、模块系统的支持与兼容、向原生语言的迁移等等，TS 的发展非常具有深度和广度，它也深刻塑造了今天的编程世界。TypeScript 的成功，除了深厚的理论与工程底蕴以外，和它重视开发者体验、不脱离工程实际、不过度学术化是分不开的。正确性上有妥协但好用的工具，往往比只有正确性走得远。很难想象如果没有 TS，今天的 Web 开发会点到哪个科技树。
