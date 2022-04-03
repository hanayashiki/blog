---
title: 详解 Stacking Context
slug: z-index-and-stacking-context
date: 2022-04-04
abstract: 彻底解析 Stacking Context 如何影响元素的先后关系。
---

## 不指定 z-index 的情况下，元素的顺序

在 HTML 渲染的文档中，元素之间默认有渲染的先后顺序。先渲染的元素在底部，后渲染的元素在顶部。

```html
<div style="padding: 5px; background: white">
  <div style="height: 100px; width: 100px; background: red"></div>
  <div style="height: 100px; width: 100px; background: blue"></div>
  <div style="height: 100px; width: 100px; background: green"></div>
</div>
```

<div style="padding: 5px; background: white">
  <div style="height: 100px; width: 100px; background: red"></div>
  <div style="height: 100px; width: 100px; background: blue"></div>
  <div style="height: 100px; width: 100px; background: green"></div>
</div>

实际中，渲染一个元素时，会按照以下顺序渲染：

1. 先渲染父元素的背景和边框
2. 按 DOM 顺序渲染所有 *Positioned* 后代
3. 按 DOM 顺序渲染所有 *Non-positioned* 后代。

所谓 Positioned，指的是这个元素的生效 `position` 属性不是 `static`。换句话说，常见的 `relative`, `absolute`, `fixed` 定位的元素都是 positioned 元素。

因此我们不妨看一下加入了绝对定位的元素以后，渲染顺序会有什么变化：

```html
<div style="position: relative; padding: 5px; background: white">
  <div style="height: 50px; position: absolute; top: 100px; width: 100px; background: pink"></div>
  <div style="height: 50px; position: absolute; top: 200px; width: 100px; background: yellow"></div>
  <div style="height: 100px; width: 100px; background: red"></div>
  <div style="height: 100px; width: 100px; background: blue"></div>
  <div style="height: 100px; width: 100px; background: green"></div>
</div>
```

<div style="position: relative; padding: 5px; background: white">
  <div style="height: 50px; position: absolute; top: 100px; width: 100px; background: pink"></div>
  <div style="height: 50px; position: absolute; top: 200px; width: 100px; background: yellow"></div>
  <div style="height: 100px; width: 100px; background: red"></div>
  <div style="height: 100px; width: 100px; background: blue"></div>
  <div style="height: 100px; width: 100px; background: green"></div>
</div>

这里我们在根元素的第一个和第二个子元素的位置插入了两个 50 * 100 的绝对定位元素，分别为粉色和黄色。可以发现，即使粉色和黄色的元素列在前面，因为它们是绝对定位的，因而是 Positioned 的元素，所以它们依然在其他 Non-positioned 的元素的上方。

## z-index 与 Stacking Context

大多数读者可能早已经掌握了使用 z-index 来调整元素的先后顺序了。例如下面两个绝对定位的元素，他们的先后顺序在默认状态下由 HTML 中的顺序决定，但是我们可以指定 z-index 来改变这个默认的顺序：

```html
<div style="position: relative; padding: 5px; height: 200px; background: white">
  <div style="height: 50px; position: absolute; top: 0px; width: 100px; background: pink"></div>
  <div style="height: 50px; position: absolute; top: 25px; left: 25px; width: 100px; background: yellow"></div>
</div>
```

<div style="position: relative; padding: 5px; height: 200px; background: white">
  <div style="height: 100px; position: absolute; top: 25px; width: 100px; background: pink"></div>
  <div style="height: 100px; position: absolute; top: 50px; left: 25px; width: 100px; background: yellow"></div>
</div>

现在我们不指定 z-index，按照 DOM 顺序，粉色在下，黄色在上；而指定粉色的 `z-index` 为 2，黄色的 `z-index` 为 1 以后，就出现了不一样的现象：

```html
<div style="position: relative; padding: 5px; height: 200px; background: white">
  <div style="height: 100px; position: absolute; top: 0px; width: 100px; background: pink; z-index: 2;"></div>
  <div style="height: 100px; position: absolute; top: 25px; left: 25px; width: 100px; background: yellow; z-index:1;"></div>
</div>
```

<div style="position: relative; padding: 5px; height: 200px; background: white">
  <div style="height: 100px; position: absolute; top: 0px; width: 100px; background: pink; z-index: 2;"></div>
  <div style="height: 100px; position: absolute; top: 25px; left: 25px; width: 100px; background: yellow; z-index:1;"></div>
</div>

这个是 `z-index` 的一个简单应用，那么真实世界中，`z-index` 还起到了什么作用呢？事实上：每个**有效指定**了 `z-index` 的元素，都会把它自己和它的后代纳入到一个 **Stacking Context** 中。这个 **Stacking Context** 决定了“要不要把这个元素对应的 DOM 树在渲染前后关系中视为一个整体”。这句话具体什么意思，我们举个例子来说明：

