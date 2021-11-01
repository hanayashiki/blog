---
title: React 的根本问题
slug: basic-problems-with-react
date: 2021-02-01
abstract: React 它自己有哪些问题？
---
*前情提要：本文并非讲述 React 初学者可能遇到的问题。*

我们都知道每个语言和框架都有自己的根本问题，即这些问题是工具本身的，不是开发者能够通过学习正确的使用方法、开发库去（优雅地）解决的。例子如下：

1. 早期 JavaScript `==` 的问题

![Thank you JavaScript](https://i.redd.it/rz3o1yibnc511.png)

2. 缺少 block scoped variable 的问题 (let vs var)

3. C/C++ 的内存安全问题。

那么 2021 年的 React 是否有这些问题呢？平时比较少看到汇总的讨论，而通常是零散的抱怨。我希望能总结一下。

## React is JUST a library

虽然官网上介绍 React 的第一句话就是 

> A JavaScript library for building user interfaces

但是大家想到 React 第一感觉还是它是个 “Framework”。经过重重的配置（包括对[CRA](https://reactjs.org/docs/create-a-new-react-app.html)的妥协）、学习 JSX、理解 Component 和 Hooks，结果只是学了个 library，只站起了前端一条腿——渲染HTML，另外一条腿——数据管理的支持是不足的。于是 React 和层出不穷的状态管理搭配，每一种状态管理都夸奖自己是最好的：

+ Redux
+ MobX
+ XState
+ useContext/useReducer
...

这导致了 React Project 呈现出百家争鸣、百花齐放的局面，一方面确实给了开发者自由，一方面则让初学者容易陷入不知如何选择的境地，也加重了学习负担。同时，每一个新的 React Project 都需要进行选择：这个项目到底够不够复杂以至于我们要用 Redux 呢？React 自带的 `useContext` 是不是就够用了呢？这让程序员也许在*写* React 的时候感觉很快乐，但是*开始*一个 React Project 绝对不快乐。

那么你是要自由，还是要开箱即用？这很难讲是 React 本身的问题，但是确实是用 React 带来的问题。

## Hooks 对 JS 的微妙特性过于依赖

这个问题用以下的代码最好描述 

```
function MyComponent() {
    const [a, setA] = useState(0);
    useEffect(() => {
        setTimeout(() => {
            console.log(a);
        }, 10000);
    }, []);
    return <button onClick={() => setA(a + 1)}>increase</button>;
}
```

这渲染了一个按钮，点一下 `a` 就会增加 1，然后 10 秒后在控制台输出 `a` 的当前值。

如果你踩过坑，一定会知道 `console.log(a)` 不会打印点击的次数，而是 0。为什么会这样呢？因为 `a` 的值在 `useEffect` 最早执行的时候就被捕获了，之后就不会改变了。之后 `setA` 执行进行的重新渲染，都不会影响到 `console.log(a)` 的 `a` 的值。

关于这个问题，Dan Abramov 写了一篇很好的[解释](https://overreacted.io/making-setinterval-declarative-with-react-hooks/)。

正确的写法应该是：

```
function MyComponent() {
    const aRef = useRef(0);
    useEffect(() => {
        setTimeout(() => {
            console.log(aRef.current);
        }, 10000);
    }, []);
    return <button onClick={() => aRef.current++}>increase</button>;
}
```

对于 `useRef` 而言，`aRef.current` 始终等于最新的 “a”，所以避免了 `useState` 过早决定的问题。但是这也牺牲了响应性：React 的重新渲染不能依赖 `aRef.current` 的变动。

嗯，是第一种错误是程序员的锅，可是我们想想，这样的模型是容易理解的吗？以我一家之言，函数式组件**过度**依赖了 JS 的微妙特性（或者说是坑）。

理想的模型：函数式组件的函数将**当前的** `props` 映射到组件**当前的**行为。这个行为包括：它渲染出的 HTML，以及执行的 "effect"。

现实的模型：函数式组件确实很不错地将**当前的** `props` 映射到了组件对应的 HTML，却不能将当前的 `props` 映射到组件当前应该执行的 “effect”。

根本的问题：函数式组件依赖 JS 提供的闭包特性，both good and bad。

那么我们有没有办法让第一种 "不正确的写法" 正常运行呢？假设我们提出一种语法 `@state`，用来专门定义 React 的 state：

```jsx
// Imaginary syntax
@React.FC // Well we might need to specially mark a functional component
function MyComponent() { 
    let @a = 0; // equals to 'const [a, setA] = useState(0)'
    useEffect(() => {
        setTimeout(() => {
            console.log(@a); // Evaluation of `a` is deferred until it is used, to fetch the latest `a`.
        }, 10000);
    }, []);
    return <button onClick={() => @a++}>increase</button>;
}
```
 
 由于函数式组件“现实”和“理想”的差距，实际上隐式为 React 的状态管理带来了很大的问题。React 的程序员没有办法快乐地使用 `useState`，不能把它们当作“纯粹的可观察变量”。这间接推动了 React 状态管理“百花齐放”的局面。

## 缺乏对异步的原生支持

一个常见的模式是一个 React 组件开始渲染时会向后台请求资源，这个时候显示一个 Loading；然后资源加载完成或发生错误，返回对应的 data 或 error。那么我们看看，实现这样一个功能，需要多少 boilerplate 呢？

```jsx
function Loadable() {
    const [resourceA, setResourceA] = useState(undefined);
    const [resourceAError, setResourceAError] = useState(undefined);

    useEffect(() => {
        fetcher('/resource')
            .then(a => setResourceA(a))
            .catch(e => setResourceAError(e))
    }, []);

    if (resourceAError) return <div> Error! </div>;
    if (resourceA) return <div> Hello {resourceA.name} </div>;
    return <div> Loading... </div>
}
```
光是加载一个 `resourceA` 我们就要引入至少两个 state: `resourceA, resourceAError`，一共四个变量：

`resourceA, resourceAError, setResourceA, setResourceAError`。

4 听起来不多，当你的页面需要加载两三个资源的时候，代码就会变得有些难看了。

我也知道这时候你在想，`.then` 已经是被抛弃的语法了，我们该用 `await/async` 了。OK，这样就要引入更丑陋的语法：

```jsx
function Loadable() {
    const [resourceA, setResourceA] = useState(undefined);
    const [resourceAError, setResourceAError] = useState(undefined);

    useEffect(() => {
        (async () => {
            try {
                setResourceA(await fetcher('/resource'));
            } catch (e) {
                setResourceAError(e);
            }
        })();
    }, []);

    if (resourceAError) return <div> Error! </div>;
    if (resourceA) return <div> Hello {resourceA.name} </div>;
    return <div> Loading... </div>
}
```

为了解决这个问题，你可能要用 [useAsync](https://github.com/streamich/react-use/blob/master/docs/useAsync.md), [useSWR](https://swr.vercel.app/), 或者干脆使用 Redux。我知道 React 只是一个 UI Rendering Library，可是对于这些十分常见的需求，它坚决不提供任何官方支持。这再一次让 *开始* 一个 React Project 变得非常的困难。

## 总结

我知道对 React 的吐槽能一直写下去，所以在这里就打住了。不用说 React 对状态管理本身只提供半套支持，它本身对现代CSS, Server-side Rendering 无加成、语法比较啰嗦、非要用 Flow 标注类型等特点，都促使了基于 React 的框架不断产生去解决它留下的坑（或者说，负责它所界定的责任之外的事情）。当然 React 本身的渲染功能也不能说完美， `react-dom` 体积过大由催生了 Preact，不过目前我还没有深刻的体会。如有需要，另写文章骂它。
