'use client';

import { ConnectButton } from 'thirdweb/react';
import Image from 'next/image';
import { client } from '../app/client';
import { chain } from '../app/chain';
import DeRubManager from '@/components/DeRubManager';

export default function Home() {
  return (
    <main className="min-h-screen p-8 text-aave-text-light">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between mb-8">
          <h1 className="text-4xl font-bold text-white mb-4 md:mb-0">
            DRUB{' '}
            <Image
              src="/RUB.png"
              alt="RUB Logo"
              width={80}
              height={80}
              className="inline-block align-middle"
            />{' '}
            Dashboard
            <span className="bg-indigo-500 text-white text-sm font-bold px-3 py-1 rounded-lg ml-4 align-middle">
              v2
            </span>
          </h1>
          <ConnectButton client={client} chain={chain} />
        </div>

        <DeRubManager />
      </div>
    </main>
  );
}
