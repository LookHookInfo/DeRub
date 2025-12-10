'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { client } from '../app/client';
import { useActiveAccount } from 'thirdweb/react';
import {
  getContract,
  prepareContractCall,
  sendTransaction,
  readContract,
} from 'thirdweb';
import { base } from 'thirdweb/chains';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../../utils/contracts';
import { toUnits, toTokens } from 'thirdweb/utils';
import { formatAmount } from '../../utils/format';

type Position = {
  tokens: readonly string[];
  balances: readonly bigint[];
  debt: bigint;
  maxBorrow: bigint;
  totalValueDRUB: bigint;
};

export default function BorrowRepay({
  onTransactionSuccess,
  position,
}: {
  onTransactionSuccess: () => void;
  position: Position | null;
}) {
  const account = useActiveAccount();

  // Borrow states
  const [borrowAmount, setBorrowAmount] = useState('');
  const [borrowPercentage, setBorrowPercentage] = useState(0);

  // Repay states
  const [repayAmount, setRepayAmount] = useState('');
  const [repayPercentage, setRepayPercentage] = useState(0);

  // Modal state
  const [showLiquidationModal, setShowLiquidationModal] = useState(false);

  // Calculate borrowAmount from borrowPercentage
  useEffect(() => {
    if (!position) return;
    const availableToBorrow = position.maxBorrow - position.debt;
    const calculatedAmount =
      (Number(availableToBorrow) * borrowPercentage) / 100;
    setBorrowAmount(
      formatAmount(toTokens(BigInt(Math.floor(calculatedAmount)), 18))
    );
  }, [borrowPercentage, position]);

  // Calculate repayAmount from repayPercentage
  useEffect(() => {
    if (!position) return;
    const totalDebt = position.debt;
    const calculatedAmount = (Number(totalDebt) * repayPercentage) / 100;
    setRepayAmount(
      formatAmount(toTokens(BigInt(Math.floor(calculatedAmount)), 18))
    );
  }, [repayPercentage, position]);

  const borrow = async () => {
    if (!account || !borrowAmount || parseFloat(borrowAmount) <= 0) return;
    try {
      const contract = getContract({
        client,
        address: CONTRACT_ADDRESS,
        chain: base,
        abi: CONTRACT_ABI,
      });

      const amountToSend = toUnits(borrowAmount, 18);

      const transaction = prepareContractCall({
        contract,
        method: 'borrowDrub',
        params: [amountToSend],
      });

      await sendTransaction({ transaction, account });
      console.log('Borrow complete');
      onTransactionSuccess();
    } catch (error) {
      console.error('Error borrowing', error);
    }
  };

  const repay = async () => {
    if (!account || !repayAmount || parseFloat(repayAmount) <= 0) return;
    try {
      const contract = getContract({
        client,
        address: CONTRACT_ADDRESS,
        chain: base,
        abi: CONTRACT_ABI,
      });

      const amountToSend = toUnits(repayAmount, 18);

      const transaction = prepareContractCall({
        contract,
        method: 'repayDebt',
        params: [amountToSend],
      });

      await sendTransaction({ transaction, account });
      console.log('Repay complete');
      onTransactionSuccess();
    } catch (error) {
      console.error('Error repaying', error);
    }
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
        {/* Borrow Section */}
        <div className="flex-1 bg-gray-800 p-4 rounded-lg shadow-md">
          <h4 className="text-lg font-semibold mb-3 text-aave-green flex items-center justify-between">
            Borrow DRUB
            <button
              className="text-aave-text-dark text-sm font-bold w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center hover:bg-gray-600"
              onClick={() => setShowLiquidationModal(true)}
            >
              ?
            </button>
          </h4>
          <div className="flex items-center space-x-2 mb-2">
            <div className="relative flex-grow">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2">
                <Image
                  src="/RUB.png"
                  alt="DRUB logo"
                  width={32}
                  height={32}
                  className="rounded-full"
                />
              </div>
              <input
                type="text"
                placeholder="Amount"
                value={borrowAmount}
                onChange={(e) => setBorrowAmount(e.target.value)}
                className="p-2 pl-11 pr-12 rounded-lg bg-gray-700 border border-gray-600 text-aave-text-light placeholder-gray-400 focus:outline-none focus:border-aave-light-blue w-full"
              />
              {position && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-aave-text-dark">
                  Available:{' '}
                  {formatAmount(
                    toTokens((position?.maxBorrow || 0n) - (position?.debt || 0n), 18)
                  )}{' '}
                  DRUB
                </span>
              )}
            </div>
            <button
              className="flex-shrink-0 bg-aave-green text-white px-4 py-2 rounded-lg hover:opacity-80 transition-opacity disabled:bg-gray-500 disabled:cursor-not-allowed"
              onClick={borrow}
              disabled={
                !account || !borrowAmount || parseFloat(borrowAmount) <= 0
              }
            >
              Borrow
            </button>
          </div>
          <input
            type="range"
            min="0"
            max="80"
            value={borrowPercentage}
            onChange={(e) => setBorrowPercentage(Number(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-aave-green"
          />
          <div
            className={`text-center text-sm mt-2 ${borrowPercentage > 64 ? 'text-aave-red' : 'text-aave-text-dark'}`}
          >
            {borrowPercentage}%
          </div>
        </div>

        {/* Repay Section */}
        <div className="flex-1 bg-gray-800 p-4 rounded-lg shadow-md">
          <h4 className="text-lg font-semibold mb-3 text-aave-red">
            Repay DRUB
          </h4>
          <div className="flex items-center space-x-2 mb-2">
            <div className="relative flex-grow">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2">
                <Image
                  src="/RUB.png"
                  alt="DRUB logo"
                  width={32}
                  height={32}
                  className="rounded-full"
                />
              </div>
              <input
                type="text"
                placeholder="Amount"
                value={repayAmount}
                onChange={(e) => setRepayAmount(e.target.value)}
                className="p-2 pl-11 pr-28 rounded-lg bg-gray-700 border border-gray-600 text-aave-text-light placeholder-gray-400 focus:outline-none focus:border-aave-light-blue w-full"
              />
              {position && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-aave-text-dark">
                  Your Debt: {formatAmount(toTokens(position?.debt || 0n, 18))} DRUB
                </span>
              )}
            </div>
            <button
              className="flex-shrink-0 bg-aave-red text-white px-4 py-2 rounded-lg hover:opacity-80 transition-opacity disabled:bg-gray-500 disabled:cursor-not-allowed"
              onClick={repay}
              disabled={
                !account || !repayAmount || parseFloat(repayAmount) <= 0
              }
            >
              Repay
            </button>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={repayPercentage}
            onChange={(e) => setRepayPercentage(Number(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-aave-red"
          />
          <div className="text-center text-sm text-aave-text-dark mt-2">
            {repayPercentage}%
          </div>
        </div>
      </div>

      {/* Liquidation Modal */}
      {showLiquidationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg max-w-sm w-full relative">
            <h3 className="text-xl font-bold mb-4 text-aave-light-blue">
              Automatic Liquidation:
            </h3>
            <p className="text-aave-text-light mb-4">
              Attention: This protocol uses full liquidation. If your debt
              exceeds 100% of the collateral value (for example, due to a market
              downturn), an automatic liquidation will occur. This will close
              your debt by seizing ALL of your collateral into the treasury.
              Partial liquidation does not exist; you risk losing your entire
              collateral position.
            </p>
            <button
              className="absolute top-2 right-2 text-aave-text-dark hover:text-white text-2xl"
              onClick={() => setShowLiquidationModal(false)}
            >
              &times;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}



