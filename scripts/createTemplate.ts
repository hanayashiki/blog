export const createTemplate = (
  mainJsUrl: string,
  cssUrl: string,
  title: string,
  prerendered: string,
  clientProps: any,
) => `
<!DOCTYPE html>
<html lang="zh-CN">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>

  <link rel="stylesheet" href="${cssUrl}">

  <meta name="msapplication-TileColor" content="#000000">
  <meta name="theme-color" content="#000000">
  <meta name="description" content="专注于 JavaScript 的技术博客。A tech-blog mainly focused on JavaScript. ">
  <script async defer data-domain="blog.chenyu.pw" src="https://plausible.monoid.co.jp/js/plausible.js"></script>
</head>

<body>
  <div id="root">
    ${prerendered}
  </div>

  <script>window.__PROPS__ = JSON.parse(${JSON.stringify(JSON.stringify(clientProps))});</script>
  <script type="module" src=${JSON.stringify(mainJsUrl)}></script>
</body>

</html>
`;
