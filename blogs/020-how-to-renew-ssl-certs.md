---
title: 简单记录一下如何更新 SSL 证书
slug: how-to-renew-ssl-certs
date: 2021-12-14
abstract: 笔记
---

## 流程

1. 本地生成 CSR -> CSR, Private Key

```bash
openssl req -new -newkey rsa:2048 -nodes -keyout server.key -out server_csr.txt
```

2. 把 `server_csr.txt` 的内容提交给 SSL 提供商，我用的是 Namecheap

```bash
cat server_csr.txt
-----BEGIN CERTIFICATE REQUEST-----
[redacted]
-----END CERTIFICATE REQUEST-----
```

3. 默认选择 DNS 验证，需要复制 CNAME 到域名管理后台，然后等待 SSL 提供商发证书的邮件。

4. 获取到证书，一个是 ca-bundle，一个是你的证书。把它部署到服务器上。