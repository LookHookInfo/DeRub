'use client';

import { useState } from 'react';
import {
  useActiveAccount,
  useSendAndConfirmTransaction,
} from 'thirdweb/react';
import { prepareContractCall } from 'thirdweb';
import { parseUnits } from 'ethers';
import { approve, allowance } from 'thirdweb/extensions/erc20';
import { useDeRubData } from '../hooks/useDeRubData';
import {
  DE_RUB_CONTRACT_ADDRESS,
  VAULT_CONTRACT_ADDRESS,
  VAULT_CONTRACT_ABI,
} from '../app/contracts';
import { client, chain } from '../app/config';
import { getContract } from 'thirdweb';

const DeRubManager = () => {
  const account = useActiveAccount();
  const { mutate: sendAndConfirmTx, isPending: isTxPending } = useSendAndConfirmTransaction();

  const [amount, setAmount] = useState('');

  const {
    collateral,
    debt,
    maxDebt,
    drubPerHash,
    hasDebtors,
    drubBalance,
    hashBalance,
    refetchAllUserData,
    refetchSystemData,
    deRubContract,
    drubTokenContract,
    hashTokenContract,
  } = useDeRubData();

  // We still need a vault contract instance here for the `addLiquidity` action
  const vaultContract = getContract({ client, address: VAULT_CONTRACT_ADDRESS, chain, abi: VAULT_CONTRACT_ABI });

  // --- Transaction Handlers ---
  const handleBatchLiquidate = async () => {
    try {
      const transaction = prepareContractCall({ contract: deRubContract, method: 'liquidateBatch', params: [10n] });
      await sendAndConfirmTx(transaction);
      refetchSystemData(); // Affects system state
      refetchAllUserData(); // Affects multiple users
    } catch (error) {
      console.error('Error during batch liquidation:', error);
      alert('Error during batch liquidation. See console for details.');
    }
  };

  const handleAddLiquidity = async () => {
    try {
      const transaction = prepareContractCall({ contract: vaultContract, method: 'addLiquidity', params: [] });
      await sendAndConfirmTx(transaction);
      refetchSystemData(); // Affects vault balances
    } catch (error) {
      console.error('Error adding liquidity:', error);
      alert('Error adding liquidity. See console for details.');
    }
  };

  const handleAction = async (action: 'deposit' | 'withdraw' | 'borrow' | 'repay' | 'buy') => {
    if (!account || !amount) return;
    const parsedAmount = parseUnits(amount, 18);
  
    try {
      let mainTransaction;

      if (action === 'deposit' || action === 'buy') {
        const currentAllowance = await allowance({ contract: hashTokenContract, owner: account.address, spender: DE_RUB_CONTRACT_ADDRESS });
        if (currentAllowance < parsedAmount) {
          const approveTx = approve({ contract: hashTokenContract, spender: DE_RUB_CONTRACT_ADDRESS, amount: amount });
          await sendAndConfirmTx(approveTx);
        }
        mainTransaction = prepareContractCall({
            contract: deRubContract,
            method: action === 'deposit' ? 'depositCollateral' : 'buyDRUB',
            params: [parsedAmount],
        });
      } 
      else if (action === 'repay') {
        const currentAllowance = await allowance({ contract: drubTokenContract, owner: account.address, spender: DE_RUB_CONTRACT_ADDRESS });
        if (currentAllowance < parsedAmount) {
            const approveTx = approve({ contract: drubTokenContract, spender: DE_RUB_CONTRACT_ADDRESS, amount: amount });
            await sendAndConfirmTx(approveTx);
        }
        mainTransaction = prepareContractCall({ contract: deRubContract, method: 'repay', params: [parsedAmount] });
      }
      else if (action === 'withdraw' || action === 'borrow') {
        mainTransaction = prepareContractCall({
            contract: deRubContract,
            method: action === 'withdraw' ? 'withdrawCollateral' : 'borrowDRUB',
            params: [parsedAmount],
        });
      }

      if (mainTransaction) {
        await sendAndConfirmTx(mainTransaction);
      }
      
      setAmount('');
      // Selective refetching
      if (action === 'deposit' || action === 'withdraw' || action === 'borrow' || action === 'repay') {
        refetchAllUserData(); // These actions affect the user's main data points
      }
      if (action === 'buy' || action === 'repay') {
        refetchSystemData(); // These actions can affect vault balances or system-wide data
      }

    } catch (error) {
      console.error(`Error during ${action}:`, error);
      alert(`Error during ${action}. See console for details.`);
    }
  };

  // --- UI Computed Values ---
  const healthFactor = parseFloat(maxDebt) > 0 ? (parseFloat(debt) / parseFloat(maxDebt)) * 100 : 0;
  const isAddLiquidityDisabled = isTxPending || parseFloat(drubBalance) <= 0 || parseFloat(hashBalance) <= 0;

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-md w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-white">DeRub Manager</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 text-white">
        <div>Collateral (HASH): {parseFloat(collateral).toFixed(4)}</div>
        <div>Debt (DRUB): {parseFloat(debt).toFixed(4)}</div>
        <div>Max Debt (DRUB): {parseFloat(maxDebt).toFixed(4)}</div>
      </div>

      <div className="w-full bg-gray-700 rounded-full h-2.5 mb-4">
        <div 
          className="bg-red-600 h-2.5 rounded-full" 
          style={{ width: `${Math.min(healthFactor, 100)}%` }}
        ></div>
      </div>
      <div className="text-white text-sm text-center mb-4">Liquidation at &gt;100% ({healthFactor.toFixed(2)}%)</div>

      <div className="flex items-center space-x-4 mb-4">
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Enter amount"
          className="w-full px-4 py-2 bg-gray-700 text-white border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <button onClick={() => handleAction('deposit')} disabled={isTxPending} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-600">Deposit HASH</button>
        <button onClick={() => handleAction('withdraw')} disabled={isTxPending} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-600">Withdraw HASH</button>
        <button onClick={() => handleAction('borrow')} disabled={isTxPending} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-600">Borrow DRUB</button>
        <button onClick={() => handleAction('repay')} disabled={isTxPending} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-600">Repay DRUB</button>
        <button onClick={() => handleAction('buy')} disabled={isTxPending} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-600">Buy DRUB with HASH</button>
      </div>

      <div className="mt-4 text-white">
        1 HASH ≈ {parseFloat(drubPerHash).toFixed(4)} DRUB
      </div>

      <div className="mt-8 border-t border-gray-700 pt-6">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white">Treasury Vault</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4 text-white text-sm">
            <div>DRUB: {drubBalance}</div>
            <div>HASH: {hashBalance}</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={handleAddLiquidity}
              disabled={isAddLiquidityDisabled}
              className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg w-full disabled:bg-gray-600"
            >
              {isTxPending ? 'Working...' : 'Add Liquidity'}
            </button>
            <button
              onClick={handleBatchLiquidate}
              disabled={isTxPending || !hasDebtors}
              className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-600 w-full"
            >
              {isTxPending ? 'Working...' : 'Liquidate Batch'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeRubManager;