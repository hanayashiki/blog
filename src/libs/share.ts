import { Blog } from "@models/Blog";

import copy from 'copy-to-clipboard';

export const shareBlog = (blog: Blog) => {
  plausible('share');
  copy(`${blog.data.title} https://blog.chenyu.pw/blogs/${blog.data.slug}`);
  alert('链接已经复制!');
};
