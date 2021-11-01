---
title: 为什么 WebSocket 应用中，客户端主动向服务器发送请求不是一个好的实践？
slug: why-sending-request-in-websocket-is-not-good
date: 2020-12-30
abstract: 当我们发现程序中需要用 WebSocket 的时候，我们不应该把 HTTP 的事情也交给 WebSocket 去做。
---

本人最近在实现一个嵌入应用中的聊天软件，但是总是困扰于 WebSocket 的维护问题。大体场景是这样的：

1. 客户端和服务器仅用 WS 通信。

2. 客户端通过 WS 发送一个带 ID 的请求，服务器用该 ID 回复请求。

3. 客户端每个链接建立时与服务器进行验证。

4. 服务器主动向客户端发送实时的聊天信息。

但是这样做带来了不少困扰：

1. 当客户端 WS 切断时，无法向服务器发送消息。因此，客户端每次发送消息前，需要检查链接是否还是正常的 (`WebSocket.readyState=1`)，而且要经过认证。如果已经切断，需要重新连接和认证。

2. 由于缺少检查网络情况的 API，WS 断线无法可靠检测。

3. 需要保证客户端一次只有一个 WS 连接，因此每次建立连接时需要加锁。

4. 状态多而复杂，难以进行测试。

痛定思痛，许多时间都在维护这个聊天客户端中消耗了。相反服务端的问题较少，因为服务端地位是被动的，流程比较简单：

1. 接受连接。

2. 处理消息直到连接被切断。

3. 推送新消息。

我认为一个让客户端最为复杂化的地方就是，利用一个 WS 连接来从客户端主动发送消息给服务端。因为这个其实相当于把 HTTP 来实现的事情交给 WS 去实现了。但是，WS 并不是一个处理请求/回复的协议，所以你基本上需要把 HTTP 本身的功能在 WS 中实现一遍。

这里的功能不仅仅包括请求、回复和报错，实际上用 HTTP1.1 之后还有 Keep-Alive 功能，客户端会与服务器建立连接池，使用起来性能更好。

但其实 HTTP 更大的优点是它本身是 stateless 的，这极大简化了我们的设计。我们不需要考虑有没有连接和认证，就可以直接发送请求，而连接的部分已经由 HTTP 的 API 替我们进行处理了。

如果用 HTTP 替代了 WS 中的请求/回复，我们至少解决了问题 1的困扰，但是问题 2, 3 仍然存在，但至少我们的客户端现在有了两个很好的性质：

1. WS 中只有服务端主动向客户端发送信息。

2. 客户端的主动请求和 WS 连接状态无关。

所以我们的任务集中在做好两件事情：

1. 客户端尽力和服务器保持一个 WS 连接。

2. 客户端需要处理服务器发送来的消息。

这两个任务又是相对独立的。任务 1 是 WS 客户端特有的问题，但是已经有不少解决方案，例如 `reconnecting-websocket`。任务 2 则类似于把客户端和服务器的关系逆转过来，客户端现在需要处理服务端的请求了。

然而任务 2 并不意味着客户端要应用服务端的编程方法，它其实更类似于 Redux 中的 Action/Reducer 模式。每个服务端的消息，都是客户端需要处理的一个 Action，客户端接到这个 Action 后，用 Reducer 转换自身的状态。假设客户端和服务器都用 JavaScript 实现的话，完全可以把 Redux 直接引入进来：

```
// server.js

connection.send({
  type: "INCREMENT",
  amount: 1
});  // Anagolous to `dispatch({...})`

```

```
// client.js
const store = createStore(...);
let ws = new WebSocket('ws://server')
ws.onmessage = (message) => {
  const action = JSON.parse(message);
  store.dispatch(action);
}
```

关于 Redux 的复杂性的问题，参考我的前一篇文章：https://blog.chenyu.pw/#/2 。

这样实际上 server 一旦和 client 建立了连接，就变成了一个“远程 action dispatcher”。server 的任何 action 在 redux 部分眼里和 client 自身产生的 action 无异。我们 client 中在 redux 上花费的功夫，都可以在处理 WS 事件中得到复用。

这点在 server 编程中是不可能做到的。首先 server 自身需要保持无状态，因此 redux 的 store 在 server 中无用武之地。第二就是 server 不能信任 client，server 的内部功能不能对 client 开放，然而 client 的内部功能（例如 reducer和action）的定义却可以对 server 开放。

以上就是我根据实践的一点思考，也是接下来（遥遥无期的）重构的一个方向。如果你和我一样不幸没有触碰到 WS 的 sweet spot，也没有关系，因为凭借足够的测试也可以让一个不太好的架构稳定运行，不一定要重构 :(
