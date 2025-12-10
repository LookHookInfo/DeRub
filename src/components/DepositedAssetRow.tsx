'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { client } from '../app/client';
import { useActiveAccount } from 'thirdweb/react';
import {
  getContract,
  prepareContractCall,
  sendTransaction,
  readContract,
  waitForReceipt,
} from 'thirdweb';
import { base } from 'thirdweb/chains';
import { toUnits, toTokens } from 'thirdweb/utils';
import {
  CONTRACT_ADDRESS,
  CONTRACT_ABI,
  ERC20_ABI,
} from '../../utils/contracts';
import { formatAmount } from '../../utils/format';

type Position = {
  tokens: readonly string[];
  balances: readonly bigint[];
  debt: bigint;
  maxBorrow: bigint;
  totalValueDRUB: bigint;
};

const tokenLogos: { [key: string]: string } = {
  cbBTC: '/cbbtc.webp',
  ETH: '/eth.png',
  HASH: '/hash.png',
};

export default function DepositedAssetRow({
  assetName,
  tokenAddress,
  balance, // Total deposited balance for this token
  position, // Full user position
  prices, // All asset prices
  collateralFactor, // COLLATERAL_FACTOR
  onTransactionSuccess,
}: {
  assetName: string;
  tokenAddress: string;
  balance: bigint;
  position: Position | null;
  prices: Record<string, bigint>;
  collateralFactor: bigint;
  onTransactionSuccess: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [decimals, setDecimals] = useState(18);
  const [withdrawableAmount, setWithdrawableAmount] = useState(BigInt(0));
  const account = useActiveAccount();
  const contract = getContract({
    client,
    address: CONTRACT_ADDRESS,
    chain: base,
    abi: CONTRACT_ABI,
  });

  useEffect(() => {
    const fetchDecimals = async () => {
      if (assetName !== 'ETH') {
        const erc20Contract = getContract({
          client,
          address: tokenAddress,
          chain: base,
          abi: ERC20_ABI,
        });
        const d = await readContract({
          contract: erc20Contract,
          method: 'decimals',
          params: [],
        });
        setDecimals(Number(d));
      }
    };
    fetchDecimals();
  }, [assetName, tokenAddress]);

  useEffect(() => {
    if (!position || !prices || !collateralFactor || !balance) {
      setWithdrawableAmount(BigInt(0));
      return;
    }

    const { debt, totalValueDRUB } = position;
    const tokenPrice = prices[tokenAddress];

    if (debt === BigInt(0)) {
      // If no debt, can withdraw all deposited balance
      setWithdrawableAmount(balance);
      return;
    }

    if (collateralFactor === BigInt(0)) {
      // Avoid division by zero
      setWithdrawableAmount(BigInt(0));
      return;
    }

    // Calculate minRequiredCollateralValueDRUB
    const minRequiredCollateralValueDRUB = (debt * 100n) / collateralFactor;

    // Calculate excess collateral value in DRUB
    let excessValueDRUB = totalValueDRUB - minRequiredCollateralValueDRUB;

    if (excessValueDRUB < 0n) {
      excessValueDRUB = 0n; // Cannot withdraw anything if already undercollateralized or at limit
    }

    let calculatedWithdrawableAmount = BigInt(0);
    if (tokenPrice > 0n) {
      calculatedWithdrawableAmount =
        (excessValueDRUB * 10n ** BigInt(decimals)) / tokenPrice;
    }

    // The withdrawable amount cannot exceed the actual deposited balance of this token
    setWithdrawableAmount(
      calculatedWithdrawableAmount > balance
        ? balance
        : calculatedWithdrawableAmount
    );
  }, [position, prices, collateralFactor, balance, tokenAddress, decimals]);

  const withdraw = async () => {
    if (!account || !amount) return;
    try {
      const amountValue = toUnits(amount, decimals);
      const tx = prepareContractCall({
        contract,
        method: 'withdrawCollateral',
        params: [tokenAddress, amountValue],
      });
      await sendTransaction({ transaction: tx, account });
      onTransactionSuccess();
    } catch (error) {
      console.error('Error withdrawing collateral:', error);
    }
  };

  return (
    <div className="space-y-2 pt-2 first:pt-0 border-t first:border-t-0 border-gray-700">
      <div className="flex items-center space-x-2">
        <div className="relative flex-grow">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2">
            <Image
              src={tokenLogos[assetName]}
              alt={assetName}
              width={32}
              height={32}
              className="rounded-full"
            />
          </div>
          <input
            type="text"
            placeholder={`: ${formatAmount(
              toTokens(withdrawableAmount, decimals)
            )}`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="p-2 pl-11 pr-12 rounded-lg bg-gray-700 border border-gray-600 text-aave-text-light placeholder-gray-400 focus:outline-none focus:border-aave-light-blue w-full"
          />
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-gray-600 text-white px-2 py-1 rounded-md text-sm hover:bg-gray-500"
            onClick={() => setAmount(toTokens(withdrawableAmount, decimals))}
          >
            MAX
          </button>
        </div>
        <button
          className={`flex-shrink-0 text-white px-4 py-2 rounded-lg hover:opacity-80 transition-opacity bg-aave-red`}
          onClick={withdraw}
          disabled={!amount || parseFloat(amount) <= 0}
        >
          Withdraw
        </button>
      </div>
    </div>
  );
}
