import { build, BuildOptions, BuildResult } from 'esbuild';
import path from 'path';
import fs from 'fs/promises';
import { h, Fragment, FunctionComponent } from 'preact';
import render from 'preact-render-to-string';
import tailwindcss from 'tailwindcss';
import { createTemplate } from './createTemplate';
import { inspect } from 'util';
import chalk from 'chalk';
import copyfiles from 'copyfiles';
// @ts-ignore
import pluginPostcss from '@deanc/esbuild-plugin-postcss';
import polka from 'polka';

import sirv from 'sirv';
import { BlogManager } from './BlogManager';

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

  const logPrefix = `${chalk.cyan('blog')} - `;

  const blogManager = new BlogManager(blogRoot);

  let loadBlogsPromise = await blogManager.loadBlogs();

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
    try {
      t1 = new Date().getTime();
      await fs.access(outdir);
      await fs.rm(outdir, {
        recursive: true,
      });
      await blogManager.loadBlogs();
    } catch { }
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

      await loadBlogsPromise;

      const html = await createPageHtml(
        renderModule,
        compiledScriptImportUrl,
        compiledCssImportUrl,
        {
          entries: blogManager.blogs.map((b) => ({
            data: b.data,
          }))
        },
      );
      const handle = await fs.open(target, 'w');
      try {
        await fs.writeFile(handle, html);
        await new Promise((r) => copyfiles(['public/**', outdir], { up: true }, r));
        console.info(`${logPrefix}pages successfully built within ${new Date().getTime() - t1!}ms`);
      } finally {
        await handle.close();
      }
    }
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
    'Chenyu\'s Blog',
    prerendered,
  );

  return html;
};
