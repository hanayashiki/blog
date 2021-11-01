import { generateStatic } from '../scripts/generateStatic';

generateStatic({
  blogRoot: 'blogs/',
  pageRoot: 'src/pages',
  css: 'src/index.css',
  outdir: 'dist',
});
