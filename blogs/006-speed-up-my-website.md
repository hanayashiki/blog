---
title: 加速本网站的访问速度
slug: speed-up-my-website
date: 2021-01-01
abstract: 本网站现在用 github.io 作为静态资源的服务器，从而大大提高了访问速度。
---

**注意：此文已经过时，现在采用的是 SSG 模式。**

本人稍微花了点时间对网站的架构进行了改良：

原来的架构：

1. 用 AWS Lambda 执行 Django Server

2. 用 AWS RDS 运行 Postgres 数据库

3. 静态文件用 [whitenoise](http://whitenoise.evans.io/en/stable/) 来提供

由于 AWS Lambda 薅免费的服务器，提供的算力实在有限，而且静态资源体积比较大，所以网站访问起来非常缓慢。

现在进行了改动：

1. RDS, Lambda 的作用不变，但是改用域名 `blog-api` 来访问
2. 使用 hanayashiki.github.io 来 host 静态资源。

虽然 github.io 并不包办 CDN 功能，但是它提供自定义域名和该域名的免费 SSL 证书，由于专门 host 静态资源所以性能也还不错，接下来把 URL 改动一下就好了。稍微有点坑的地方是 django admin 部分目前还是用 Lambda host 静态资源，而且必须用 AWS API Gateway 的自定域名才能正确解析静态文件的地址，如果 django 能有办法自定义 static file 的域名，我肯定把 admin 也 host 在 github 上，这样又给 Lambda 减负提高效率了。
