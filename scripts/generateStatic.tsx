import { build, BuildOptions, BuildResult } from "esbuild";
import path from "path";
import fs from "fs/promises";
import { h, FunctionComponent } from "preact";
import { minify as _minifyHtml } from "html-minifier-terser";
import render from "preact-render-to-string";
import pluginWindi from "postcss-windicss";
import { SitemapStream, streamToPromise } from "sitemap";

import { createTemplate } from "./createTemplate";
import copyfiles from "copyfiles";
import { pluginPostcss } from "./pluginPostcss";
import polka from "polka";

import sirv from "sirv";
import { BlogManager } from "./BlogManager";
import { ensureDir } from "fs-extra";
import { logPrefix } from "./common";
import { writeFile } from "fs";

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
    dev = false,
  } = options;

  const sitemapStream = new SitemapStream({
    hostname: "https://blog.chenyu.pw",
  });

  const staticPages = [
    path.join(process.cwd(), pageRoot, "me.tsx"),
    path.join(process.cwd(), pageRoot, "privacy.tsx"),
  ];

  const homePages = [path.join(process.cwd(), pageRoot, "index.tsx")];

  const blogPages = [path.join(process.cwd(), pageRoot, "blogs", "index.tsx")];

  const clientEntry = (
    await fs.readFile(require.resolve("./client/entry.tsx"))
  ).toString();

  const blogManager = new BlogManager(blogRoot);

  let loadBlogsPromise: Promise<void> | undefined;
  let copyPublicPromise: Promise<void> | undefined;

  let t1: number | undefined;

  if (dev) {
    polka()
      .use(
        sirv(outdir, {
          dev: true,
        })
      )
      .listen(3001, (error: any) => {
        if (error) throw error;
        console.log(`${logPrefix}dev started on port 3001`);
      });
  }

  const minifyHtml = async (html: string) => {
    return _minifyHtml(html, {
      collapseBooleanAttributes: true,
      collapseWhitespace: true,
      minifyCSS: true,
      minifyJS: true,
      minifyURLs: true,
      removeAttributeQuotes: true,
      removeComments: true,
      removeEmptyAttributes: true,
      html5: true,
      keepClosingSlash: true,
      removeRedundantAttributes: true,
      removeScriptTypeAttributes: true,
      removeStyleLinkTypeAttributes: true,
      useShortDoctype: true,
    });
  };

  const onStart = async () => {
    t1 = new Date().getTime();
    try {
      await fs.access(outdir);
      await fs.rm(outdir, {
        recursive: true,
      });
    } catch {}
    await ensureDir(path.dirname(outdir));

    copyPublicPromise = new Promise((r) =>
      copyfiles(["public/**", outdir], { up: true }, () => r())
    );
    loadBlogsPromise = blogManager.loadBlogs();
  };

  const onEnd = async (result: BuildResult) => {
    const meta = result.metafile!;

    if (result.errors.length > 0) {
      console.info(`${logPrefix}failed to build`);
      return;
    }
    const compiledCss = Object.entries(meta.outputs).find(([, meta]) =>
      meta.entryPoint?.endsWith("/index.css")
    )?.[0];

    if (compiledCss === undefined) {
      throw new Error(`Failed to find the compiled css.`);
    }

    const buildPage = async (
      entryPoint: string,
      title: string,
      target: string,
      props: any,
      clientProps: any = props
    ) => {
      const compiledScript = Object.entries(meta.outputs).find(
        ([, meta]) => path.resolve(meta.entryPoint ?? "") === entryPoint
      )?.[0];
      if (compiledScript === undefined) {
        throw new Error(
          `Failed to find the compiled script for page ${entryPoint}. `
        );
      }

      const compiledScriptImportUrl = path.relative(
        path.dirname(target),
        compiledScript
      );
      const compiledCssImportUrl = path.relative(
        path.dirname(target),
        compiledCss
      );

      let html = await createPageHtml(
        entryPoint,
        compiledScriptImportUrl,
        compiledCssImportUrl,
        title,
        props,
        clientProps
      );

      if (!dev) {
        html = await minifyHtml(html);
      }

      await ensureDir(path.dirname(target));
      const handle = await fs.open(target, "w");

      try {
        await fs.writeFile(handle, html);
      } finally {
        await handle.close();
      }
    };

    for (const staticPage of staticPages) {
      const target = path.join(
        outdir,
        path.relative(pageRoot, staticPage.replace(/\.tsx$/, ".html"))
      );

      await buildPage(staticPage, "Chenyu's Blog", target, null);

      sitemapStream.write({
        url: target.replace('dist/', ''),
        changefreq: "monthly",
        priority: 0.6,
      });
    }

    for (const homePage of homePages) {
      const target = path.join(
        outdir,
        path.relative(pageRoot, homePage.replace(/\.tsx$/, ".html"))
      );

      await Promise.all([loadBlogsPromise, copyPublicPromise]);

      await buildPage(homePage, "Chenyu's Blog", target, {
        entries: blogManager.blogs.map((b) => ({
          data: b.data,
        })),
      });

      sitemapStream.write({ url: target.replace('dist/', ''), changefreq: "daily", priority: 1 });
    }

    for (const blogPage of blogPages) {
      let i = 0;

      for (const blog of blogManager.blogs) {
        const target = path.join(
          outdir,
          path.relative(
            pageRoot,
            blogPage.replace(/index\.tsx$/, `${blog.data.slug}.html`)
          )
        );

        const props = {
          entry: {
            ...blog,
            content: "",
            html: blogManager.renderBlogToHtml(blog),
          },
          prev: blogManager.blogs[i + 1] && {
            ...blogManager.blogs[i + 1],
            content: "",
          },
          next: blogManager.blogs[i - 1] && {
            ...blogManager.blogs[i - 1],
            content: "",
          },
        };

        const clientProps = {
          ...props,
          entry: {
            ...props.entry,
            html: "",
          },
        };

        await buildPage(
          blogPage,
          `${blog.data.title} - Chenyu\'s Blog`,
          target,
          props,
          clientProps
        );

        sitemapStream.write({
          url: target.replace('dist/', ''),
          changefreq: "monthly",
          priority: 0.9,
        });

        i++;
      }
    }

    sitemapStream.end();
    const buffer = await streamToPromise(sitemapStream);

    await fs.writeFile(path.join(outdir, "sitemap.xml"), buffer);
    console.info(
      `${logPrefix}pages successfully built within ${
        new Date().getTime() - t1!
      }ms`
    );
  };

  await build({
    entryPoints: [...staticPages, ...homePages, ...blogPages, css],
    entryNames: "[name]-[hash]",
    outdir,
    jsxFactory: "h",
    jsxFragment: "Fragment",
    metafile: true,
    bundle: true,
    format: "esm",
    outExtension: {
      ".js": ".mjs",
    },
    loader: {
      ".ttf": "file",
      ".webp": "file",
    },
    plugins: [
      pluginPostcss([
        // @ts-ignore
        pluginWindi((await import("../windi.config")).default),
      ]),
      {
        name: "blog",
        setup(build) {
          build.onStart(onStart);
          build.onEnd(onEnd);
          build.onLoad({ filter: /pages\/.*\.tsx/ }, async ({ path }) => {
            const input = (await fs.readFile(path)).toString();
            const exportDefaultName =
              /^\s+export\s+default\s+function\s+(\w+)/m.exec(input)?.[1];
            if (exportDefaultName === undefined) {
              throw new Error(
                `Didn't find a default export for page: ${path}. Did you use 'export default function PageName() {}' to define the page component?`
              );
            }

            let transformedInput =
              input +
              "\n" +
              clientEntry.replace(/__PAGE__/g, exportDefaultName);

            return {
              contents: transformedInput,
              loader: "tsx",
            };
          });
        },
      },
    ],
    watch: dev === true,
    minify: dev === false,
    ...esbuildOptions,
  });
};

export interface PageModule {
  default: FunctionComponent;
}

export const createPageHtml = async (
  renderModule: string,
  compiledScript: string,
  compiledCss: string,
  title: string,
  props: any,
  clientProps = props
) => {
  for (const key of Object.keys(require.cache)) {
    if (key.startsWith(path.join(process.cwd(), "src"))) {
      delete require.cache[key]; // To allow hot reloading
    }
  }

  const SourceModule: PageModule = require(renderModule);
  const prerendered = render(<SourceModule.default {...props} />);

  const html = createTemplate(
    compiledScript,
    compiledCss,
    title,
    prerendered,
    clientProps
  );

  return html;
};
