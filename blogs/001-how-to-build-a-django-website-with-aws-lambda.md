---
title: 如何用 AWS Lambda 构建 Django + React 网站
slug: how-to-build-a-django-website-with-aws-lambda
date: 2020-12-01
abstract: 本文总结如何用 AWS Lambda 构建本网站，并且对 Lambda 的好处和坏处进行总结，然后总结一下踩过的坑。
---

**注意：本网站的技术架构已经更新。**

如果要实践一个想法，最好的办法是写一个个人项目。这个项目需要只对你自己负责，从而可以有自由发挥的空间。这个网站首先是需要实现我的两个想法：

1. 如何用 Serverless 的方式构建后端。
2. 如何用标准的 Redux 范式构建前端。第二个想法需要另外一篇博文记录。

首先，为什么要用 Serverless 的方式？对于不熟悉 Serverless 的同学，先介绍一下 Serverless 的概念。

[Serverless computing](https://en.wikipedia.org/wiki/Serverless_computing)
```
Serverless computing is a cloud computing execution model in which the cloud provider runs the server, and dynamically manages the allocation of machine resources. Pricing is based on the actual amount of resources consumed by an application, rather than on pre-purchased units of capacity.[1] It can be a form of utility computing. Serverless is a misnomer in the sense that servers are still used by cloud service providers to execute code for developers. The management and details of these servers are transparent to the application developers.
```

简单来讲，Serverless 就是，每个访问（HTTP请求、WebSocket 消息等等）变成了一个事件，只有这个事件真的发生的时候，AWS 服务器才会给你分配资源（同时让你付钱）。如果你的接口没人访问，那么就不需要支付任何费用。传统模式则是你占用一定的内存、硬盘和CPU一段时间，根据这个用量让你付费。

## 使用 Serverless 的动机

我不想对比 Serverless 和传统模式的优劣之处，因为我并没有之前使用过 Serverless 的经验。但是 Serverless 看上去很理想化，有点像“按需所取”的意思，给你的资源既不多也不少，刚好就是你执行网站功能需要的。当然，这是开发者让渡一部分权利达到的。你不再对服务器有掌控权，你不能按照[以往一样读写服务器上的文件](https://docs.aws.amazon.com/whitepapers/latest/serverless-architectures-lambda/writing-code-for-aws-lambdastatelessness-and-reuse.html)。当然，这也会有更严重的隐私问题。假如我们用自己编写的服务器，从一定意义上你的服务器在执行什么请求对服务商是不透明的。但是如果使用 Serverless 模式，服务商对你的所有事件都有结构化的访问方法。

## 部署 Django 的方法

那么，如何使用 AWS Lambda 来部署呢？我参考了这篇文章 [Deploy a REST API using Serverless, Django and Python](https://www.serverless.com/blog/django-serverless-framework-a-match-made-in-heaven)。这篇文章大概是一年之前的，而且文章引用的一个链接失效了，这暗示了前方将有无数的坑等待我去填。如果你打算看这篇的话，我建议你先速览我这篇，因为它并不全面。

我使用的是 macOS，至于 Windows 用户请自行转换。首先介绍一下我的项目的文件结构：

```
~/PycharmProjects/blog.chenyu.pw-example tree -L 3 --filelimit 12
.
├── Dockerfile
├── client
│   ├── README.md
│   ├── build
│   │   ├── asset-manifest.json
│   │   ├── index.html
│   │   ├── robots.txt
│   │   └── static
│   ├── config-overrides.js
│   ├── node_modules [1093 entries exceeds filelimit, not opening dir]
│   ├── package.json
│   ├── public
│   │   ├── index.html
│   │   └── robots.txt
│   ├── references.md
│   ├── src [18 entries exceeds filelimit, not opening dir]
│   ├── tsconfig.json
│   └── yarn.lock
├── package.json
├── server
│   ├── blog
│   │   ├── __init__.py
│   │   ├── __pycache__
│   │   ├── admin.py
│   │   ├── apps.py
│   │   ├── migrations
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── tests.py
│   │   ├── urls.py
│   │   └── views.py
│   ├── config
│   │   ├── __init__.py
│   │   ├── __pycache__
│   │   ├── asgi.py
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── wsgi.py
│   ├── manage.py
│   ├── requirements.txt
│   ├── staticfiles
│   │   ├── admin
│   │   ├── client
│   │   └── staticfiles.json
│   ├── task-dev-1608127419.zip
│   ├── ve
│   │   ├── bin
│   │   ├── include
│   │   ├── lib
│   │   ├── lib64
│   │   ├── man
│   │   └── pyvenv.cfg
│   └── zappa_settings.json
└── yarn.lock
```

项目分为两个分支，一个是 server 分支，下面是传统的 django 项目结构。一个是 client 分支，这个分支在本文中不重要。我们的任务是将 server 部分放置到 AWS Lambda 上，或者更明确一点，将客户端发到 server 的 HTTP 请求 **转换成能在 AWS Lambda 上执行的一个函数**。

Lambda Python 本身是一个 unopinionated 的执行环境，也就是它仅仅支持 Python 而不专门支持 Django。为了让 Django 能够得到部署，有大牛写了 [Zappa](https://github.com/Miserlou/zappa) 这个开源框架。Zappa 让本来基于独立服务器假设的 Django 也能部署到 Lambda 上面，而基本不需要改动原有的代码（当然，这要看你的 project 到底用了多少 Lambda 不支持的特性了，一般来说越小越规范的 project，改动会轻松些）。Zappa 的核心就在于这个[函数](https://github.com/Miserlou/Zappa/blob/master/zappa/handler.py#L608):

```
def lambda_handler(event, context):  # pragma: no cover
    return LambdaHandler.lambda_handler(event, context)
``` 

没错，这个就是整个函数的入口。其他部分的代码，你也可以去阅读一下，基本就是加载你的 django 设定然后把 django 的 handler 装到一个函数里面。

在我们部署之前，我们需要明确在 Serverless 上面我们哪些事情是跟普通服务器不一样的：

1. 文件是易失的

2. 内存是易失的

3. **一个 Serverless Instance 一次只能执行一个 event **

前两个我们平时在传统开发中其实也会意识到。例如我们会用独立的 Redis 来存储缓存以避免弹性扩容的服务器被消灭导致数据丢失。第三个是不一样的，因为传统开发中无论你用多线程模型还是 Event-based，你的 instance 都同时可以处理多个请求。而 Serverless Instance 是做不到的。（那么 Serverless 怎么处理并发呢？它靠的是复制多个 Instance，但是这和传统模型是有区别的）。

接下来，让我们打开一个 django project，来把它部署到 Lambda 上。

首先我们需要安装 Docker （略过）。（如果你未安装过 Docker，这篇文章可能不适合你。）

第二步，需要[注册 AWS 账户](https://romandc.com/zappa-django-guide/aws_credentials/#setup-local-account-credentials)。这个指导很清晰了，我们获取到 key_id 和 key 后需要放在 `~/.aws/credential` 这个文件中（我简化了这个文件，但不影响运行）：

```
[default]
aws_access_key_id = your_access_key_id
aws_secret_access_key = your_secret_access_key
region=your_aws_region
```

接下来我们需要安装 Zappa。这部分内容完全基于 [Guide to using Django with Zappa](https://romandc.com/zappa-django-guide/)。Zappa 完全存在在 Docker 内部，因而你的部署也完全发生在 Docker 中，因此你可以暂时不安装在你 django project 的虚拟环境中。我们省略这篇文章啰嗦的部分，直接看 Dockerfile:

```
FROM lambci/lambda:build-python3.6

LABEL maintainer="Winnie Chan"

WORKDIR /var/task

# Fancy prompt to remind you are in zappashell
RUN echo 'export PS1="\[\e[36m\]zappashell>\[\e[m\] "' >> /root/.bashrc
RUN echo 'source /var/task/ve/bin/activate' >> /root/.bashrc

RUN pip install pip -U
ADD server/requirements.txt /var/task
RUN pip install -r requirements.txt
ADD server /var/task

CMD ["bash"]
```

注意以上 Dockerfile 我们指定内部的根目录是 /var/task。注意第二个 RUN 中我们指定了一个不存在虚拟环境 activate 文件，我们之后要创建这个虚拟环境。

注：我没试过在 Dockerfile 中建立虚拟环境，不过我认为是可行的。

接下来我们构建环境。

```
docker build -t <your-image> .
```

然后在同一个目录下打开 container。

这里我们定义了三个 volumn：
`$(pwd)/server:/var/task` 这个是我们服务器的根目录。注意这和整个项目的根目录不一样，它是 Django 的目录。
`~/.aws/:/root/.aws` 这个是你的 AWS 设置，包含了我们刚刚指定的密钥和区域。如果你之前使用过 AWS 服务，很可能还有一个文件 `config`。

```
docker run -ti -e AWS_PROFILE=default -p 8002:8002 -v $(pwd)/server:/var/task -v ~/.aws/:/root/.aws -v $(pwd)/client/build:/var/www/static/client:ro --rm blogchenyupw
```

There you go. 接下来，其他的指令如无特殊说明，都是在这个 container 中执行的。

接着需要在 container 中设立虚拟环境，安装依赖：

```
python -m venv ve
source ve/bin/activate
python -m pip install -r requirements.txt
```

接下来，我们就可以准备部署了：

```
zappa deploy dev
```

如无意外，你将可以通过一个长串的url，打开伟大的 `DisallowedHost` 页面。然后你可以跳过 StackOverflow 把这个新的 url 的域名加到 `settings.ALLOWED_HOSTS` 中。


## 那么数据库怎么办？

根据我的经验，数据库没有特别好的 Serverless 方法。[Deploy a REST API using Serverless, Django and Python](https://www.serverless.com/blog/django-serverless-framework-a-match-made-in-heaven)。如果你打算用 `django-s3-sqlite`，按照这篇文章说的，根据我的尝试并不成功。（我不反对你去尝试，第一个问题我就卡了半天，它的 s3 bucket_name 并不是 ARN `arn:aws:s3:::<name>`，而是 `<name>`。而且它同步s3并不报错。）你不能用 s3 保证 sqlite 数据的一致性，如果你用这样的 sqlite 存储你的博文，怕是有一天要哭死。（事实上，我连基本的注册superuser都难以做到）。

最后我开了个 RDS，这部分设定和传统 server 一样，不再赘述。

## 个人域名

现在要访问你的网站，必须用 API Gateway 指定给你的 Base URL。这个 URL 格式一般是 `https://<id>.execute-api.us-east-1.amazonaws.com/<stage>`，而且 <stage> 不能去掉，发送给 Django 的 URL也会附带上。这导致了 Django 的 URL 需要改动，而且浏览器的 URL 变得难看了。

**先不要改 Django 和前端的 URL。**

要解决这个问题，我们只需要设置 API Gateway 的 Custom Domain Names。整个过程比较简单，不再赘述。设置后，你就可以去掉这个 <stage> 用你自己的域名访问了。

## 静态资源

由于是简单的个人网站，我不打算把部署过于复杂化，因此直接用 [whitenoise](http://whitenoise.evans.io/en/stable/) 来服务静态资源。但是如果你追求性能的话强烈不建议用 Serverless 的服务器来解决静态资源的问题。

## Lambda 的坑

我们之前提过，Lambda 和普通服务器有以下几点不一样：

1. 文件是易失的 (ephemeral)

2. 内存是易失的

3. **一个 Serverless Instance 一次只能执行一个 event **

那么第三点为什么需要注意呢，因为我踩了一个坑：

简单来讲，因为我是前后端分离的模式：
要访问 client 的静态资源，必须用 URL `/static/client/`。
然后，我希望 `/` 能够直接代理 `/static/client/`。也就是 `/` 成为 `/static/client/` 这个 URL 的别名，而不是 redirect 到  `/static/client/`。

由于没有内部解决的现成的方法，所以我用了代理的方法，也就是当客户访问 `/` 资源时，我直接用 `requests` 访问这个 URL + `/static/client/`。这个过程中，服务器自己访问自己。在本地这个解决方法实现成功了，然而当我部署上去后访问 `/` 却卡死了。

原因是什么呢？虽然 Serverless 会自动扩张你的 instance，但是它也会 [reuse](https://docs.aws.amazon.com/whitepapers/latest/serverless-architectures-lambda/writing-code-for-aws-lambdastatelessness-and-reuse.html) 你的 Instance （基于一定的逻辑）。如果你当前的 Instance A访问它所在的 endpoint，AWS把这个访问又分配给了 A，此时 A 的当前的 event handler 并没有结束，因此 A 不能接受这个访问，如此 A 因为等待自己当前的操作结束而造成了死锁。

因此最好的办法就是避免环形访问，你的 instance 不能在 handler 中进行用 HTTP 请求访问自己的操作（打破了我们之前并发的假设），从而避免死锁。如果你有多个业务需要用AWS  Lambda，把它们分散到不同的 Function 中。

## 结束

这篇文章讲了三个问题：

1. 如何部署 Django 到 Lambda
2. 为什么不要用 Sqlite
3. 如何配置域名

希望对你有帮助。
