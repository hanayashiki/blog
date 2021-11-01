---
title: 为什么我的 React Component 不停地重新 mount / unmount?
slug: why-does-my-react-component-mount-and-unmount-indefinitely
date: 2020-12-31
abstract: 这和 React 的 Reconciliation 机制有关。
---

首先介绍一下问题发生的场景：

我有两级 Component：

```
function Parent() {

  const [loaded, setLoaded] = useState(false);

  const renderContent = () => {
    return (
      ...
      <Child onLoaded={() => setLoaded(true)}/>
      ...
    )
  }

  return (
    ...
    <renderContent/>
    ...
  )
}

function Child({ onLoaded }) {
  useEffect(() => {
    fetch(...).then(...).then(onLoaded)
  }, []);
  return ...;
}
```

大概就是这样的结构。注意 `Parent` 用一个叫 `renderContent` 的函数渲染了部分子组件，包括 `Child`。`Child` 加载后会进行一个异步调用然后回调一个影响 `Parent` 内部状态的函数。

如果这样写的话，看起来 `Child` 应该只加载一次，然后 `Parent` 和内部状态变化（显示loaded），然后就结束了。但是实际上会出现接下来的情况：

`Child` `useEffect `执行加载， 触发函数 `Parent` 执行，导致 `Child` 被 unmount 后继续 mount，`Child` 又加载，循环反复。。

原因是什么呢？其实很简单，我们只需要参考官方的文档：https://reactjs.org/docs/reconciliation.html 。这种情况的发生，和 React 的启发性比较组件树的差别的方法有关。当 `Parent` 的内部状态或 `props` 改变，它会重新计算组件树，React 用以下方法得出，哪些子组件消失了，哪些子组件保留下来。

关键在于：

> If we used this in React, displaying 1000 elements would require in the order of one billion comparisons. This is far too expensive. Instead, React implements a heuristic O(n) algorithm based on two assumptions:

>    Two elements of different types will produce different trees.

>    The developer can hint at which child elements may be stable across different renders with a key prop.

注意这里：如果两个元素的“类型”不同，React 假设它们会生成不同的树。

如果按照我们刚才的写法，`<renderContent/>` 会被当作定义了一个元素。然而每次执行 `Parent` 函数时，`renderContent` 会被重新定义，所以 React 会把两次渲染定义出的 `renderContent` 当作不同的元素。

那么解决方案就是，我们需要告诉 React `<renderContent/>` 不是一个元素，这样它返回的元素序列就会被 React 进行正常的比较，从而不会 unmount/mount 的事件。

因此修改后的代码如下：


```
// Parent

  return (
    ...
    {renderContent()}
    ...
  )
```
