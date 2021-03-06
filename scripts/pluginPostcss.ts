import { Plugin } from 'esbuild'
import postcss, { AcceptedPlugin } from 'postcss'
import fs from 'fs/promises'

export const pluginPostcss = (plugins?: AcceptedPlugin[]): Plugin => {
  return {
    name: 'plugin-postcss',
    setup(build) {
      build.onLoad({ filter: /\.css$/ }, async ({ path }) => {
        const processor = postcss(plugins);
        const content = await fs.readFile(path);
        const result = await processor.process(content, { from: path });
        return {
          contents: result.toString(),
          loader: 'css',
        }
      });
    },
  }
};
