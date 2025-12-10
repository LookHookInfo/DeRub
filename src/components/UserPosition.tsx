'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { client } from '../app/client';
import { useActiveAccount } from 'thirdweb/react';
import { getContract, readContract } from 'thirdweb';
import { base } from 'thirdweb/chains';
import {
  CONTRACT_ADDRESS,
  CONTRACT_ABI,
  ERC20_ABI,
} from '../../utils/contracts';
import { toTokens } from 'thirdweb/utils';
import { formatAmount } from '../../utils/format';

type Position = {
  tokens: readonly string[];
  balances: readonly bigint[];
  debt: bigint;
  maxBorrow: bigint;
  totalValueDRUB: bigint;
  healthFactor: number; // Added healthFactor
};

export default function UserPosition({
  tokensMap,
  position,
}: {
  tokensMap: Record<string, string>;
  position: Position | null;
}) {
  const [isLiquidationInfoOpen, setIsLiquidationInfoOpen] = useState(false);

  if (!position) return <div className="text-aave-text-dark">No data</div>;

  // Calculate borrow usage percentage for progress bar
  const rawBorrowPercentage =
    position.maxBorrow > 0
      ? (Number(position.debt) / Number(position.maxBorrow)) * 100
      : 0;
  const currentBorrowPercentage = Math.min(rawBorrowPercentage, 100);

  let progressBarColor = 'bg-aave-green';
  if (currentBorrowPercentage > 80) {
    progressBarColor = 'bg-aave-red';
  } else if (currentBorrowPercentage > 64) {
    progressBarColor = 'bg-yellow-500';
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-aave-light-blue">
          User Position
        </h3>
        <button
          className="text-aave-text-dark text-sm font-bold w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center hover:bg-gray-600"
          onClick={() => setIsLiquidationInfoOpen(true)}
        >
          ?
        </button>
      </div>
      <div className="space-y-2 text-lg">
        <div className="flex justify-between">
          <span className="font-medium">Debt:</span>
          <span className="flex items-center space-x-2">
            <Image src="/RUB.png" alt="DRUB" width={20} height={20} />
            <span>{formatAmount(toTokens(position.debt, 18))}</span>
          </span>
        </div>
        <div className="flex justify-between">
          <span className="font-medium">Max Borrow:</span>
          <span>
            {formatAmount(toTokens(position.maxBorrow, 18))} DRUB
          </span>
        </div>

        <div className="flex justify-between">
          <span className="font-medium">Health Factor:</span>
          <span
            className={
              position.healthFactor > 1.2
                ? 'text-aave-green'
                : position.healthFactor > 1.0
                  ? 'text-yellow-500'
                  : 'text-aave-red'
            }
          >
            {formatAmount(position.healthFactor, 2)}
          </span>
        </div>
      </div>
      {position.healthFactor <= 1.2 && (
        <div
          className={`mt-4 p-3 rounded-lg text-center font-semibold ${
            position.healthFactor > 1.0
              ? 'bg-yellow-800 text-yellow-200'
              : 'bg-aave-red text-white'
          }`}
        >
          {position.healthFactor > 1.0
            ? 'Warning: Your position is close to liquidation!'
            : 'DANGER: Your position is subject to liquidation!'}
        </div>
      )}

      {/* Progress Bar */}
      <div className="mt-4">
        <div className="text-sm font-medium mb-1">Borrow Usage:</div>
        <div className="w-full bg-gray-700 rounded-full h-2.5">
          <div
            className={`${progressBarColor} h-2.5 rounded-full`}
            style={{ width: `${currentBorrowPercentage}%` }}
          ></div>
        </div>
        <div className="relative text-xs mt-1 h-4">
          <span className="text-aave-green absolute" style={{ left: '0%' }}>0%</span>
          <span className="text-aave-green absolute" style={{ left: '10%', transform: 'translateX(-50%)' }}>10%</span>
          <span className="text-aave-green absolute" style={{ left: '25%', transform: 'translateX(-50%)' }}>25%</span>
          <span className="text-yellow-500 absolute" style={{ left: '50%', transform: 'translateX(-50%)' }}>50%</span>
          <span className="text-aave-red absolute" style={{ left: '80%', transform: 'translateX(-50%)' }}>80%</span>
          <span className="text-aave-red absolute" style={{ left: '100%', transform: 'translateX(-100%)' }}>100%</span>
        </div>
      </div>

      {isLiquidationInfoOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg max-w-sm w-full relative">
            <h3 className="text-xl font-bold mb-4 text-aave-light-blue">
              Liquidation Mechanism
            </h3>
            <div className="text-aave-text-light space-y-3">
              <p>
                Liquidation is triggered when your debt exceeds 80% of your
                collateral value. When this happens:
              </p>
              <ul className="list-disc list-inside pl-2 space-y-2">
                <li>Your entire debt is automatically repaid</li>
                <li>All of your collateral is seized to the treasury</li>
                <li>You are removed from the debtors list</li>
              </ul>
              <p className="font-bold text-aave-red">
                This is an immediate and complete liquidation of your entire
                position. There is no collateral return.
              </p>
            </div>
            <button
              className="absolute top-2 right-2 text-aave-text-dark hover:text-white text-2xl"
              onClick={() => setIsLiquidationInfoOpen(false)}
            >
              &times;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
