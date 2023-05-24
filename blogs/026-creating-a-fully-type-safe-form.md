---
title: 完全类型安全的 Form
slug: creating-a-fully-type-safe-form
date: 2023-04-20
abstract: 
---

## Form 是什么

Form 从最表面来看，是一个 `form` 元素，内部包含了一些 `input`，用户输入这些东西就可以提交数据到我们的服务器，或者其他的地方。例如下面这个[来自 MDN 的例子](https://developer.mozilla.org/zh-CN/docs/Web/HTML/Element/form)。

```html
<form action="" method="get" class="form-example">
  <div class="form-example">
    <label for="name">Enter your name: </label>
    <input type="text" name="name" id="name" required>
  </div>
  <div class="form-example">
    <label for="email">Enter your email: </label>
    <input type="email" name="email" id="email" required>
  </div>
  <div class="form-example">
    <input type="submit" value="Subscribe!">
  </div>
</form>
```

在一个典型的 SPA 中，我们可能会有如下的操作流程：

1. 用户在表单中输入数据
2. 用户在应用的提示下改正错误
3. 用户点击提交按钮
4. 数据被发送到服务器

从端到端的角度来看，我们好像只是原封不动的把用户输入的数据写入了数据库里面一样。但是，实际上我们要考虑许多的问题。对于这些问题欠缺准备，会导致 App 的输入体验不佳和面条式的代码。

1. 用户会犯错误，我们如何及时提示错误？错误应该在哪里提示？
2. 我们如何保证输入的数据满足类型？
3. 如何进行异步的校验？例如：校验用户名有没有重复？
4. 如何应付超大型的表格？
5. 如何应对依赖于用户输入的校验？
6. 如何根据用户的输入渲染不同的UI？
7. 我们如何简洁而安全地完成这些需求？

如果用最 naive 的方法写表格，我们很快就会发现到处都是重复的代码。比如你要判断 field A, B, C 是非空的，那么你就每个都要写类似的代码：

```js
const errors = {}

if (values.A === '') {
  errors.A = 'Please input a value.'
}
if (values.B === '') {
  errors.B = 'Please input a value.'
}
if (values.C === '') {
  errors.C = 'Please input a value.'
}

return errors;
```

这样很容易让代码变得非常的乏味和容易出错。

## 用 Schema 描述类型

很快，我们需要一种标准化的方法表达我们对数据的各种需求：非空、符合某个格式、数字、符合某个 object、是一个列表，等等。TypeScript 的类型系统可以满足大多需求，可惜这种校验仅仅存在于编译时。

[Zod](https://zod.dev/) 是一个进行运行时数据校验的库，用户通过和 TypeScript 类似的结构来表达运行时的类型需求：

```ts
const Dog = z.object({
  name: z.string(),
  age: z.number(),
});

Dog.parse({ age: '18' })
```

```json
[
  {
    "code": "invalid_type",
    "expected": "string",
    "received": "undefined",
    "path": [
      "name"
    ],
    "message": "Required"
  },
  {
    "code": "invalid_type",
    "expected": "number",
    "received": "string",
    "path": [
      "age"
    ],
    "message": "Expected number, received string"
  }
]
```

Schema 通过简单的语法定义我们对数据的需求，这样我们可以不再需要重复的 `a !== ''`, `typeof b === 'number'` 来进行永无休止的校验。只需要一个简单的定义我们就能把非法数据拒绝在链路之外，并且给出用户可读的错误信息。

## Raw Input, Decoded, Output, Errors

接下来，我们考虑对数据建模的问题。

Form 不是什么复杂科学，但是通过对数据建模，我们可以避免踩坑。例如下面的输入框，存在一个问题。

```tsx
function Form() {
  const [value, setValue] = useState<number>();

  return (
    <input value={value} onChange={(e) => setValue(Number(e.target.value))} />
  );
}
```

假如用户输入了一个不是数字的值，`Number()` 会把他立即转换成 `NaN`，用户就会看到 `NaN` 显示在输入框里，对于外行来说会一头雾水。也许我们可以加入 `type="number"` 从 HTML 层面防止用户输入一切不合法的值，但这只是在“物理”层面躲避了问题，从逻辑上看如果今天我们输入的不是数字而是日期，又会引起类似的问题。

这里最大的问题就是没有把用户自己的输入，和我们期望 parse 出来的数据分开。如果分开了，我们就可以把任意的数据显示在文本框里，然后根据需要去 parse 这个数据，去提示错误。

根据实践中的总结，我们把数据分为 4 类：

1. Raw Input: Raw Input 是用户输入的任意数据
2. Decoded: Decoded 是我们从用户输入的数据中 parse 出来的值。对于数字类型，可能是 `number`。对于日期类型，可能是 `Date`。
3. Output: Output 是 Decoded 经过 Zod parse 后的结果。
4. Errors: Errors 是错误信息。

他们之间的关系简单体现如下：

![](https://mobx-zod-form.pages.dev/_next/static/media/guide-data-flow.abc12916.png)

通过这样的分类，我们对数据进行了分层的处理。
第一层：Raw Input，完全没有处理过的裸数据
第二层：Decoded，根据我们对数据的期望，进行类型上的转换。这里不应该涉及到数值等判断。进行这一步的主要作用是确定我们有没有得到我们程序能“理解”的东西。这里的理解的意思也很简单，也就是类型要正确。输入的年龄可以是负数，可以是超大整数，这在大多数情况下不会影响我们程序的逻辑。
第三层：Output。Decoded 的数据经过一次转换和校验，得到我们完全合法的数据。这一步会由 Zod 完成。这一步完成后，数据一般会从表单当中导出。

## 从 Schema 导出 Field

对于一个 Schema，例如 `Dog`:

```ts
const Dog = z.object({
  name: z.string(),
  age: z.number(),
});
```

我们大多数情况可以把它和一个表单对应起来，例如：

1. 一个 `name="name"` `type="text"` 的 `<input>` 进行对 `name` 的编辑。
2. 一个 `name="age"` `type="number"` 的 `<input>` 进行对 `age` 的编辑。

同时，一个 Field 还对应一些附加的属性：

1. `issues: ZodIssue[]` 该 field 对应的 Zod 验证错误。
2. `errorMessages: string[]` 该 field 的错误消息。用于直接对用户显示。
3. `touched: boolean` 用户有没有和这个 field 互动过。由 field 的实现来决定。例如一个基于 `<input>` 的 field，可以通过 `onBlur` 事件来设置 `touched`。用户可以根据有没有 `touched` 来决定是否显示错误信息。一般，用户没有交互过的输入组件应该不显示错误信息。
4. `type: ZodType` 这个 field 对应的类型是什么。例如 `name` 应该对应一个 `ZodString`。

以及其他必要的属性。

Field 记录了围绕某个值的输入的元信息，这些信息一部分用于显示在界面上，给用户反馈，另一方面也是我们表单的组织结构。Field 不一定是 `string`, `number` 这样的原子值，也可以是 `object`, `array`，甚至是 `discriminated union`。从而我们的表单可以任意地复杂：

```ts
const ComplexForm = z.object({
  address: z.object({
    line1: z.string(),
    line2: z.string(),
    zipcode: z.string(),
  }),
  payment_method: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('credit_card'),
      number: z.string(),
      cvv: z.string(),
      expiry: z.object({
        year: z.number(),
        month: z.number(),
      }),
      holder: z.string(),
    }),
    z.object({
      type: z.literal('paypal'),
      email: z.string(),
    }),
  ]),
});
```

我们可以把这个 schema map 到下述的 field 中：

```html
<fieldset>
  <legend>address</legend>
  <input type="text" name="line1">
  <input type="text" name="line2">
  <input type="text" name="zipcode">
</fieldset>

<fieldset>
  <legend>payment_method</legend>

  <select name="payment_method.type">
    <option>credit_card</option>
    <option>paypal</option>
  </select>

  <!-- more... -->
</fieldset>
```

上述的 HTML 表示当然不足以满足 field 的特性，这只是说明了 Schema 通常可以自动地转换成可以与用户进行交互的 Form UI。实际中，我们使用 JS 前端框架来构建 UI。

在实际的开发中，我们把这些 UI 和 field 绑定到一起，利用 schema 对输入的数据进行校验，并且观察 `field.errorMessages` 等属性，就能提供一个集实时输入、校验、反馈等功能的现代表单。

## React & Mobx + Mobx Zod Form

结合上述理念，我设计了 [Mobx Zod Form](https://mobx-zod-form.pages.dev/) 这个表单校验工具。结合现有表单工具的不足，我实现了以下特性：

1.  完全不用任何手写字符串。
   许多 lib 要求程序员写类似 `"form.field1.field2.stub"` 这样的字符串，来定位数据的位置。这样完全牺牲了 TypeScript 提供的好处。Mobx Zod Form 本身就进行了 Schema 到 Field 的类型安全转换，相比魔法字符串，程序员通过访问 `form.root` 找到需要绑定的 field。

    ```tsx
    <TextInput field={form.root.fields.username} />
    ```

2. 实现了 decode 步骤。正如上文所说，我们针对 DOM 的 string 进行了一次 decode 转换，从而程序员不需要面对赤裸裸的字符串。同时，程序员可以类型安全地处理用户输入。
3. 可以支持复杂的组合。正如 Zod Schema 可以像 TypeScript 一样描述复杂的类型，它映射到的 Form 也可以任意地复杂。

而 Mobx 是一个令值可以被观察的库，他使得我们可以构建 React Component 观察 Field 属性的变化，并且大多数时候避免无谓的重新渲染，这在使得我们构建大型表格的时候不费吹灰之力就可以获得复合性和高性能。用户不需要用 `useState` 这样的元语或者纠结于不可变性，就可以使得整个 UI 随表单的输入、校验结果变化。

[Mobx Zod Form](https://mobx-zod-form.pages.dev/) 帮助你简单的定义和渲染表格，并将允许你将元数据挂在 Schema 上，这使得 Schema 成为 Source of Truth。围绕 Schema 开展业务可以让一切重复代码降到最低，并且总是保持类型安全。你甚至可以根据 OpenAPI 等工具生成你的 Schema，从而让前端后端无缝衔接。

我们公司正在将 `Formik` 迁移到 [Mobx Zod Form](https://mobx-zod-form.pages.dev/)。

1. 迁移后的代码明显减少了错误的机会，并且代码行数大幅减少。
2. 减少了很多 `const [field] = useField('a.b.c')` 之类的样板代码，因为我们可以不需要 Hook 调用直接操作 field。
3. schema 和表单数据结构无缝衔接。初始值不需要手工设定。
4. 可以几乎完全访问表单的元信息。
5. 当然坏处就是经常有一些问题没有处理到，新代码还需要打磨。
   
以上就是我对表单的一些想法，和对这个想法进行的实践。希望能帮助到读者。
