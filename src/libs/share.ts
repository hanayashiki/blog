import { Blog } from "@models/Blog";

import copy from 'copy-to-clipboard';

export const shareBlog = (blog: Blog) => {
  const currentDomain = window.location.origin;
  plausible('share');
  copy(`${blog.data.title} ${currentDomain}/blogs/${blog.data.slug}`);
  alert('链接已经复制!');
};
