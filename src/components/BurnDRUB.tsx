'use client';

import { useState, useEffect } from 'react';
import { client } from '../app/client';
import { useActiveAccount } from 'thirdweb/react';
import {
  getContract,
  prepareContractCall,
  sendTransaction,
  readContract,
} from 'thirdweb';
import { base } from 'thirdweb/chains';
import { toUnits, toTokens } from 'thirdweb/utils';
import {
  CONTRACT_ADDRESS,
  CONTRACT_ABI,
  ERC20_ABI,
} from '../../utils/contracts';
import { formatAmount } from '../../utils/format';

export default function BurnDRUB({
  onTransactionSuccess,
}: {
  onTransactionSuccess: () => void;
}) {
  const [burnAmount, setBurnAmount] = useState('');
  const [drubBalance, setDrubBalance] = useState<bigint>(BigInt(0));
  const [showBurnModal, setShowBurnModal] = useState(false);
  const account = useActiveAccount();

  const contract = getContract({
    client,
    address: CONTRACT_ADDRESS,
    chain: base,
    abi: CONTRACT_ABI,
  });

  useEffect(() => {
    if (!account) return;
    const fetchDrubBalance = async () => {
      try {
        const balance = await readContract({
          contract: getContract({
            client,
            address: CONTRACT_ADDRESS,
            chain: base,
            abi: ERC20_ABI,
          }),
          method: 'balanceOf',
          params: [account.address],
        });
        setDrubBalance(balance);
      } catch (error) {
        console.error('Error fetching DRUB balance', error);
      }
    };
    fetchDrubBalance();
  }, [account, onTransactionSuccess]);

  const setMaxBurnAmount = () => {
    setBurnAmount(toTokens(drubBalance, 18));
  };

  const handleBurn = async () => {
    if (!account) return;
    try {
      const amountValue = toUnits(burnAmount, 18);
      const transaction = prepareContractCall({
        contract,
        method: 'burnDRUB',
        params: [amountValue],
      });
      await sendTransaction({ transaction, account });
      onTransactionSuccess();
    } catch (error) {
      console.error('Burn failed:', error);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-2 bg-gray-800 p-4 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold text-aave-red flex justify-between">
          <span>Burn DRUB</span>
          <span className="text-sm text-aave-text-dark font-normal">
            Balance: {formatAmount(toTokens(drubBalance, 18))}
          </span>
        </h3>
        <div className="relative">
          <input
            type="number"
            value={burnAmount}
            onChange={(e) => setBurnAmount(e.target.value)}
            placeholder="DRUB Amount"
            className="p-2 pr-12 rounded-lg bg-gray-700 border border-gray-600 text-aave-text-light placeholder-gray-400 focus:outline-none focus:border-aave-light-blue w-full"
          />
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-gray-600 text-white px-2 py-1 rounded-md text-sm hover:bg-gray-500"
            onClick={setMaxBurnAmount}
          >
            MAX
          </button>
        </div>
        <button
          className="w-full bg-aave-red text-white px-4 py-2 rounded-lg hover:opacity-80 transition-opacity"
          onClick={() => setShowBurnModal(true)}
          disabled={!account || !burnAmount || parseFloat(burnAmount) <= 0}
        >
          Burn DRUB
        </button>
      </div>

      {showBurnModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg max-w-sm w-full relative">
            <h3 className="text-xl font-bold mb-4 text-aave-red">
              Burn Confirmation
            </h3>
            <p className="text-aave-text-light mb-6">
              Warning: This action is irreversible. The tokens will be
              permanently destroyed. Are you sure you want to burn {burnAmount}{' '}
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
    </>
  );
}
