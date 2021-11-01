---
title: 自制 React-like 库
slug: build-a-react-like-library
date: 2021-02-12
abstract: 本文介绍了如何写一个模仿 React 的 UI 渲染库，主要是把 Functional Component 的实现简化出来供读者参考。
---

## 介绍

源码地址：https://github.com/hanayashiki/light-react

本练习深入参考了 TinyReact: https://github.com/SunHuawei/TinyReact 

不少大佬曾经手写过简短的 React 框架来体现他们对 React 的深入理解，作为追随大佬的人，自然应该向大佬学习他们 Learning by Doing 的精神，用一个类似的实现来验证自己对 React 的理解。
我用了一个下午写了一个叫 'light-react' 的库，满足基本的渲染功能，更多特性还未实现。下面是一个使用案例：

```jsx
    function Comp({ text, intro }: { text: string, intro: string }) {
        return (
            <div>
                <h3>{text}</h3>
                <p>{intro}</p>
            </div>
        )
    }

    React.render(
        <Comp text={"Light React Sample"} intro={"Understand react by building it. "}/>,
        document.getElementById("root"),
    );
```

对应页面：

![page](https://i.imgur.com/21knqAS.png)

## 概念介绍

+ Atom: （这个用语是我自己发明的）原子节点，指与 DOM 直接对应的 [Virtual Dom](https://reactjs.org/docs/faq-internals.html) 节点，例如 `div`, `h1`, `p` 等原生节点。
+ ComponentElement: (同上) 组件节点，指由用户定义的 Component 渲染形成的节点。例如 JSX 语句

    ```jsx
    <Comp
        text={"Light React Sample"}
        intro={"Understand react by building it. "}
    />
    ```

    返回的就是 ComponentElement

+ Component: 组件，即用户定义的组件。目前只支持 Functional Component，不打算支持 Class Component。注意组件和组件节点不同，组件是定义，组件节点是定义渲染的结果。

## 基本原理

TinyReact 的 [readme](https://github.com/SunHuawei/TinyReact/blob/master/README.md) 写的非常好，建议先阅读他的基本原理解释，本文不再重复其中的内容。

TinyReact 寥寥 120 行，只实现了 React 最基本的渲染功能。例如：给定如下 Atom 组成的树

```jsx
let app = document.getElementById('eventExample')
let name = 'TinyReact'

let onInput = (e) => {
  name = e.target.value
  rerender()
}

function rerender() {
  renderDOM(
    createVDOM(
      'div',
      {},
      createVDOM(
        'input',
        {
          value: name,
          oninput: onInput
        }
      ),
      createVDOM('div', {}, name, ' is wonderful')
    ),
    app
  )
}

rerender()
```

它会渲染成如下的 DOM 节点：

```
<div>
    <input>
    <div>TinyReact is wonderful</div>
</div>
```

但是他并没有实现 Functional Component 的功能。FC 的功能非常重要，那么我们该如何站在巨人的肩膀上实现 FC 呢？

### Functional Component

首先，JSX 中，对于预定义的节点（Atom 节点），如下的语句：

```jsx
<div
    style="color: red"
>
    ...children
</div>
```

将会转译成如下的 ES6 语句（需要一定的 Babel 或者 TS 设定）：

```js
React.createElement("div", 
    {
        style: "color: red"
    },
    ...children
);
```

这里 HTML tag 位置的 `div` 对应第一个参数 `"div"`，`div` 的属性对应第二个参数，而其 children 对应 `React.createElement` 的变长参数部分。

这种情况下，是不能实现用户自定义的组件的：`createElement` 的第一个参数是字符串常量而不是函数。

而当 HTML tag 位置的 token 是一个已经定义的首字母大写的变量：

```jsx
function Comp({ text, intro }: { text: string, intro: string }) {
    return (
        <div>
            <h3>{text}</h3>
            <p>{intro}</p>
        </div>
    )
}

<Comp text={"React"} intro={"is baaaad"} />
```

情况就不一样，`<Comp text={"React"} intro={"is baaaad"} />` 会被转写为

```js
React.createElement(Comp, 
    {
        text: "React",
        intro: "is baaaaad",
    },
    ...children
);
```

因此，为了实现 Atom 和 Component 的 JSX 语法，我们需要把一个叫 `React` 的变量暴露出来：

```js
// export function createElement...

const React = {
    createElement,
    ...
}

export default React;
```

然后用户需要这样引入（注意 `React.createElement` 此时必须是已经定义的函数，这里没有魔法）：

```jsx
import React from 'light-react';

function Comp({ text, intro }: { text: string, intro: string }) {
    return (
        <div>
            <h3>{text}</h3>
            <p>{intro}</p>
        </div>
    )
}

React.render(
    <Comp text={"React"} intro={"is baaaad"} />,
    document.getElementById("root"),
);
```

这样我们就可以在 DOM 中 id 为 `"root"` 的节点，渲染 React 所管辖的 UI 了。

然后我们的 `createElement` 必须区别对待 Atom 和 ComponentElement：

```jsx
export function createElement<P extends {}>(
    tag: string | LightComponent<P>,
    props?: P,
    ...children: LightNode[]
) {
    if (typeof tag === "string") {
        return createAtom(tag, props, ...children);
    } else {
        return createComponentElement<P>(tag, props ?? {} as P, ...children);
    }
}
```

在 `createComponentElement` 中，我们生成对应的 `ComponentElement`：

```jsx
export const createComponentElement = <P extends {}>(
    component: LightComponent<P>,
    props: P,
    ...children: LightNode[]
): LightComponentElement<P> => {
    return {
        tag: '',
        type: 'LightComponentElement',
        component,
        props,
        children,
        shallowRender() {
            this.resultVDOM = this.component(this.props);
        }
    };
}
```

这里的几个域含义如下：

+ `type` 用于标示其类型，方便后续的区别处理。
+ `component` 是渲染的函数，由用户直接给出。
+ `props` 是组件输入的 Props。
+ `children`: JSX 传入的 children
+ `shallowRender`: 运行一次渲染函数，得到对应 `props` 产生的 `LightNode`。注意这里不会递归运行其返回的 Component。
+ `resultVDOM`: 渲染的结果。

`LightNode` 是对所有 VDOM 中的组件类别的全集：

```jsx
type LightNode = LightComponentElement | LightText | LightAtom | string | undefined;
```

引入了 Component 后，`diff` 算法和 `createDOM` 函数会有所不同。在这里，`diff` 是比较两个 VDOM 树不同的算法。当自动或手动重新渲染时，`diff` 将执行并给出当前 VDOM 和上次 VDOM 的差异，转化为一系列 `Patch` 操作，交给 `patch` 对 DOM 进行实际更新。`patch` 会调用 `createDOM` ，`createDOM` 最终调用 `document.createElement`  等浏览器 API 来改动 DOM。

首先是 `diff` 算法：

我们需要特别处理当两个 `LightNode` 的类型均为 `LightComponentElement` 的情形：

```jsx
    // ...
    } else if (isLightComponentElement(prevVDOM) && isLightComponentElement(nextVDOM)) {
        if (prevVDOM.component !== nextVDOM.component) {
            patches.push({ type: 'update', prevVDOM, nextVDOM, parentDOM });
        } else if (!areShallowEqual(prevVDOM.props, nextVDOM.props)) {
            nextVDOM.shallowRender();
            patches.push(...diff(prevVDOM.resultVDOM, nextVDOM.resultVDOM, prevVDOM._DOM!));
        } // Else the VDOM will not be updated
    } 
```
这里要做的事情其实也非常简单：

首先我们比较两者的渲染函数 `component` 是不是同一个，如果不是的话，`update` 操作会删去原来的 ComponentElement 对应的 DOM 节点（当然，这里没有实现生命周期相关的 hooks），否则比较他们的 `props` 是不是相同的（这里我们行为稍微和 React 不同，React只有用 `React.memo` 修饰的 Component 才会比较。）。

如果 `props` 不同 （React 则是默认不设该条件），那么 `nextVDOM` 将会进行一次 `shallowRender`。`shallowRender` 将会令 `nextVDOM.resultVDOM` 被赋值为 `nextVDOM` 新渲染得到的 VDOM。然后，我们递归地比较这样的渲染对树的结构造成的影响。

`createDOM` 函数的变动：

```jsx
    } else if (isLightComponentElement(vdom)) {
        vdom.shallowRender();
        dom = createDOM(vdom.resultVDOM);
        vdom._DOM = dom;
    }
```

`createDOM` 用于从 VDOM 节点创建新的 DOM 节点。同样，这里需要特判 `vdom` 是 `LightComponentElement` 的情况。首先，我们需要进行一次 `shallowRender`，得到渲染出来的 `LightNode`，然后递归创建这个 DOM 节点（当然，如果再次遇到了新渲染的 `LightComponentElement`，又会做同样的事情，从而最后所有的 `LightNode` 都产生了对应的 DOM 节点。

## 结束

本文介绍了如何写一个模仿 React 的 UI 渲染库，主要是把 Functional Component 的实现简化出来供读者参考。当然本文并没有实现 Hooks 等特性，如果今后有空笔者十分有尝试的兴趣。
