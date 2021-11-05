import { Plugin } from 'esbuild'
import postcss, { AcceptedPlugin } from 'postcss'
import fs from 'fs/promises'

export const pluginPostcss = (plugins?: AcceptedPlugin[]): Plugin => {
  const processor = postcss(plugins);

  return {
    name: 'plugin-postcss',
    setup(build) {
      build.onLoad({ filter: /\.css$/ }, async ({ path }) => {
        const content = await fs.readFile(path);
        const result = await processor.process(content);
        return {
          contents: result.toString(),
          loader: 'css',
        }
      });
    },
  }
};
