import polka from 'polka';

import sirv from 'sirv';
import compression from 'compression';
import { logPrefix } from './common';

const port = 12000

polka().use(
  compression(),
  sirv('./dist'),
).listen(port, "0.0.0.0", (error: any) => {
  if (error) throw error;
  console.log(`${logPrefix}serve started on http://0.0.0.0:${port}`);
});
