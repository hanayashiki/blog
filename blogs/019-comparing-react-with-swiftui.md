---
title: 入坑 iOS 开发：React 和 SwiftUI 的对比
slug: comparing-react-with-swiftui
date: 2021-12-19
abstract: 初尝 SwiftUI 和原生 iOS 编程，有哪些不同？
---

## SwiftUI 简介

根据苹果的[SwiftUI 官方简介](https://developer.apple.com/cn/xcode/swiftui/)，SwiftUI 是一个以声明式语法为亮点的 UI **框架**。

> SwiftUI 采用声明式语法，您只需声明用户界面应具备的功能便可。例如，您可以写明您需要一个由文本栏组成的项目列表，然后描述各个栏位的对齐方式、字体和颜色。您的代码比以往更加简单直观和易于理解，可以节省您的时间和维护工作。

SwiftUI 的代码大概长这样：

```swift
import SwiftUI

struct Content: View {
  @State var model = Themes.listModel

  var body: some View {
    List(model.items, action: model.selectItem) { item in
      Image(item.image)
      VStack(alignment: .leading) {
        Text(item.title)
        Text(item.subtitle)
          .color(.gray)
      }
    }
  }
}
```

习惯了 React, Vue 等声明式语法的你，是不是感觉到了熟悉的味道？如果拿 React 类比，上面的 `@State var model` 就像 Class Component 的 `this.state`，Functional Component 的 `useState`；`body` 就像 Class Component 的 `render` 或者 Functional Component 的函数体。而 `List`, `Image` 这些就像 JSX 的元素。

难道是高冷了许多年的 iOS 原生开发，向 Web 开发者递出了橄榄枝？本文以一个熟悉 React 和 TypeScript 但对 iOS 原生开发毫无经验的初学者的角度，浅析 SwiftUI 开发和 React 的不同，以及它们带给开发者的挑战。

## Swift 和 TypeScript 的不同

### 静态 VS 动态

Swift 是一门支持 OOP 和复杂类型的**静态语言**，而 TypeScript 充其量只是 JS + 类型标注，并且随时可以用 any 等放弃类型检查，但是 Swift 的编译是依赖于类型检测的，类型检查不过，编译就无法进行下去。和 TS 类似，Swift 也支持泛型、protocol （大约相当于 TS 的 interface）等高级概念，并且经常需要程序员和它们作斗争。

### 语法细节不同
   
1. 函数使用方法不同。和 JavaScript 简朴的 C 式函数调用不同，Swift 中可以分别指定 parameter 和 argument 的名字。调用的时候需要按顺序指定 parameter 的名字。

```swift
func greet(person: String, day: String) -> String {
    return "Hello \(person), today is \(day)."
}
greet(person: "Bob", day: "Tuesday")
```

1. 区别函数和闭包。Swift 中的闭包特指匿名函数，并且有特殊的语法。下面的函数等价于 `numbers.map((number) => 3 * number)`。笔者认为 Swift 这里的语法比较奇怪，没有 JS 的箭头函数直观简洁。

```swift
numbers.map({ (number: Int) -> Int in
    let result = 3 * number
    return result
})

// 等价于

numbers.map({ number in 3 * number })
```

1. 基本不支持末尾的逗号。Swift 中无论数组字面量还是函数调用等都不能在末尾加逗号。此处配合 XCode 卡顿的报错机制堪称一绝，

### Swift 使用 ARC 进行内存管理

和 JS 开发者几乎不需要担心内存管理的问题不同，身负诸多现代特性的 Swift 依然使用 ARC（自动引用计数）来进行内存管理。这意味着，你不能在回调函数中执行一个异步操作，而不把它的“句柄”放在一个涵盖其生命周期的对象上。

例如下面的 `class Clock`，它的 `start` 函数会执行一个异步操作（具体的话是使用了 [Combine](https://developer.apple.com/documentation/combine) 库，但是这不重要，我们只需要知道这个操作在 `start` 返回后还没有完成就够了）。

```swift
class Clock: ObservableObject {
    @Published private(set) var time = Date().timeIntervalSince1970
    private var cancellable: AnyCancellable?

    func start() {
        cancellable = Timer.publish(
            every: 1,
            on: .main,
            in: .default
        )
        .autoconnect()
        .sink { date in
            self.time = date.timeIntervalSince1970
        }
    }

    func stop() {
        cancellable = nil
    }
}
```

我们注意 `cancellable = Timer.publish` 这一步，将该异步操作的“句柄”赋值给了自身的 `cancellable` 属性。这一步在 JS 中是不需要的，但是在 Swift 中不可省略——如果不这么做，在 `start` 返回后该句柄就会因为没有被强引用而被销毁，而该操作也会终止。

第二个问题就是 ARC 需要开发者有意识地避免环形引用，造成内存泄漏。

## SwiftUI 和 React 的异同

### 同：SwiftUI 中视图值树是状态的函数，React 中虚拟 DOM 是状态的函数

SwiftUI 中 State 的变动引发 body 的重新求值，而 React 中也是 `setState` 引发当前虚拟 DOM 的递归重新求值。

例如下面的视图：

```swift
struct UpdateTest: View {
    @State var i = 0
    var body: some View {
        VStack {
            let _ = print("root update")
            Text("\(i)")
            Button("change") {
                i += 1
            }
            // circle 在每次刷新时都会重新计算
            VStack {
                let _ = print("circle update")
                Circle()
                    .fill(.red.opacity(0.5))
                    .frame(width: 50, height: 50)
            }
        }
    }
}
// Output
root update
circle update
root update
circle update
root update
circle update
```

### 同：SwiftUI 可通过祖先元素向子元素提供 EnvironmentObject，React 中可通过祖先元素向子元素传递 Context

```swift
// Our observable object class
// 编者：此处相当于 React.createContext
class GameSettings: ObservableObject {
    @Published var score = 0
}

// A view that expects to find a GameSettings object
// in the environment, and shows its score.
struct ScoreView: View {
    @EnvironmentObject var settings: GameSettings
    // 编者：此处声明了该组件需要 GameSettings 这一 EnvironmentObject

    var body: some View {
        Text("Score: \(settings.score)")
    }
}

// A view that creates the GameSettings object,
// and places it into the environment for the
// navigation view.
struct ContentView: View {
    @StateObject var settings = GameSettings()

    var body: some View {
        NavigationView {
            VStack {
                // A button that writes to the environment settings
                Button("Increase Score") {
                    settings.score += 1
                }

                NavigationLink(destination: ScoreView()) {
                    Text("Show Detail View")
                }
            }
            .frame(height: 200)
        }
        .environmentObject(settings)  // 相当于 Context.Provider
    }
}
```

上面实现了一个简单的父组件向子组件传递 `EnvironmentObject`（相当于 `React.Context`）的机制。同样和 React 类似的是，任何 `settings` 的更新皆会触发依赖 `GameSettings` 的视图的更新，无论这个更新是不是真的会影响视图值（相当于 VDOM）的计算结果。这里是不是可以看出，SwiftUI 借鉴了 Web 框架 “Just work” 的设计理念呢？

### 异：闭源黑盒 VS 开源“白盒”

在某些读者看来，这个可能是最重要的区别之一：无论是 SwiftUI 还是和 SwiftUI 的兄弟 Combine，都是**闭源**的。如果你点进去任意一个 SwiftUI 提供的类或者函数的定义，只能看到接口的类型定义，不能看到具体的实现。而 React 是 MIT 协议的开源框架，虽然本身代码比较难懂，但是社区也有不少相对易懂的诸如 [Preact](https://preactjs.com/) 的简化版实现，[解读 React 的文章](https://react.iamkasong.com/)也是铺天盖地。此外 React 的网红开发者 Dan Abramov 也强调：

> Making React internals simple is not a goal. We are willing to make React internals complex if that complexity lets product developers keep their code easier to understand and modify.

React 的开源本性和行为容易理解等特性使其赢得了开发者的喜爱，而且官方希望在开发者眼中 React 行为应该容易理解，容易控制。

SwiftUI 则是["让人兴奋同时让人失望"]()。SwiftUI 的基本特性虽然在官方文档中有介绍，但是也有许多表现没有得到详细定义，更可怕的是没有源代码可以参考。此外，SwiftUI 的样式布局等算法都是内置的，而不像 CSS/HTML 一样有标准定义和多家浏览器竞争式实现，要习惯它的特性、 bug 和版本更新都比 Web 开发更接近摸着石头过河。一句话，选择了 SwiftUI，就选择了“用个人之力对抗大公司”，你的命运是掌握在苹果一家手里的。

### 异：SwiftUI 的状态管理基于 Reactive Programming，React 对此无预设

回到刚才的例子，我们刚才用 `React.createContext` 一笔带过的 `Observable` 的定义，其实里面大有乾坤：

```swift
class GameSettings: ObservableObject {
    @Published var score = 0
}
```

这里的 `@Published` 实际上叫做一个 [Property Wrapper](https://docs.swift.org/swift-book/LanguageGuide/Properties.html)。Property Wrapper 是 Swift 的一个语法糖，可以劫持 property 的 getter/setter，从而实现观察变量变化等操作。而这里的 `@Published` 恰好就是实现这一观察功能的，具体来说，它是通过定义一个 [Combine](https://developer.apple.com/documentation/combine) 中的 [Publisher](https://developer.apple.com/documentation/combine/publisher) 实现的。

*对于熟悉 RxJS 的同学而言，Combine 的功能和其可以简单类比：Publisher 对应 Observable，Receiver 对应 Observer，等等。同时也有 Operator 等概念，可以对 Publisher 进行组合、转换等操作，简化对异步事件流的处理。*

对于不熟悉 RxJS 的同学而言，我们首先需要解释什么是 [Reactive Programming](https://reactivex.io/)，而 Combine 基本上是 Reactive Programming 在 Swift 上的再实现。在讲概念之前我们先举一个简单的例子：Debounce 操作符。

![](/2021-12-11-14-43-18.png)

如上图所示，位于上方的是一个**事件流**——每个点代表在该时间点发生了一个事件。实际中，这个事件可能是用户鼠标点击，或者是输入框中的文字变化。接着，Debounce 将这个事件流进行了操作：它在接受输入事件时，会等待 0.5s，如果这期间没有新的事件来，它就会把该事件转发给下游；如果有的话，它就继续等 0.5s。

等价的 Combine 代码如下：

```
settings.$input
  .debounce(for: 0.5, scheduler: RunLoop.main)
  .removeDuplicates()
  .sink { value in /* Do something with the value */ }
```

Reactive Programming 中，操作的粒度是**事件流**。这和 `Array.reduce`, `Array.map` 等操作有异曲同工之妙——这些函数操作是以 Array 为整体的。然而 Reactive Programming 较难以理解之处是在于它需要在时间的维度上去认识问题，这对于我们这些只能直接感受到三维的生物需要一点想象力。

在 SwiftUI 中，Combine 被作为基础设施广泛使用，所以学习 SwiftUI 可以说是逃不开学习 Reactive Programming 了。例如刚刚讲的 `ObservableObject`，如果你需要全局的状态，你就逃不掉 Combine。这点和 Angular 比较类似——Angular 也是基于 RxJS 去实现状态管理的。具体而言，`@Published` 修饰的属性会被封装成一个 `Publisher`，而每次对该组件的赋值操作，都会向它的所有 `Subscriber` 发送这个值，也会对新的 `Subscriber` 自动发送上次广播的值。这样，你的系统的其他部分就可以通过 `subscribe` 操作来观察这个值的变化了。

反看 React，官方仅仅提供了轻量的 Context 作为全局状态管理的工具。需要根据 Context 来更新视图？React 会根据 Context value 的变化为你重新渲染订阅它的整个组件树。如果需要更加高效、细粒度的状态管理，React 对此来者不拒，开发者可以根据需求选择常见的库去解决。Combine 或者 Angular 强推的 RxJS 固然强大，但是开发者很多时候的需求并不需要引入这么强大的库，也没有必要去学习这些困难的概念。

### 异：SwiftUI 对组件生命周期无完整控制能力，React 对于组件生命周期有完整的把握力

[SwiftUI 视图的生命周期研究](https://zhuanlan.zhihu.com/p/438864562)一文中写到：

> 在 UIKit（AppKit）的世界中，通过框架提供的大量钩子（例如 viewDidLoad、viewWillLayoutSubviews 等），开发者可以将自己的意志注入视图控制器生命周期的各个节点之中，宛如神明。在 SwiftUI 中，系统收回了上述的权利，开发者基本丧失了对视图生命周期的掌控。不少 SwiftUI 开发者都碰到过视图生命周期的行为超出预期的状况（例如视图多次构造、onAppear 无从控制等）。

对于习惯了 React 的初学者而言，很容易认为 View 实例的生命周期应该在实际渲染出来组件之前被创建，之后被销毁，并且系统应该提供可自定义的钩子来让开发者观察到这些事件。可惜，这些在 SwiftUI 中是不成立的。具体可以参考引用的文章。这点应该是对于 React 开发者而言，要保持原有思路最头疼的地方。许多可以用 `useEffect`, `useMemo` 完成的任务，因为生命周期的不确定性，可能需要放在 Combine 和 `ObservableObject` 中去完成。我认为 Apple 的用意可能是不希望开发者的 View 中包含太多业务逻辑，所以 keep it simple and stupid。无论这个设计决定如何，都是开发者需要注意的。

### 异：SwiftUI 不是“图灵完全”的框架，React 基本上是

如果我们使用了 React，大多数情况下可以和手动操作 DOM 说再见——然而 SwiftUI 并不是这样的。正如 [SwiftUI Lab](https://swiftui-lab.com/]) 所言：

> Yes, writing a standard application became much easier, but the reality is, none of our apps are standard. They are all unique in their own way. 

SwiftUI 中对你的 UI 有太多的主观性设定（too opinionated），甚至禁止用户进行一些自定义操作。例如 SwiftUI 默认值只有 `NavigationView` 和 `NavigationLink` 作为路由控制，如果你想要写点复杂点的路由，例如主动将用户移动到另外一个页面，你就得写点糟糕的代码了。你甚至无法得心应手地自定义导航栏。很多时候，我们得用官方的方案封装 `ViewController`，倒退回原始的 iOS 开发。（好吧，我不懂 UIKit，溜了。）

反观 React，它很虚心地只做 DOM 一层“薄薄”的封装，甚至提供了像 `ref`, `dangerouslySetHtml` 这样的接口让你随时有“逃生窗”，脱离 React 的控制。

## 总结

作为一个 React 的重度使用者，出生在 React 推出 6 年后的 SwiftUI 仅仅是看起来和 React 有点像，但是从体验上来看，我只能说现在入坑为时尚早（亦或永远都不要入坑）？虽然我没有对 UIKit 的知识，我只想说 SwiftUI 和 React 比起来，有三大特点：

1. 模糊了 UI Framework 和 Component Library 的边界。SwiftUI 有很多诸如 `NavigationView`, `TabView` 之类的开箱即用的控件，但是不支持高度的自定义。所以你要么用 Swift 的 modifier 来 “hack around”，要么自己用 UIKit start from scratch。
2. 强调框架托管。SwiftUI 不打算把生命周期的控制权和观察权交给开发者，很多 React 的思路在 SwiftUI 这里行不通。
3. 对于状态管理有强烈的使用 Reactive Programming 的倾向。

这三座大山都让 SwiftUI 开发很有难度，想要乘 SwiftUI 的东风越过 UIKit 这座大山是不可能的。如果真的想搞 App 开发，用 React Native 对于掌握 React/Vue 等现代前端框架的初学者而言是更好的选择。

## 参考资料

1. https://zhuanlan.zhihu.com/p/438864562
2. https://www.swiftbysundell.com/articles/combine-self-cancellable-memory-management/
3. https://www.hackingwithswift.com/quick-start/swiftui/how-to-use-environmentobject-to-share-data-between-views