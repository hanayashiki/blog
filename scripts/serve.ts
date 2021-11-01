import polka from 'polka';

import sirv from 'sirv';
import { logPrefix } from './common';

polka().use(
  sirv('./dist')
).listen(5001, (error: any) => {
  if (error) throw error;
  console.log(`${logPrefix}dev started on port 5001`);
});
