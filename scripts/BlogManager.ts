import fs from 'fs/promises';
import * as matter from 'gray-matter';
import path from 'path';

export interface Blog {
  data: {
    title: string;
    slug: string;
    date: Date;
    abstract: string;
  },
  content: string;
}

export class BlogManager {
  blogs: Blog[] = [];
  constructor(public blogRoot: string) {}

  async loadBlogs() {
    const dir = await fs.opendir(this.blogRoot);
    const blogs: Blog[] = [];

    for await (const entry of dir) {
      if (entry.isFile()) {
        const filePath = path.join(dir.path, entry.name);
        const parsed = matter.read(filePath);
        blogs.push({
          data: parsed.data as any,
          content: parsed.content,
        });
      }
    }
    this.blogs = blogs;
  }


}