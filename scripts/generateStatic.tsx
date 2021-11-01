import { build, BuildOptions, BuildResult } from 'esbuild';
import path from 'path';
import fs from 'fs/promises';
import { h, Fragment, FunctionComponent } from 'preact';
import render from 'preact-render-to-string';
import tailwindcss from 'tailwindcss';
import { createTemplate } from './createTemplate';
import copyfiles from 'copyfiles';
// @ts-ignore
import pluginPostcss from '@deanc/esbuild-plugin-postcss';
import polka from 'polka';

import sirv from 'sirv';
import { BlogManager } from './BlogManager';
import { ensureDir } from 'fs-extra';
import { logPrefix } from './common';

export interface GenerateStaticOptions {
  pageRoot: string;
  blogRoot: string;
  css: string;
  outdir: string;
  dev?: boolean;
  esbuildOptions?: BuildOptions;
}

export const generateStatic = async (options: GenerateStaticOptions) => {
  const {
    pageRoot,
    blogRoot,
    css,
    outdir,
    esbuildOptions = {},
    dev,
  } = options;

  const homePages = [
    path.join(pageRoot, 'index.tsx'),
  ];

  const blogPages = [
    path.join(pageRoot, 'blogs', 'index.tsx'),
  ];

  const blogManager = new BlogManager(blogRoot);

  let loadBlogsPromise: Promise<void> | undefined;;
  let copyPublicPromise: Promise<void> | undefined;

  let t1: number | undefined;

  if (dev) {
    polka().use(
      sirv(outdir, {
        dev: true,
      })
    ).listen(3001, (error: any) => {
      if (error) throw error;
      console.log(`${logPrefix}dev started on port 3001`);
    });
  }

  const onStart = async () => {
    t1 = new Date().getTime();
    try {
      await fs.access(outdir);
      await fs.rm(outdir, {
        recursive: true,
      });
    } catch { }
    await ensureDir(path.dirname(outdir));

    copyPublicPromise = new Promise(
      (r) => copyfiles(
        ['public/**', outdir],
        { up: true },
        () => r(),
      ),
    );
    loadBlogsPromise = blogManager.loadBlogs();
  };

  const onEnd = async (result: BuildResult) => {
    const meta = result.metafile!;

    if (result.errors.length > 0) {
      console.info(`${logPrefix}failed to build`);
      return;
    }
    const compiledCss = Object.entries(meta.outputs)
      .find(([, meta]) => meta.entryPoint?.endsWith('/index.css'))
      ?.[0];

    if (compiledCss === undefined) {
      throw new Error(`Failed to find the compiled css.`);
    }

    for (const homePage of homePages) {
      const compiledScript = Object.entries(meta.outputs)
        .find(([, meta]) => meta.entryPoint === homePage)
        ?.[0];

      if (compiledScript === undefined) {
        throw new Error(`Failed to find the compiled script for page ${homePage}. `);
      }

      const target = path.join(
        outdir,
        path.relative(
          pageRoot,
          homePage.replace(/\.tsx$/, '.html'),
        )
      );

      const renderModule = path.resolve(compiledScript);
      const compiledScriptImportUrl = path.relative(path.dirname(target), compiledScript);
      const compiledCssImportUrl = path.relative(path.dirname(target), compiledCss);

      await Promise.all([
        loadBlogsPromise,
        copyPublicPromise,
      ]);

      const html = await createPageHtml(
        renderModule,
        compiledScriptImportUrl,
        compiledCssImportUrl,
        'Chenyu\'s Blog',
        {
          entries: blogManager.blogs.map((b) => ({
            data: b.data,
          }))
        },
      );

      await ensureDir(path.dirname(target));
      const handle = await fs.open(target, 'w');

      try {
        await fs.writeFile(handle, html);
      } finally {
        await handle.close();
      }
    }

    for (const blogPage of blogPages) {
      const compiledScript = Object.entries(meta.outputs)
        .find(([, meta]) => meta.entryPoint === blogPage)
        ?.[0];
      if (compiledScript === undefined) {
        throw new Error(`Failed to find the compiled script for page ${blogPage}. `);
      }

      let i = 0;

      for (const blog of blogManager.blogs) {
        const target = path.join(
          outdir,
          path.relative(
            pageRoot,
            blogPage.replace(/index\.tsx$/, `${blog.data.slug}.html`),
          ),
        );

        const compiledScriptImportUrl = path.relative(path.dirname(target), compiledScript);
        const compiledCssImportUrl = path.relative(path.dirname(target), compiledCss);
        const renderModule = path.resolve(compiledScript);

        const html = await createPageHtml(
          renderModule,
          compiledScriptImportUrl,
          compiledCssImportUrl,
          blog.data.title + ' - Chenyu\'s Blog',
          {
            entry: {
              ...blog,
              content: '',
              html: blogManager.renderBlogToHtml(blog),
            },
            prev: blogManager.blogs[i + 1] && {
              ...blogManager.blogs[i + 1],
              content: '',
            },
            next: blogManager.blogs[i - 1] && {
              ...blogManager.blogs[i - 1],
              content: '',
            },
          },
        );

        await ensureDir(path.dirname(target));
        const handle = await fs.open(target, 'w');

        try {
          await fs.writeFile(handle, html);
        } finally {
          await handle.close();
        }

        i++;
      }
    }

    console.info(`${logPrefix}pages successfully built within ${new Date().getTime() - t1!}ms`);
  };

  await build({
    entryPoints: [
      ...homePages,
      ...blogPages,
      css,
    ],
    entryNames: '[name]-[hash]',
    outdir,
    jsxFactory: 'h',
    jsxFragment: 'Fragment',
    metafile: true,
    bundle: true,
    format: 'esm',
    outExtension: {
      '.js': '.mjs',
    },
    external: [
      '*.png',
      '*.jpg',
      '*.ttf',
      '*.webp',
    ],
    plugins: [
      pluginPostcss({
        plugins: [
          // @ts-ignore
          tailwindcss((await import('../tailwind.config.cjs')).default),
        ],
      }),
      {
        name: 'blog',
        setup(build) {
          build.onStart(onStart);
          build.onEnd(onEnd);
        }
      },
    ],
    watch: dev === true,
    minify: true,
    ...esbuildOptions,
  });
}

export interface PageModule {
  default: FunctionComponent;
}

export const createPageHtml = async (
  renderModule: string,
  compiledScript: string,
  compiledCss: string,
  title: string,
  props: any,
) => {
  const SourceModule: PageModule = await eval(`import(${JSON.stringify(renderModule)})`);
  const prerendered = render((
    <>
      {<SourceModule.default {...props} />}
    </>
  ));

  const html = createTemplate(
    compiledScript,
    compiledCss,
    title,
    prerendered,
  );

  return html;
};
