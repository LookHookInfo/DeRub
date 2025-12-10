'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { client } from '../app/client';
import { useActiveAccount, useReadContract } from 'thirdweb/react';
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

const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

export default function BuyBurnDRUB({
  onTransactionSuccess,
}: {
  onTransactionSuccess: () => void;
}) {
  const [buyAmount, setBuyAmount] = useState('');
  const [burnAmount, setBurnAmount] = useState('');
  const [needsApproval, setNeedsApproval] = useState(false);
  const [usdcBalance, setUsdcBalance] = useState<bigint>(BigInt(0));
  const [drubBalance, setDrubBalance] = useState<bigint>(BigInt(0));
  const [showBurnModal, setShowBurnModal] = useState(false);
  const [isBuyInfoOpen, setIsBuyInfoOpen] = useState(false);
  const [isBurnInfoOpen, setIsBurnInfoOpen] = useState(false);
  const [drubToReceive, setDrubToReceive] = useState('0');
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

  const { data: usdcPrice } = useReadContract({
    contract,
    method: 'prices',
    params: [USDC_ADDRESS],
  });

  const { data: usdcMarkupBps } = useReadContract({
    contract,
    method: 'getUSDCMarkupBps',
  });

  useEffect(() => {
    if (
      !buyAmount ||
      parseFloat(buyAmount) <= 0 ||
      !usdcPrice ||
      !usdcMarkupBps
    ) {
      setDrubToReceive('0');
      return;
    }

    try {
      const usdcAmountBigInt = toUnits(buyAmount, 6);
      const baseAmount = (usdcAmountBigInt * usdcPrice) / BigInt(1e6);
      const protocolFee = (baseAmount * usdcMarkupBps) / BigInt(10000);
      const drubAmount = baseAmount - protocolFee;
      setDrubToReceive(formatAmount(toTokens(drubAmount, 18), 4));
    } catch (error) {
      console.error('Error calculating DRUB to receive:', error);
      setDrubToReceive('0');
    }
  }, [buyAmount, usdcPrice, usdcMarkupBps]);

  useEffect(() => {
    if (!account) return;
    const fetchBalances = async () => {
      try {
        const usdcBal = await readContract({
          contract: usdcContract,
          method: 'balanceOf',
          params: [account.address],
        });
        setUsdcBalance(usdcBal);
        const drubBal = await readContract({
          contract: getContract({
            client,
            address: CONTRACT_ADDRESS,
            chain: base,
            abi: ERC20_ABI,
          }),
          method: 'balanceOf',
          params: [account.address],
        });
        setDrubBalance(drubBal);
      } catch (e) {
        console.error('Error fetching balances', e);
      }
    };
    fetchBalances();
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
    } catch (e) {
      console.error('Error checking approval', e);
      setNeedsApproval(false);
    }
  }, [account, buyAmount, usdcContract]);

  useEffect(() => {
    checkApprovalStatus();
  }, [buyAmount, account?.address, checkApprovalStatus]);

  const setMaxBuyAmount = () => setBuyAmount(toTokens(usdcBalance, 6));
  const setMaxBurnAmount = () => setBurnAmount(toTokens(drubBalance, 18));

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

  const handleBurn = async () => {
    if (!account || !burnAmount) return;
    try {
      const amountValue = toUnits(burnAmount, 18);
      const tx = prepareContractCall({
        contract,
        method: 'burnDRUB',
        params: [amountValue],
      });
      await sendTransaction({ transaction: tx, account });
      onTransactionSuccess();
    } catch (e) {
      console.error('Burn failed', e);
    }
  };

  return (
    <>
      <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
        {/* Buy DRUB Section */}
        <div className="flex-1 bg-gray-800 p-4 rounded-lg shadow-md">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-aave-green">
              Buy DRUB with USDC
            </h3>
            <button
              className="text-aave-text-dark text-sm font-bold w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center hover:bg-gray-600"
              onClick={() => setIsBuyInfoOpen(true)}
            >
              ?
            </button>
          </div>
          <div className="flex items-center space-x-2">
            <div className="relative flex-grow">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2">
                <Image
                  src="/usdc.png"
                  alt="USDC logo"
                  width={32}
                  height={32}
                  className="rounded-full"
                />
              </div>
              <input
                type="number"
                value={buyAmount}
                onChange={(e) => setBuyAmount(e.target.value)}
                placeholder={`Balance: ${formatAmount(toTokens(usdcBalance, 6))}`}
                className="p-2 pl-11 pr-12 rounded-lg bg-gray-700 border border-gray-600 text-aave-text-light placeholder-gray-400 focus:outline-none focus:border-aave-light-blue w-full"
              />
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-gray-600 text-white px-2 py-1 rounded-md text-sm hover:bg-gray-500"
                onClick={setMaxBuyAmount}
              >
                MAX
              </button>
            </div>
            <button
              className={`flex-shrink-0 text-white px-4 py-2 rounded-lg hover:opacity-80 transition-opacity ${needsApproval ? 'bg-yellow-500' : 'bg-aave-green'}`}
              onClick={handleBuyOrApprove}
              disabled={!account || !buyAmount || parseFloat(buyAmount) <= 0}
            >
              {needsApproval ? 'Approve USDC' : 'Buy DRUB'}
            </button>
          </div>
          <div className="mt-2 text-sm text-gray-400">
            {drubToReceive !== '0' && (
              <p>You will receive approximately: {drubToReceive} DRUB</p>
            )}
          </div>
        </div>

        {/* Burn DRUB Section */}
        <div className="flex-1 bg-gray-800 p-4 rounded-lg shadow-md">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-aave-red">
              Burn DRUB
            </h3>
            <button
              className="text-aave-text-dark text-sm font-bold w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center hover:bg-gray-600"
              onClick={() => setIsBurnInfoOpen(true)}
            >
              ?
            </button>
          </div>
          <div className="flex items-center space-x-2">
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
                type="number"
                value={burnAmount}
                onChange={(e) => setBurnAmount(e.target.value)}
                placeholder={`Balance: ${formatAmount(
                  toTokens(drubBalance, 18)
                )}`}
                className="p-2 pl-11 pr-12 rounded-lg bg-gray-700 border border-gray-600 text-aave-text-light placeholder-gray-400 focus:outline-none focus:border-aave-light-blue w-full"
              />
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-gray-600 text-white px-2 py-1 rounded-md text-sm hover:bg-gray-500"
                onClick={setMaxBurnAmount}
              >
                MAX
              </button>
            </div>
            <button
              className="flex-shrink-0 bg-aave-red text-white px-4 py-2 rounded-lg hover:opacity-80 transition-opacity"
              onClick={() => setShowBurnModal(true)}
              disabled={!account || !burnAmount || parseFloat(burnAmount) <= 0}
            >
              Burn DRUB
            </button>
          </div>
        </div>
      </div>

      {showBurnModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg max-w-sm w-full relative">
            <h3 className="text-xl font-bold mb-4 text-aave-red">
              Burn Confirmation
            </h3>
            <p className="text-aave-text-light mb-6">
              Warning: This action is irreversible. The tokens will be
              permanently destroyed. Are you sure you want to burn {burnAmount}{" "}
              DRUB?
            </p>
            <div className="flex justify-end space-x-4">
              <button
                className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-500 transition-opacity"
                onClick={() => setShowBurnModal(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-aave-red hover:opacity-80 transition-opacity"
                onClick={() => {
                  handleBurn();
                  setShowBurnModal(false);
                }}
              >
                Confirm Burn
              </button>
            </div>
          </div>
        </div>
      )}

      {isBuyInfoOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg max-w-sm w-full relative">
            <h3 className="text-xl font-bold mb-4 text-aave-light-blue">
              Buying DRUB
            </h3>
            <p className="text-aave-text-light mb-4">
              Users can purchase DRUB tokens by paying with USDC stablecoin. The
              cost is calculated using a simple formula: the USDC amount is
              multiplied by the current exchange rate and increased by a 1%
              protocol commission. This markup is automatically included in the
              final price and is sent to the project&apos;s treasury to maintain and
              develop the ecosystem.
            </p>
            <button
              className="absolute top-2 right-2 text-aave-text-dark hover:text-white text-2xl"
              onClick={() => setIsBuyInfoOpen(false)}
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {isBurnInfoOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full relative">
            <h3 className="text-xl font-bold mb-4 text-aave-light-blue">
              DRUB Burning
            </h3>
            <div className="text-aave-text-light space-y-3">
              <p>
                The protocol features a voluntary DRUB token burning function that
                serves as an important token supply management tool. This
                functionality was specifically implemented for future integration
                with fiat gateways, providing:
              </p>
              <ul className="list-disc list-inside pl-2 space-y-2">
                <li>A monetary supply control mechanism</li>
                <li>
                  Ecosystem preparation for traditional financial infrastructure
                </li>
                <li>
                  Voluntary deflationary pressure through token removal from
                  circulation
                </li>
                <li>
                  Foundation for potential buyback-and-burn mechanisms
                </li>
              </ul>
              <p>
                This feature enables the protocol to maintain economic balance
                while expanding into traditional finance integrations, creating a
                bridge between decentralized finance and fiat systems.
              </p>
            </div>
            <button
              className="absolute top-2 right-2 text-aave-text-dark hover:text-white text-2xl"
              onClick={() => setIsBurnInfoOpen(false)}
            >
              &times;
            </button>
          </div>
        </div>
      )}
    </>
  );
}
