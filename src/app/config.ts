import { createThirdwebClient } from 'thirdweb';
import { base } from 'thirdweb/chains';

export const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || '',
});

export const chain = base;
