---
title: 为自制的 React-like 库增加 Hooks 支持
slug: add-hooks-support-to-light-react
date: 2021-06-20
abstract: "React hooks: not magic, just arrays -- Rudi Yardley"
---

接[上一篇](https://blog.chenyu.pw/#/11/build-a-react-like-library)笔者尝试写了一个类似 React 的 UI 库，暂时只实现了[无状态渲染函数](https://itnext.io/react-component-class-vs-stateless-component-e3797c7d23ab)的功能，能够实现 diff 和 DOM 修改。为了让它有状态，变得更加有趣，我实现了几个[钩子函数](https://reactjs.org/docs/hooks-intro.html)。实现本身并不复杂，但是由于涉及到 React 丑陋的部分：React 自身的状态管理，所以很多细节需要小心翼翼。

效果如下：

```
import React, { useRef, useState } from 'light-react';

function Comp() {
    const [counter, setCounter] = useState(0);
    const lastRender = useRef(new Date());
  
    console.log("rendered");
  
    // @ts-ignore
    window.clickComp = () => {
      console.log("clicked");
      setCounter((counter) => counter + 1);
    };
  
    const elapsed = new Date().getTime() - lastRender.current.getTime();
  
    lastRender.current = new Date();
  
    return (
      <div onclick={"clickComp();"}>
        <h3>Clicked {counter}</h3>
        <p>Last render: {`${elapsed}`}ms ago</p>
      </div>
    );
  }
  
  React.render(<Comp />, document.getElementById("root"));
```

![2021-02-10 21-15-12.gif](https://i.loli.net/2021/02/11/l7XMSszDbOueFwt.gif)

Codesandbox：https://codesandbox.io/s/modest-hooks-qe9xg?file=/src/index.js

## Hooks 的要素

各种社区版 React 都有自己的实现。例如 [Fre](https://github.com/yisar/fre/blob/master/src/hooks.ts) 就基于 `useMemo` 给出了各种 Hooks 简短的实现。我则按照自己的思路，基于 `useRef` 实现了各类钩子。

Hooks 的实现就是两个要素：如何在 ComponentElement 的生命周期内储存 Hooks 所需的状态，以及如何在准确的时机执行 Hooks 的副作用。这里的 ComponentElement 指用户提供的 Component 渲染产生的组件，通常含有子 VDOM 节点，例如调用 `Comp` 渲染而成的 `<Comp/>`（该定义仅在本文适用）。 

对于如何储存状态，实际上是很简单的。对于一个 ComponentElement，我们给它建立一个 `ComponentContext`, 这个 context 中，记录了 Hooks 所需的一切数据，理论上会随 ComponentElement 的创建而产生（对应一次 `React.createElement`) 操作，随 ComponentElement 的消失而消失。

`ComponentContext` 的定义如下：

```
export interface ComponentContext<P extends {}> {
    componentElement?: LightComponentElement<P> ;
    firstRender: boolean;
    nthSlot: number;
    slots: any[];
    rerender?: () => void;
    resolveSlot: <T>(valueCreateor: () => T) => Slot<T>;
    effects: EffectContext[];
    registerEffect: (effect: EffectContext) => void;
    runEffects: () => void;
    cleanUp: () => void;
}
```

其中重要的数据如下：

+ `firstRender` 记录是否是初次渲染。
+ `slots` 是 hooks 共享的“栈空间”。初次渲染时，第 i 个调用的 Hook 就永远占用第 i 个 slot。因此，Hook 必须按顺序固定的调用，不可以放入 `if` 或 `for` 中以避免错位。这和 React 的要求是一致的，从根本上是一致的。
+ `effects` 是 `useEffect` 的副作用描述列表。当执行到了对应的时机，我们会调用其中的 effect 或 cleanUp 函数。

为了能找到当前的 `ComponentContext`，我们需要设立一个“全局变量” `currentContext`，对应当前正在执行 Render 的 Component：

```
let currentContext: ComponentContext<{}> | undefined = undefined;

```

然后当 Render 时，设置 `currentContext`，完成后恢复 `currentContext`。

```
        shallowRender() {
            const prevContext = currentContext;
            currentContext = context as any;
            // ...
            try {
                // ...
            } finally {
                currentContext = prevContext;
            }
        }
```

然后为了封装这个 trick，我们定义 wrapper 函数 `resolveComponentContext` 来访问这个 context，并且在非渲染时（也就是 context 是 undefined 时）报错。

接下来我们就有了万全准备，来实现 Hooks 了。

## Hooks 的实现

### useRef

`useRef` 接受一个参数 `initialValue` 作为返回值的 `current` 指向的对象。`initialValue` 只在第一次渲染被读取，之后永远返回同一个 `MutableRefObject`。因此我们只要简单的第一次渲染把 Ref 对象放到 slot 里，之后一直返回这个 slot 的值就行了。

```
export function useRef<T>(initialValue: T): MutableRefObject<T> {
    const context = resolveComponentContext();
    const slot = context.resolveSlot(() => ({
        current: initialValue,
    }));

    return slot.slot;
}
```

`resolveSlot` 返回当前 hooks 所分配到 slot。它接受一个 creator 函数，如果是第一次渲染则调用这个 initializer 来初始化 slot。这和 `useRef` 的需求一致。 

```
function resolveSlot<T>(valueCreator: () => T) {
    const nthSlot = this.nthSlot; // this 指向 ComponentContext

    if (this.firstRender) {
        const state = valueCreator();
        this.slots.push(state);
    }
    const slot = this.slots[nthSlot];
    const setSlot = (s: T | ((s: T) => T)) => {
        this.slots[nthSlot] = s instanceof Function ? s(this.slots[nthSlot]) : s;
    }
    const resolve = () => this.slots[nthSlot];

    this.nthSlot++;
    return {
        slot,
        setSlot,
        resolve,
    }
}
```

### useEffect

`useEffect` 接受一个或两个参数。第一个参数 `effect` 是一个函数，可选地返回一个 `cleanUp` 函数。第二个参数 `deps` 可选，是一个任意 JS 值组成的 Array。

每次 Render 时，执行到 `useEffect` 时，我们需要比对这一次的 `deps` 和上一次的 `deps` 是不是各项 `===`。如果是的话，或者 `deps` 是为定义，那么就需要在下次渲染后，执行 `effect`。每次执行 `effect` 前或者组件生命周期结束时，需要执行上一个 `effect` 留下的 `cleanUp` 函数。

`useEffect` 的代码包括钩子函数自体和它在各个执行阶段的调用。

首先是 `useEffect` 自身：

```
export function useEffect(effect: EffectCallback, deps?: DependencyList): void {
    const effectContext = useRef<EffectContext>({
        effect,
        deps,
        firstTime: true,
        shouldRun: true,
    }).current;

    resolveComponentContext().registerEffect(effectContext);

    if (typeof effectContext.deps !== typeof deps || effectContext.deps?.length !== deps?.length) {
        throw new Error(`useEffect get different types of deps. `);
    }

    effectContext.shouldRun = effectContext.firstTime || deps === undefined || !areShallowEqual(effectContext.deps!, deps);
    effectContext.effect = effect;
    effectContext.deps = deps;
    effectContext.firstTime = false;
}
```

这里需要调用一个 `ComponentContext` 的方法 `registerEffect` 以在第一次渲染时将 `effectContext` 特殊记录在 `ComponentContext` 的 effect 列表 `effects: EffectContext[]` 中，以备调用。

接下来我们需要在指定的时机调用这些 effect：

首先是 `shallowRender` 调用时，我们需要 schedule 一个 `runEffect` 来执行本次 render 的所有 effect:

```
        shallowRender() {
            const prevContext = currentContext;
            currentContext = context as any;
            context.componentElement = this;
            this.context = context;
            try {
                this.resultVDOM = this.component(this.props);
                context.nthSlot = 0;
                context.firstRender = false;
            } finally {
                currentContext = prevContext;
            }
            setTimeout(() => {
                this.context.runEffects();
            })
        },
```

这里应该是用 `requestIdleCallback` 之类的函数来实现，来保证不要在渲染的关键时刻卡顿。由于本作的玩具性质，就先这样实现先。

这里是一个简化版，因为我们的所有 diff 到 render 都是一个 tick 内完成的，而 setTimeout 保证在之后的 tick 执行，这个时候对应的 DOM （在本库的情形下）已经挂载了，满足时机要求。

`runEffects` 的内容是按照 `useEffect` 在 `effectContext` 留下的结果 ，执行 effect：

```
        runEffects() {
            for (const effect of this.effects) {
                if (effect.shouldRun) {
                    const cleanUp = effect.effect();
                    if (cleanUp) {
                        effect.cleanUp = cleanUp;
                    }
                }
            }
        }
```

在 `patch` 中，当我们需要删除一个 ComponentElement，我们需要执行最后一个 effect 留下的 `cleanUp` 函数。

```
        cleanUp() {
            for (const effect of this.effects) {
                if (effect.cleanUp) {
                    effect.cleanUp();
                }
            }
        }
```

这样就完成了 `useEffect` 的所有任务。

### useState, useMemo

这两个钩子函数的实现和 `useRef` 大同小异，如有需要可以参考 `src/hooks.ts` 的源代码。

### diff 算法的修正

当 `nextVDOM` 和 `prevVDOM` 只有 `props` 不同的时候，由于 `nextVDOM` 在 `createElement` 时关联了新的 `ComponentContext` (为新渲染的 `nextVDOM`准备的 )，`nextVDOM` 会在渲染时被当作新的 `VDOM`，从而所有钩子都会重新初始化，这不是我们想要的结果。这种情况下，我们应该让 `nextVDOM` 偷来 `prevVDOM` 的属性，以让他们共享一份 context，并复用当前的 DOM。

```
    } else if (isLightComponentElement(prevVDOM) && isLightComponentElement(nextVDOM)) {
        if (prevVDOM.component !== nextVDOM.component) {
            patches.push({ type: 'update', prevVDOM, nextVDOM, parentDOM });
        } else if (!areShallowEqual(prevVDOM.props, nextVDOM.props)) {
            nextVDOM.inherit(prevVDOM);
            nextVDOM.rerender();
        }
    }
```

`inherit` 用于从 `prevVDOM` 偷来它的上下文：

```
        inherit(prev: LightComponentElement<P>) {
            Object.assign(this, {
                context: prev.context,
                _DOM: prev._DOM,
                resultVDOM: prev.resultVDOM,
            });
        },
```

这样就解决了 `props` 不同时，上下文共享的问题。

### 总结

本文探讨了加入 Hooks 支持，对 ComponentElement, DOM 操作和 diff 函数应该进行的修正。React 的 Hooks 设计非常的简洁优雅，可以通过简单的方式实现，但是实际的 React Hooks 考虑到性能问题会更加复杂，生命周期也会复杂化，从而 Hooks 的实现将更复杂。笔者也在实现过程中，为了准确性，认认真真再学习了一遍 React 的 Hooks，感觉还是很有收获！
