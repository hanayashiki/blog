import polka from 'polka';

import sirv from 'sirv';
import compression from 'compression';
import { logPrefix } from './common';

// Get port from environment variable or use default
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
// Get host from environment variable or use default
const host = process.env.HOST || 'localhost';

polka().use(
  compression(),
  sirv('./dist'),
).listen(port, host, (error: any) => {
  if (error) throw error;
  console.log(`${logPrefix}serve started on http://${host}:${port}`);
});
