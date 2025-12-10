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
import { getWalletBalance } from 'thirdweb/wallets';
import {
  CONTRACT_ADDRESS,
  CONTRACT_ABI,
  ERC20_ABI,
} from '../../utils/contracts';
import { formatAmount } from '../../utils/format';
import DepositedAssetRow from './DepositedAssetRow';

const ASSETS = ['cbBTC', 'ETH', 'HASH'];
const tokenLogos: { [key: string]: string } = {
  cbBTC: '/cbbtc.webp',
  ETH: '/eth.png',
  HASH: '/hash.png',
};

function AssetRow({
  assetName,
  tokenAddress,
  onTransactionSuccess,
}: {
  assetName: string;
  tokenAddress: string;
  onTransactionSuccess: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [balance, setBalance] = useState<bigint>(BigInt(0));
  const [decimals, setDecimals] = useState(18);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const account = useActiveAccount();
  const contract = getContract({
    client,
    address: CONTRACT_ADDRESS,
    chain: base,
    abi: CONTRACT_ABI,
  });

  const fetchWalletBalance = useCallback(async () => {
    if (!account) return;
    try {
      let fetchedBalance: bigint,
        fetchedDecimals = 18;
      if (assetName === 'ETH') {
        const walletBalance = await getWalletBalance({
          client,
          address: account.address,
          chain: base,
        });
        fetchedBalance = walletBalance.value;
        fetchedDecimals = walletBalance.decimals;
      } else {
        const erc20Contract = getContract({
          client,
          address: tokenAddress,
          chain: base,
          abi: ERC20_ABI,
        });
        fetchedBalance = await readContract({
          contract: erc20Contract,
          method: 'balanceOf',
          params: [account.address],
        });
        fetchedDecimals = Number(
          await readContract({
            contract: erc20Contract,
            method: 'decimals',
            params: [],
          })
        );
      }
      setBalance(fetchedBalance);
      setDecimals(fetchedDecimals);
    } catch (e) {
      console.error(`Error fetching ${assetName} wallet balance`, e);
    }
  }, [account, assetName, tokenAddress]);

  useEffect(() => {
    fetchWalletBalance();
  }, [fetchWalletBalance, onTransactionSuccess]);

  const checkApproval = useCallback(async () => {
    if (
      !account ||
      assetName === 'ETH' ||
      !amount ||
      parseFloat(amount) <= 0
    ) {
      setNeedsApproval(false);
      return;
    }
    try {
      const amountToDeposit = toUnits(amount, decimals);
      const erc20Contract = getContract({
        client,
        address: tokenAddress,
        chain: base,
        abi: ERC20_ABI,
      });
      const currentAllowance = await readContract({
        contract: erc20Contract,
        method: 'allowance',
        params: [account.address, CONTRACT_ADDRESS],
      });
      setNeedsApproval(currentAllowance < amountToDeposit);
    } catch (e) {
      console.error('Approval check failed', e);
      setNeedsApproval(false);
    }
  }, [account, assetName, amount, tokenAddress, decimals]);

  useEffect(() => {
    checkApproval();
  }, [checkApproval]);

  const handleDeposit = async () => {
    if (!account || !amount || isApproving) return;

    const amountValue = toUnits(amount, decimals);
    try {
      if (needsApproval) {
        setIsApproving(true);
        const erc20Contract = getContract({
          client,
          address: tokenAddress,
          chain: base,
          abi: ERC20_ABI,
        });
        const tx = prepareContractCall({
          contract: erc20Contract,
          method: 'approve',
          params: [CONTRACT_ADDRESS, amountValue],
        });
        const transactionResult = await sendTransaction({ transaction: tx, account });

        await waitForReceipt(transactionResult);
      }

      const depositTx = prepareContractCall({
        contract,
        method: 'depositCollateral',
        params: [tokenAddress, amountValue],
        value: assetName === 'ETH' ? amountValue : BigInt(0),
      });
      await sendTransaction({ transaction: depositTx, account });
      setAmount('');
      onTransactionSuccess();
    } catch (e) {
      console.error('Collateral action failed', e);
    } finally {
      setIsApproving(false);
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
              toTokens(balance, decimals)
            )}`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="p-2 pl-11 pr-12 rounded-lg bg-gray-700 border border-gray-600 text-aave-text-light placeholder-gray-400 focus:outline-none focus:border-aave-light-blue w-full"
          />
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-gray-600 text-white px-2 py-1 rounded-md text-sm hover:bg-gray-500"
            onClick={() => setAmount(toTokens(balance, decimals))}
          >
            MAX
          </button>
        </div>
        <button
          className={`flex-shrink-0 text-white px-4 py-2 rounded-lg hover:opacity-80 transition-opacity ${
            needsApproval ? 'bg-yellow-500' : 'bg-aave-light-blue'
          }`}
          onClick={handleDeposit}
          disabled={!amount || parseFloat(amount) <= 0 || isApproving}
        >
          {isApproving ? 'Approving...' : needsApproval ? 'Approve' : 'Deposit'}
        </button>
      </div>
    </div>
  );
}

export default function CollateralManager({
  tokens,
  onTransactionSuccess,
}: {
  tokens: Record<string, string>;
  onTransactionSuccess: () => void;
}) {
  const [position, setPosition] = useState<{
    tokens: readonly string[];
    balances: readonly bigint[];
    debt: bigint;
    maxBorrow: bigint;
    totalValueDRUB: bigint;
  } | null>(null);
  const [prices, setPrices] = useState<Record<string, bigint>>({});
  const [collateralFactor, setCollateralFactor] = useState<bigint>(BigInt(0));
  const account = useActiveAccount();

  const fetchPosition = useCallback(async () => {
    if (!account) return;
    try {
      const contract = getContract({
        client,
        address: CONTRACT_ADDRESS,
        chain: base,
        abi: CONTRACT_ABI,
      });
      const pos = await readContract({
        contract,
        method: 'getUserPosition',
        params: [account.address],
      });
      const [tokens, balances, debt, maxBorrow, totalValueDRUB] = pos;
      setPosition({ tokens, balances, debt, maxBorrow, totalValueDRUB });

      const fetchedPrices: Record<string, bigint> = {};
      for (const token of tokens) {
        const price = await readContract({
          contract,
          method: 'prices',
          params: [token],
        });
        fetchedPrices[token] = price;
      }
      setPrices(fetchedPrices);

      const cf = await readContract({
        contract,
        method: 'COLLATERAL_FACTOR',
        params: [],
      });
      setCollateralFactor(cf);

    } catch (error) {
      console.error('Error fetching user position or prices', error);
    }
  }, [account]);

  useEffect(() => {
    fetchPosition();
  }, [fetchPosition, onTransactionSuccess]);

  return (
    <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
      {/* Deposit Section */}
      <div className="flex-1 bg-gray-800 p-4 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold text-aave-light-blue mb-2">
          Deposit Collateral
        </h3>
        {ASSETS.map((asset) => (
          <AssetRow
            key={`deposit-${asset}`}
            assetName={asset}
            tokenAddress={tokens[asset]}
            onTransactionSuccess={onTransactionSuccess}
          />
        ))}
      </div>

      {/* Withdraw Section */}
      <div className="flex-1 bg-gray-800 p-4 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold text-aave-red mb-2">
          Withdraw Collateral
        </h3>
        {ASSETS.map((asset) => {
          const tokenAddress = tokens[asset];
          const balance = position?.balances[position.tokens.indexOf(tokenAddress)] || BigInt(0);
          return (
            <DepositedAssetRow
              key={`withdraw-${asset}`}
              assetName={asset}
              tokenAddress={tokenAddress}
              balance={balance}
              position={position}
              prices={prices}
              collateralFactor={collateralFactor}
              onTransactionSuccess={onTransactionSuccess}
            />
          );
        })}
      </div>
    </div>
  );
}
