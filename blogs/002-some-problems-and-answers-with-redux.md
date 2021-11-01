---
title: Redux 的几个问题和答案
slug: some-problems-and-answers-with-redux
date: 2020-12-15
abstract:
  相信读者已经知道为什么要用 Redux 了，本文不再赘述 Redux 的原理，直接谈谈 Redux 的几个问题与解决方案。
  警告：只适合用 TypeScript 的类型强迫症患者。
---

笔者刚接触 Redux 的时候，是将信将疑的。我不是怀疑 Redux 的 [动机](https://redux.js.org/understanding/thinking-in-redux/motivation)，而是怀疑按照规范写 Redux 的代码是不是真的实际。

在开始之前，我们先复习一下 Redux 的三大概念：


1. 


```
type State = any
```

State 是全局性的状态树。


2. 


```
type Action<T, P> = {
  type: T,
  payload: P
}
```

Action 表示 (type, payload) 要对 State 进行改变。

3. 


```
type Reducer<S, A> = (state: S, action: A) => S
```

Reducer 表示如果我在当前 state，输入一个 action，如何得到新的 state。

在程序执行中，我们有一个初始的 state: `S_0`，外在的输入（用户操作、IO、计算任务等）不断产生新的 action `A_1, A_2, ..., A_n`，reducer 则根据 `(S_0, A_1)` 计算得到 `S_1`，又根据 `(S_1, A_2)` 计算得到 `S_2`...，如此下去我们得到这样的时序：

```
S_0 -[A_1]-> S_1 -[A_2]-> S_2 ... -[A_n]-> S_n
```

然后在 React 中，我们将每步的 `S_i` 映射成相应的 UI，这样就得到了呈现在用户眼中的 UI。

有了以上的准备，接下来我们抛出几个问题：

## 类别不定的 Action

现在假设我们的中型项目有 50 种 `Action<T, P>`，他们有不同的 `type` 和 `payload`，那么问题来了，当我们用 `store.dispatch` 的时候，该如何知道我们在做什么？

```
store.dispatch({
  type: "CREATE_WHAT",
  payload: "WHAT_IS_THE_PAYLOAD"
})
```

换句话说，由于 `store.dispatch` 对类型无限定，我们无从得知其中的 `type` 是不是我们定义过的，更糟糕的是不知道 `payload` 的类型是不是对应 `type`。

解决方案 1：

根据官方指南，我们**不应该**直接 `dispatch([object literal])`，而应该用 `ActionCreator` 返回 action 对象。

```
type ActionCreator<A, P extends any[] = any[]> = (...args: P) => Action

const loadSuccessful = (count: number) => ({ 
  type: "LOAD_SUCCESSFUL",
  payload: {
    count,
  }
})

store.dispatch(loadSuccessful(5))
```

解决方案 1 如何能解决类型无限定的问题呢？我们只要约定好，`dispatch` 的参数必须是 `ActionCreator` 的返回值，那样便将 `type` 和 `payload` 进行了绑定（当然，同时也无法 `dispatch` 一个未知的 `type` 了），我们无须再担心 `dispatch` 的 Action 类型不定了。

我相信你已经能观察到解决方案 1 又制造了不少问题。

1. 语义重复

我们首先定义了 `loadSuccessful` 作为这个 `ActionCreator` 的名字，这已经足以表达这个 Action 的语义了，可是我们为了 `reducer` 在技术层面区分不同的 Action，又要显式地用字符串  `"LOAD_SUCCESSFUL"` 来描述同一个意思。这种 boilerplate 是编程中必须避免的。

2. 类型不可知

我们刚刚说解决了类型无限定的问题，为什么这里又说类型不可知呢？因为我们仅仅解决了 Action 的类型输入问题（如何构造符合类型要求的 Action），而没有解决 Action 的类型输出问题。我们依然无法系统地确定 `loadSuccessful` 返回的 Action 类型。

即使你用 

```
type LoadSuccessfulAction = ReturnType<typeof loadSuccessful>
```

你只能推断得到这样的[类型](https://codesandbox.io/s/f5nr9?file=/index.ts)：

```
type LoadSuccessfulAction = {
    type: string;
    payload: {
        count: number;
    };
}
```

注意由于 TypeScript 的特色，我们这里无法得到 `type` 的类型 `"LOAD_SUCCESSFUL"` ([字面量类型](https://jkchao.github.io/typescript-book-chinese/typings/literals.html))，只能得到 `string`。

当然啦，这个问题可以用以下[方式](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-4.html#const-assertions)重写 `loadSuccessful` 解决：

```
const loadSuccessful = (count: number) => ({ 
  type: "LOAD_SUCCESSFUL" as const,
  payload: {
    count,
  }
})

type LoadSuccessfulAction = ReturnType<typeof loadSuccessful> // Correctly induced
```

但终究还是稍显啰嗦，程序员容易忘记这个 `as const` 这个尾巴。更何况，这里又引入了 `LoadSuccessfulAction` 这个新的名字，以及 `typeof loadSuccessful` 这个重复性的引用。看，光是一个 `loadSuccessful` 就以三种形态(小驼峰、大驼峰、大写常量型) 在这里重复了四遍！

更何况，即使这样，也无法彻底解决类型不可知的问题。我们没能定义这样一种映射，将 `type` 常量映射到对应的 `payload`。这在 Reducer 中我们需要复原 Action 的类型时造成了困难。

解决方案 2:

我们定义一个模板函数来一劳永逸地解决上面的问题：

首先我们跳出 TypeScript 杂乱的类型定义，看看我们要定义什么 JS 函数：

```
function createActionManager(actions) {
    const creators = {};
    const guards = {};
    Object.entries(actions).forEach(([type, payloadCreator]) => {
        creators[type] = (...args) => ({
            type,
            payload: payloadCreator(...args)
        });
        guards[type] = (action) => action?.type === type;
    });
    return {
        creators,
        guards
    };
}
```

```
const { creators, guards } = createActionManager({
    loadSuccessful: (count) => ({
        count,
    }),
    loadFailed: (reason) => ({
        reason,
    })
});
```

这里我们定义的函数 `createActionManager`，输入一个 actions 定义，然后输出对应的 action creators 和 type guards。这个定义实际上是一些 payload creators：用户只需要给出一个 object，它的 key 是 action 的名字，value 是参数到 action payload 的映射。给出了这个定义，用户就可以用我们为他生成的函数来创建 action 和找回已经创建的 action 的类型了。

```
let action1 = creators.loadSuccessful(123);
console.log(action1);
let action2 = creators.loadFailed("noreason");
console.log(action2);
if (guards.loadSuccessful(action1)) {
    console.log("Action 1 is loadSuccessful");
}
if (!guards.loadFailed(action1)) {
    console.log("Action 1 is not loadFailed");
}
```
输出：

```
[LOG]: {
  "type": "loadSuccessful",
  "payload": {
    "count": 123
  }
} 
[LOG]: {
  "type": "loadFailed",
  "payload": {
    "reason": "noreason"
  }
} 
[LOG]: "Action 1 is loadSuccessful" 
[LOG]: "Action 1 is not loadFailed" 
```

可以看到，我们只定义了如何创建 payload，我们就可以用 `creators.*` 来创建带类别标签的 action 以及可以用于判断 action 类型的 `guards.*` 了。同时加上了类型定义后，TS 可以帮助我们确定 action 的类型，让 action 的类型容易控制。
由于我也不太懂 TypeScript 的原理，这里就不班门弄斧解释如何用 TS 去定义 `createActionManager` 的类型了。如果有兴趣可以在 https://codesandbox.io/s/typescript-playground-export-forked-4cicf?file=/index.ts 看看。 

这样我们就解决了 Action 的两个问题：

1. 每个 action 的名字只定义一次，在 `actions` 的 key 中给出，而不是到处重复。
2. action 的类型可以通过 guards 去判断和复原。

## 语义重复的 Action

第二个问题就是，如果我们有页面 Page1, Page2... Page10，每个页面都需要加载一些动态或静态的资源，这又会造成一个头疼的问题：

+ Page1 需要 `loadPending`, `loadSuccessful`, `loadFailed`, `loadCancelled` 四种 action （也许更多，视乎粒度）。
+ Page2 需要 `loadPending`, `loadSuccessful`, `loadFailed`, `loadCancelled` 四种 action。
...
+ Page10 需要 `loadPending`, `loadSuccessful`, `loadFailed`, `loadCancelled` 四种 action 。

如果我们对每个 Page_i 都去这样定义四种 action，就需要定义 40 个这种乏味陈旧的 action。虽然这四种 action 较为固定，不容易变动，可重复的代码终究不是什么好事。

相信聪明的已经理解了 `createActionManager` 的你已经能想到如何解决这种窘况了，我们可以定义一个基于它的函数 `createLoadingActionManager` 来解决这个问题。这个函数专门用来生成每个 Page 的 action “四件套”。

```
function createLoadingActionManager(pageName) {
    return createActionManager({
        [`${pageName}LoadPending`]: () => ({}),
        [`${pageName}LoadSuccessful`]: (resource) => ({ resource }),
        [`${pageName}LoadFailed`]: (error) => ({ error }),
        [`${pageName}LoadCancelled`]: () => ({}),
    });
}
const homePage = createLoadingActionManager("homePage");
console.log(homePage.creators.homePageLoadSuccessful({
    answer: 42
}));
```

```
[LOG]: {
  "type": "homePageLoadSuccessful",
  "payload": {
    "resource": {
      "answer": 42
    }
  }
} 
```

关于类型定义的部分，由于使用了 [Template Literal Types](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-1.html#template-literal-types)，你需要安装 TS > 4.1 才能正确运行定义部分的代码： https://codesandbox.io/s/typescript-playground-export-forked-4cicf?


## 令人困惑的 Thunk

首先我们摘取 `reduxjs/redux-thunk` [Readme](https://github.com/reduxjs/redux-thunk) 中的例子，来回顾一下什么是 Thunk。

```
function incrementIfOdd() {
  return (dispatch, getState) => {
    const { counter } = getState();

    if (counter % 2 === 0) {
      return;
    }

    dispatch(increment());
  };
}

store.dispatch(incrementIfOdd());
```

相信很多人第一眼看到 thunk 都懵了，一个高阶函数，返回一个有两个神秘参数的函数，然后这个函数，作为返回值，还能像普通 action 一样被 dispatch。当然，thunk 虽然看起来很多此一举，有点故弄玄虚，但是它的特性确实是我们需要的。

关于 thunk，我必须推荐一下这篇文章：https://medium.com/fullstack-academy/thunks-in-redux-the-basics-85e538a3fe60。这篇文章的干货在于解释了 thunk 的意义是什么，以及为什么这样的代码不好：

```
function incrementIfOdd() {
  const { counter } = store.getState();
  if (counter % 2 === 0) {
    return;
  }

  dispatch(increment());
}

incrementIfOdd();
```

但是问题依然没有完全解决。假设我们需要定义以下的 Counter 模块: 

```
import { connect } from 'react-redux'

type Props = {
  count: number;
  increaseAsync: () => void;
}

function CounterComponent(props: Props) {
  return (
    <>
      <Text>
        {props.count}
      </Text>
      <Button title={"increase"} onPress={props.increaseAsync}/>
    </>
  );
}

const Counter = connect(
  mapStateToProps,
  mapDispatchToProps,
)(CounterComponent);
```

这里我们用老套的例子，点击按钮 “increase”，那么隔一秒 `props.count` 就会增加 1。

我们可以看到，尽管我们可以标注 `Props` 的类型，但是 `connect` 的类型我们一无所知。

好在，`react-redux` 中提供了 `connect` 的基础类型 `Connect`:

```
export interface DefaultRootState {}
...
export interface Connect<DefaultState = DefaultRootState> {
  ...
}

export const connect: Connect;
```

可以看到，`connect` 的默认类型 `Connect<DefaultState = DefaultRootState>` 类型并不是我们想要的，我们可以提供我们自己的参数来替换他。

```
import {
    Connect, 
    connect as _connect,
} from 'react-redux';

type RootState = {
  homePage: HomePageState,
  blogs: BlogsState,
  ...
};

export connect = _connect as Connect<RootState>;
```

## 不堪重负的 Reducer

一个典型的 Reducer 长这样：

```
const initialState = { value: 0 }

function counterReducer(state = initialState, action) {
  switch (action.type) {
    case 'increment':
      return { ...state, value: state.value + 1 }
    case 'decrement':
      return { ...state, value: state.value - 1 }
    case 'incrementByAmount':
      return { ...state, value: state.value + action.payload }
    default:
      return state
  }
}
```

假如我们的 state 复杂一点

```
const initialState = {
  nest1: {
    nest2: {
      nest3: {
        value: 0
      },
     other: 3,
    },
    other: 2,
  },
  other: 1,
}
```

那么我们的 reducer 就得长这样：

```
function counterReducer(state = initialState, action) {
  switch (action.type) {
    case 'increment':
      return { ...state, nest1: { ...state.nest1, { ...state.nest1.nest2, nest2: { /* 不想写了 */ } } } }
   ...
  }
}
```

还好，我们有 [immer](https://immerjs.github.io/immer/docs)。如果你还没有听说过 immer，那你一定会对它相见恨晚。immer 的作用很简单，就是令你可以直接修改老的 state，然后在此基础上返回一个新的 state。

```
import produce from "immer"

const { creators, guards } = createActionManager({
  increment: () => ({}),
  decrement: () => ({}),
  incrementByAmount: (amount) => ({ amount })
});

const counterReducer = produce((draft, action) => {
  if (guards.increment(action)) {
    draft.nest1.nest2.nest3.value += 1
  } else if (guards.decrement(action)) {
    draft.nest1.nest2.nest3.value -= 1
  } else if (guards.incrementByAmount(action)) {
    draft.nest1.nest2.nest3.value += action.amount
  }
})

```

这样配合我们之前定义的 `createActionManager`，是不是让工作简单很多？

## 结束

如果你有心看到这里，又是个初学者，一定会悲叹：要把 Redux 用在生产中，可真麻烦！

我们刚才定义了多少辅助函数？

`createActionManager`, `createLoadingActionManager`

引入了多少外部依赖？

`redux-thunk`, `react-redux`, `immer`... 还有更多 redux 的扩展我们没有提及。

Redux 可以开箱即用吗？可以的。

请看 redux 官方背书的 Redux Toolkit: https://redux-toolkit.js.org/

我故意把这个留在最后，就是为了不让读者 TL;DR，跳过本文中的代码和原理的部分。

Redux Toolkit 在本文基础之上又提供了许多高阶函数，以适合现代的开发模式。
例如 [createSlice](https://redux-toolkit.js.org/api/createSlice)


```
import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface CounterState {
  value: number
}

const initialState: CounterState = { value: 0 }

const counterSlice = createSlice({
  name: 'counter',
  initialState,
  reducers: {
    increment(state) {
      state.value++
    },
    decrement(state) {
      state.value--
    },
    incrementByAmount(state, action: PayloadAction<number>) {
      state.value += action.payload
    },
  },
})

export const { increment, decrement, incrementByAmount } = counterSlice.actions
export default counterSlice.reducer
``` 

有了 `createSlice`，连 action 和 reducer 的定义都可以放在一起了。比我们土制的 `createActionManager` 更能减少 boilerplates。当然了，减少 boilerplates 必然会增加约束，到底要不要使用 `createSlice` 要取决于具体需求。

[createAsyncThunk](https://redux-toolkit.js.org/api/createAsyncThunk) 则一举包揽了异步请求和生成生命周期动作 (fulfilled, rejected, pending)。

```
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { userAPI } from './userAPI'

// First, create the thunk
const fetchUserById = createAsyncThunk(
  'users/fetchByIdStatus',
  async (userId, thunkAPI) => {
    const response = await userAPI.fetchById(userId)
    return response.data
  }
)

// Then, handle actions in your reducers:
const usersSlice = createSlice({
  name: 'users',
  initialState: { entities: [], loading: 'idle' },
  reducers: {
    // standard reducer logic, with auto-generated action types per reducer
  },
  extraReducers: {
    // Add reducers for additional action types here, and handle loading state as needed
    [fetchUserById.fulfilled]: (state, action) => {
      // Add user to the state array
      state.entities.push(action.payload)
    }
  }
})

// Later, dispatch the thunk as needed in the app
dispatch(fetchUserById(123))
```

等等，建议读者详细阅读文档。

Redux 的一大问题就是学习者找不到方向。Redux 本身是很难用在应用上的，它只是一个概念，却不是一个工具。基本的 action, reducer, state 虽然是理论上完备的，但是应用中不可能那样去写代码。本文介绍了几个简单的方法把 action, reducer 的定义进行浓缩和简化，以适应应用场景。但是本文不建议在生产中自己定义这些轮子，而推荐使用 `Redux Toolkit` 等较为知名的库来应用 Redux。

但是，我们定义的这些轮子就真的没有用了吗？首先，写代码要知其然也知其所以然，如果我们用了高阶工具，享受了其带来的便利，却不知道这些工具到底是怎么回事，最终你的成长就如同空中楼阁。通过写这几个简单的函数，我们实际上经历了三个阶段：

1. Redux 真垃圾，理论很漂亮，实际上根本生产用不了嘛。
2. Redux 虽然垃圾，但是我们封装调整过后还是挺顺手的。
3. 万变不离其宗，封装后的 Redux 不影响其原理，却将实践和理论结合在了一起，也让我们对 Redux 的理解更深入了。

同时我们在写轮子的时候，也许也经历了开源开发者的心路历程，在思考怎么便利使用的时候，总结了生产中的常见模式，这对以后的开发绝对是有益处的。

最后，我把几篇参考文章贴在下面，这几篇文章也非常的好，无论看没看懂本文，都适合补充阅读：

1. 关于为什么要使用 Thunk 的文章： https://medium.com/fullstack-academy/thunks-in-redux-the-basics-85e538a3fe60

2. Redux 的理论部分： https://redux.js.org/understanding/thinking-in-redux/motivation

3. Redux Toolkit 官方文档： https://redux-toolkit.js.org/

4. TypeScript Deep Dive (中文翻译)： https://jkchao.github.io/typescript-book-chinese/

写本文的时候用的工具

1. https://www.typescriptlang.org/play

  TS 官方沙盒，开箱即用，适合写小段代码来研究 TS。

2. https://codesandbox.io/

  Code Sandbox 不用介绍了。