```html
<div style="position: relative; z-index: 1; padding: 5px; height: 200px; background: white">
  <div style="height: 100px; position: absolute; top: 0px; width: 100px; background: pink; z-index: 1;">
      <div style="height: 100px; position: absolute; top: 12px; left: 12px; width: 100px; background: red; z-index: 3;"></div>
    
  </div>
  <div style="height: 100px; position: absolute; top: 25px; left: 25px; width: 100px; background: yellow; z-index:2;"></div>
</div>
```

<div style="position: relative; z-index: 1; padding: 5px; height: 200px; background: white">
  <div style="height: 100px; position: absolute; top: 0px; width: 100px; background: pink; z-index: 1;">
      <div style="height: 100px; position: absolute; top: 12px; left: 12px; width: 100px; background: red; z-index: 3;"></div>
    
  </div>
  <div style="height: 100px; position: absolute; top: 25px; left: 25px; width: 100px; background: yellow; z-index:2;"></div>
</div>

注意这里红色的方块是粉色的子元素，而且它的 `z-index` 是 3。即使它的 `z-index` 是 3，它依然是在黄色之下的。因为红色方块是粉色方块的子元素，而且粉色的方块形成了一个 Stacking Context，所以它们在渲染顺序中被作为一个整体 —— 无论红色方块的 `z-index` 是多少，它的位置都在它所在的 Stacking Context 内部。


而**有效指定**的意思是，在以下的情况下，如果 `z-index` 不是 `auto` 的话，才能为当前元素创建 Stacking Context：

+ `position` 是 `absolute`, `relative`, `fixed` 或者 `sticky`。
+ 父元素是 `flex` 或者 `grid`。
+ `opacity` 小于 1。
+ 其他情况，参见：https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Positioning/Understanding_z_index/The_stacking_context

需要注意的点是：如果 `position` 是默认的 `static`，指定了 `z-index` 也没有任何效果。当我们发现元素被遮挡的时候，这点一定要注意！

另外，HTML 文档的根元素也自带一个 Stacking Context（这是当然的）。

需要注意的是，即使元素是 `absolute` / `relative`，但是没有指定 `z-index`，依然不会产生 Stacking Context。元素的先后顺序将依照最近的 Stacking Context 决定。例如我们删去黄色和粉色的 `z-index`，让它们丧失 Stacking Context。

```html
<div style="position: relative; z-index: 1; padding: 5px; height: 200px; background: white">
  <div style="height: 100px; position: absolute; top: 0px; width: 100px; background: pink; z-index: 1;">
      <div style="height: 100px; position: absolute; top: 12px; left: 12px; width: 100px; background: red; z-index: 3;"></div>
  </div>
  <div style="height: 100px; position: absolute; top: 25px; left: 25px; width: 100px; background: yellow; z-index:2;"></div>
</div>
```

<div style="position: relative; z-index: 1; padding: 5px; height: 200px; background: white">
  <div style="height: 100px; position: absolute; top: 0px; width: 100px; background: pink">
      <div style="height: 100px; position: absolute; top: 12px; left: 12px; width: 100px; background: red; z-index: 3;"></div>
  </div>
  <div style="height: 100px; position: absolute; top: 25px; left: 25px; width: 100px; background: yellow"></div>
</div>

可以看到，三者共享 `relative` 根元素的 Stacking Context，因而即便红色是粉色的子元素，它们依然按照 `z-index` 来排序。红色即使是粉色的子元素，也没有被视为整体。

## 指定了 `z-index` 和未指定 `z-index` 的元素同在

刚才，我们展示的例子中，都是同一个 Stacking Context 全部指定了 `z-index` 或者全部不指定。那么如果混在一起呢？

在渲染的时候，如果 `z-index` 是不指定，即为 `auto`，则**默认在第 0 层**渲染。而如果指定为 `z-index: <x>` 就在第 `<x>` 层渲染。因此，如果指定了 `z-index > 0`，就渲染在所有不指定 `z-index` 的上方；`z-index < 0` 就在下方（包括父元素的背景）。

## 总结

以上就是本文的主要部分。在本文中，我们介绍 `z-index` 的简单作用以及 Stacking Context 的概念。简单总结为以下三点。
+ 我们要注意 Stacking Context 和 `z-index` 仅仅针对与 Positioned 元素而言，`static` 元素是无法指定 `z-index` 的。
+ 有效的 `z-index` 决定了当前元素的渲染层级，并且将该元素为根节点的 DOM 部分纳入了一个新的 Stacking Context。
+ Stacking Context 有将内部元素打包作为一个整体的效果，在复杂的渲染层级中十分有用。
