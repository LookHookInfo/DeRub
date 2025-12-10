'use client';

import { useState, useEffect, useCallback } from 'react';
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

const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

export default function BuyCollateral({
  tokens,
  onTransactionSuccess,
}: {
  tokens: Record<string, string>;
  onTransactionSuccess: () => void;
}) {
  // State from BuyBurnDRUB
  const [buyAmount, setBuyAmount] = useState('');
  const [needsApproval, setNeedsApproval] = useState(false);
  const [usdcBalance, setUsdcBalance] = useState<bigint>(BigInt(0));

  // State from CollateralManager
  const [collateralToken, setCollateralToken] = useState('cbBTC');
  const [collateralAmount, setCollateralAmount] = useState('');
  const [collateralNeedsApproval, setCollateralNeedsApproval] = useState(false);

  const account = useActiveAccount();

  const contract = getContract({
    client,
    address: CONTRACT_ADDRESS,
    chain: base,
    abi: CONTRACT_ABI,
  });
  const usdcContract = getContract({
    client,
    address: USDC_ADDRESS,
    chain: base,
    abi: ERC20_ABI,
  });

  // --- Logic from BuyBurnDRUB ---
  useEffect(() => {
    if (!account) return;
    const fetchUsdcBalance = async () => {
      try {
        const balance = await readContract({
          contract: usdcContract,
          method: 'balanceOf',
          params: [account.address],
        });
        setUsdcBalance(balance);
      } catch (e) {
        console.error('Error fetching USDC balance', e);
      }
    };
    fetchUsdcBalance();
  }, [account, onTransactionSuccess, usdcContract]);

  const checkApprovalStatus = useCallback(async () => {
    if (!account || !buyAmount || parseFloat(buyAmount) <= 0) {
      setNeedsApproval(false);
      return;
    }
    try {
      const amountToBuy = toUnits(buyAmount, 6);
      const currentAllowance = await readContract({
        contract: usdcContract,
        method: 'allowance',
        params: [account.address, CONTRACT_ADDRESS],
      });
      setNeedsApproval(currentAllowance < amountToBuy);
    } catch (error) {
      console.error('Error checking approval status:', error);
      setNeedsApproval(false);
    }
  }, [account, buyAmount, usdcContract]);

  useEffect(() => {
    checkApprovalStatus();
  }, [buyAmount, account?.address, checkApprovalStatus]);

  const setMaxBuyAmount = () => setBuyAmount(toTokens(usdcBalance, 6));

  const handleBuyOrApprove = async () => {
    if (!account || !buyAmount) return;
    try {
      const amountValue = toUnits(buyAmount, 6);

      if (needsApproval) {
        const tx = prepareContractCall({
          contract: usdcContract,
          method: 'approve',
          params: [CONTRACT_ADDRESS, amountValue],
        });
        const transactionResult = await sendTransaction({ transaction: tx, account });

        await waitForReceipt(transactionResult);

        const buyTx = prepareContractCall({
          contract,
          method: 'buyDRUB',
          params: [amountValue],
        });
        await sendTransaction({ transaction: buyTx, account });
        setBuyAmount('');
        onTransactionSuccess();
      } else {
        const tx = prepareContractCall({
          contract,
          method: 'buyDRUB',
          params: [amountValue],
        });
        await sendTransaction({ transaction: tx, account });
        setBuyAmount('');
        onTransactionSuccess();
      }
    } catch (e) {
      console.error('Buy/Approve failed', e);
    }
  };

  // --- Logic from CollateralManager ---
  const checkCollateralApprovalStatus = useCallback(async () => {
    if (
      !account ||
      collateralToken === 'ETH' ||
      !collateralAmount ||
      parseFloat(collateralAmount) === 0
    ) {
      setCollateralNeedsApproval(false);
      return;
    }
    try {
      const amountToDeposit = toUnits(collateralAmount, 18);
      const erc20Contract = getContract({
        client,
        address: tokens[collateralToken],
        chain: base,
        abi: ERC20_ABI,
      });
      const currentAllowance = await readContract({
        contract: erc20Contract,
        method: 'allowance',
        params: [account.address, CONTRACT_ADDRESS],
      });
      setCollateralNeedsApproval(currentAllowance < amountToDeposit);
    } catch (error) {
      console.error('Error checking collateral approval:', error);
      setCollateralNeedsApproval(false);
    }
  }, [account, collateralToken, collateralAmount, tokens]);

  useEffect(() => {
    checkCollateralApprovalStatus();
  }, [
    collateralToken,
    collateralAmount,
    account?.address,
    checkCollateralApprovalStatus,
  ]);

  const handleDepositOrApprove = async () => {
    if (!account || !collateralAmount) return;
    try {
      const amountValue = toUnits(collateralAmount, 18);

      if (collateralNeedsApproval) {
        const erc20Contract = getContract({
          client,
          address: tokens[collateralToken],
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

        const depositTx = prepareContractCall({
          contract,
          method: 'depositCollateral',
          params: [tokens[collateralToken], amountValue],
          value: collateralToken === 'ETH' ? amountValue : BigInt(0),
        });
        await sendTransaction({ transaction: depositTx, account });
        setCollateralAmount('');
        onTransactionSuccess();
      } else {
        const tx = prepareContractCall({
          contract,
          method: 'depositCollateral',
          params: [tokens[collateralToken], amountValue],
          value: collateralToken === 'ETH' ? amountValue : BigInt(0),
        });
        await sendTransaction({ transaction: tx, account });
        setCollateralAmount('');
        onTransactionSuccess();
      }
    } catch (error) {
      console.error('Collateral deposit failed:', error);
    }
  };

  const withdraw = async () => {
    if (!account) return;
    try {
      const tx = prepareContractCall({
        contract,
        method: 'withdrawCollateral',
        params: [tokens[collateralToken], toUnits(collateralAmount, 18)],
      });
      await sendTransaction({ transaction: tx, account });
      onTransactionSuccess();
    } catch (error) {
      console.error('Error withdrawing collateral:', error);
    }
  };

  const setMaxCollateralAmount = async () => {
    if (!account) return;
    try {
      let balance: bigint,
        decimals = 18;
      if (collateralToken === 'ETH') {
        const walletBalance = await getWalletBalance({
          client,
          address: account.address,
          chain: base,
        });
        balance = walletBalance.value;
        decimals = walletBalance.decimals;
      } else {
        const erc20Contract = getContract({
          client,
          address: tokens[collateralToken],
          chain: base,
          abi: ERC20_ABI,
        });
        balance = await readContract({
          contract: erc20Contract,
          method: 'balanceOf',
          params: [account.address],
        });
        decimals = Number(
          await readContract({
            contract: erc20Contract,
            method: 'decimals',
            params: [],
          })
        );
      }
      setCollateralAmount(formatAmount(toTokens(balance, decimals)));
    } catch (error) {
      console.error('Error setting max amount:', error);
    }
  };

  return (
    <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
      {/* Buy DRUB Section */}
      <div className="flex-1 bg-gray-800 p-4 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold text-aave-green flex justify-between">
          <span>Buy DRUB with USDC</span>
          <span className="text-sm text-aave-text-dark font-normal">
            Balance: {formatAmount(toTokens(usdcBalance, 6))}
          </span>
        </h3>
        <div className="relative mt-2">
          <input
            type="number"
            value={buyAmount}
            onChange={(e) => setBuyAmount(e.target.value)}
            placeholder="USDC Amount"
            className="p-2 pr-12 rounded-lg bg-gray-700 border border-gray-600 text-aave-text-light placeholder-gray-400 focus:outline-none focus:border-aave-light-blue w-full"
          />
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-gray-600 text-white px-2 py-1 rounded-md text-sm hover:bg-gray-500"
            onClick={setMaxBuyAmount}
          >
            MAX
          </button>
        </div>
        <button
          className={`w-full mt-2 text-white px-4 py-2 rounded-lg hover:opacity-80 transition-opacity ${needsApproval ? 'bg-velvet-yellow' : 'bg-aave-green'}`}
          onClick={handleBuyOrApprove}
          disabled={!account || !buyAmount || parseFloat(buyAmount) <= 0}
        >
          {needsApproval ? 'Approve USDC' : 'Buy DRUB'}
        </button>
      </div>

      {/* Collateral Section */}
      <div className="flex-1 bg-gray-800 p-4 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold text-aave-light-blue mb-2">
          Collateral
        </h3>
        <select
          value={collateralToken}
          onChange={(e) => setCollateralToken(e.target.value)}
          className="p-2 mb-2 rounded-lg bg-gray-700 border border-gray-600 text-aave-text-light focus:outline-none focus:border-aave-light-blue w-full"
        >
          {Object.keys(tokens)
            .filter((t) => t !== 'USDC' && t !== 'RUB')
            .map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
        </select>
        <div className="relative">
          <input
            type="text"
            placeholder="Amount"
            value={collateralAmount}
            onChange={(e) => setCollateralAmount(e.target.value)}
            className="p-2 pr-12 rounded-lg bg-gray-700 border border-gray-600 text-aave-text-light placeholder-gray-400 focus:outline-none focus:border-aave-light-blue w-full"
          />
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-gray-600 text-white px-2 py-1 rounded-md text-sm hover:bg-gray-500"
            onClick={setMaxCollateralAmount}
          >
            MAX
          </button>
        </div>
        <div className="flex space-x-2 mt-2">
          <button
            className={`flex-1 text-white px-4 py-2 rounded-lg hover:opacity-80 transition-opacity ${collateralNeedsApproval ? 'bg-velvet-yellow' : 'bg-aave-light-blue'}`}
            onClick={handleDepositOrApprove}
          >
            {collateralNeedsApproval ? 'Approve' : 'Deposit'}
          </button>
          <button
            className="flex-1 bg-aave-red text-white px-4 py-2 rounded-lg hover:opacity-80 transition-opacity"
            onClick={withdraw}
          >
            Withdraw
          </button>
        </div>
      </div>
    </div>
  );
}
