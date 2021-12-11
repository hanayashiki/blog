import polka from 'polka';

import sirv from 'sirv';
import compression from 'compression';
import { logPrefix } from './common';

const port = 5001

polka().use(
  compression(),
  sirv('./dist'),
).listen(port, (error: any) => {
  if (error) throw error;
  console.log(`${logPrefix}serve started on http://localhost:${port}`);
});
