'use client';

import TokenBalance from '@/components/TokenBalance';
import PriceUpdater from '@/components/PriceUpdater';
import BorrowRepay from '@/components/BorrowRepay';
import UserPosition from '@/components/UserPosition';
import CollateralManager from '@/components/CollateralManager';
import BuyBurnDRUB from '@/components/BuyBurnDRUB';
import LiquidationManager from '@/components/LiquidationManager';
import TreasuryBalance from '@/components/TreasuryBalance';
import { ConnectButton, useActiveAccount } from 'thirdweb/react';
import Image from 'next/image';
import { useState, useCallback, useEffect } from 'react';
import { client } from '../app/client';
import { chain } from '../app/chain';
import { getContract, readContract } from 'thirdweb';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../../utils/contracts';

type Position = {
  tokens: readonly string[];
  balances: readonly bigint[];
  debt: bigint;
  maxBorrow: bigint;
  totalValueDRUB: bigint;
  healthFactor: number;
};

export default function Home() {
  const account = useActiveAccount();
  const TOKENS = {
    cbBTC: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
    ETH: '0x0000000000000000000000000000000000000000',
    HASH: '0xA9B631ABcc4fd0bc766d7C0C8fCbf866e2bB0445',
    USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    RUB: CONTRACT_ADDRESS,
  };

  const [refreshKey, setRefreshKey] = useState(0);
  const [position, setPosition] = useState<Position | null>(null);

  const triggerRefresh = useCallback(() => {
    setRefreshKey((prevKey: number) => prevKey + 1);
  }, []);

  useEffect(() => {
    if (!account) {
      setPosition(null);
      return;
    }

    const fetchPosition = async () => {
      try {
        const contract = getContract({
          client,
          address: CONTRACT_ADDRESS,
          chain: chain,
          abi: CONTRACT_ABI,
        });

        const pos = await readContract({
          contract,
          method: 'getUserPosition',
          params: [account.address],
        });
        const [tokens, balances, debt, maxBorrow, totalValueDRUB] = pos;

        let healthFactor = 0;
        if (debt > 0) {
          healthFactor = Number(maxBorrow) / Number(debt);
        } else {
          healthFactor = Infinity;
        }

        console.log("position", {          tokens,          balances,          debt,          maxBorrow,          totalValueDRUB,          healthFactor,        });
        setPosition({
          tokens,
          balances,
          debt,
          maxBorrow,
          totalValueDRUB,
          healthFactor,
        });
      } catch (error) {
        console.error('Error fetching user position', error);
        setPosition(null);
      }
    };

    fetchPosition();
  }, [account, refreshKey]);

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
              MVP
            </span>
          </h1>
          <ConnectButton client={client} chain={chain} />
        </div>

        {account && (
          <div className="space-y-8">
            <div className="bg-gray-800 p-6 rounded-lg shadow-md">
              <div>
                {' '}
                {/* No grid needed if only one item */}
                <PriceUpdater
                  tokens={TOKENS}
                  onTransactionSuccess={triggerRefresh}
                />
              </div>
            </div>

            <div className="bg-gray-800 p-6 rounded-lg shadow-md">
              <CollateralManager
                tokens={TOKENS}
                onTransactionSuccess={triggerRefresh}
              />
            </div>

            <div className="bg-gray-800 p-6 rounded-lg shadow-md">
              <BorrowRepay onTransactionSuccess={triggerRefresh} position={position} />
            </div>

            <div className="bg-gray-800 p-6 rounded-lg shadow-md">
              <UserPosition tokensMap={TOKENS} position={position} />
            </div>

            <div className="bg-gray-800 p-6 rounded-lg shadow-md">
              <BuyBurnDRUB onTransactionSuccess={triggerRefresh} />
            </div>

            <div className="bg-gray-800 p-6 rounded-lg shadow-md">
              <LiquidationManager
                position={position}
                onTransactionSuccess={triggerRefresh}
              />
            </div>

            <div className="bg-gray-800 p-6 rounded-lg shadow-md">
              <TreasuryBalance tokens={TOKENS} />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
