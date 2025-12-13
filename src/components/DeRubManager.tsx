'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  useActiveAccount,
  useReadContract,
  useSendAndConfirmTransaction,
} from 'thirdweb/react';
import { getContract, prepareContractCall } from 'thirdweb';
import { parseUnits, formatUnits } from 'ethers';
import { client } from '../app/client';
import { chain } from '../app/chain';
import {
  DE_RUB_CONTRACT_ADDRESS,
  DE_RUB_CONTRACT_ABI,
  HASH_TOKEN_ADDRESS,
  DRUB_TOKEN_ADDRESS,
  VAULT_CONTRACT_ADDRESS,
  VAULT_CONTRACT_ABI,
} from '../app/contracts';
import { approve, allowance, balanceOf } from 'thirdweb/extensions/erc20';

const DeRubManager = () => {
  const account = useActiveAccount();
  const { mutate: sendAndConfirmTx, isPending: isTxPending } = useSendAndConfirmTransaction();

  const [amount, setAmount] = useState('');
  const [collateral, setCollateral] = useState('0');
  const [debt, setDebt] = useState('0');
  const [maxDebt, setMaxDebt] = useState('0');
  const [drubPerHash, setDrubPerHash] = useState('0');
  const [hasDebtors, setHasDebtors] = useState(false);
  const [drubBalance, setDrubBalance] = useState('0');
  const [hashBalance, setHashBalance] = useState('0');

  // --- Contract Setups ---
  const contract = getContract({ client, address: DE_RUB_CONTRACT_ADDRESS, chain, abi: DE_RUB_CONTRACT_ABI });
  const vaultContract = getContract({ client, address: VAULT_CONTRACT_ADDRESS, chain, abi: VAULT_CONTRACT_ABI });
  const drubContract = getContract({ client, address: DRUB_TOKEN_ADDRESS, chain, abi: DE_RUB_CONTRACT_ABI });
  const hashContract = getContract({ client, address: HASH_TOKEN_ADDRESS, chain, abi: DE_RUB_CONTRACT_ABI });

  // --- Data Hooks ---
  const { data: collateralData, refetch: refetchCollateral } = useReadContract({
    contract,
    method: 'collateral',
    params: [account?.address || ''],
    queryOptions: { enabled: !!account },
  });

  const { data: debtData, refetch: refetchDebt } = useReadContract({
    contract,
    method: 'debt',
    params: [account?.address || ''],
    queryOptions: { enabled: !!account },
  });

  const { data: maxDebtData, refetch: refetchMaxDebt } = useReadContract({
    contract,
    method: 'maxDebt',
    params: [account?.address || ''],
    queryOptions: { enabled: !!account },
  });

  const { data: drubPerHashData, refetch: refetchDrubPerHash } = useReadContract({
    contract,
    method: 'getDrubPerHash',
    params: [],
  });

  const { data: debtorsLengthData, refetch: refetchDebtorsLength } = useReadContract({
    contract,
    method: 'debtorsLength',
    params: [],
  });

  // --- Data Formatting & State Setting ---
  useEffect(() => {
    if (collateralData) setCollateral(formatUnits(collateralData, 18));
    if (debtData) setDebt(formatUnits(debtData, 18));
    if (maxDebtData) setMaxDebt(formatUnits(maxDebtData, 18));
    if (drubPerHashData) setDrubPerHash(formatUnits(drubPerHashData, 18));
    if (debtorsLengthData) setHasDebtors(Number(debtorsLengthData) > 0);
  }, [collateralData, debtData, maxDebtData, drubPerHashData, debtorsLengthData]);


  // --- Balance & Refetch Logic ---
  const fetchBalances = useCallback(async () => {
    try {
      const drubBal = await balanceOf({ contract: drubContract, address: VAULT_CONTRACT_ADDRESS });
      const hashBal = await balanceOf({ contract: hashContract, address: VAULT_CONTRACT_ADDRESS });
      setDrubBalance(formatUnits(drubBal, 18));
      setHashBalance(formatUnits(hashBal, 18));
    } catch (error) {
      console.error("Error fetching vault balances:", error);
    }
  }, [drubContract, hashContract]);

  const refetchAll = useCallback(() => {
    refetchCollateral();
    refetchDebt();
    refetchMaxDebt();
    refetchDrubPerHash();
    refetchDebtorsLength();
    fetchBalances();
  }, [refetchCollateral, refetchDebt, refetchMaxDebt, refetchDrubPerHash, refetchDebtorsLength, fetchBalances]);

  useEffect(() => {
    if (account) {
      refetchAll();
    }
  }, [account, refetchAll]);


  // --- Transaction Handlers ---
  const handleBatchLiquidate = async () => {
    try {
      const transaction = prepareContractCall({ contract, method: 'liquidateBatch', params: [10n] });
      await sendAndConfirmTx(transaction);
      refetchAll();
    } catch (error) {
      console.error('Error during batch liquidation:', error);
      alert('Error during batch liquidation. See console for details.');
    }
  };

  const handleAddLiquidity = async () => {
    try {
      const transaction = prepareContractCall({ contract: vaultContract, method: 'addLiquidity', params: [] });
      await sendAndConfirmTx(transaction);
      refetchAll();
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
        const currentAllowance = await allowance({ contract: hashContract, owner: account.address, spender: DE_RUB_CONTRACT_ADDRESS });
        if (currentAllowance < parsedAmount) {
          const approveTx = approve({ contract: hashContract, spender: DE_RUB_CONTRACT_ADDRESS, amount: amount });
          await sendAndConfirmTx(approveTx);
        }
        mainTransaction = prepareContractCall({
            contract,
            method: action === 'deposit' ? 'depositCollateral' : 'buyDRUB',
            params: [parsedAmount],
        });
      } 
      else if (action === 'repay') {
        const currentAllowance = await allowance({ contract: drubContract, owner: account.address, spender: DE_RUB_CONTRACT_ADDRESS });
        if (currentAllowance < parsedAmount) {
            const approveTx = approve({ contract: drubContract, spender: DE_RUB_CONTRACT_ADDRESS, amount: amount });
            await sendAndConfirmTx(approveTx);
        }
        mainTransaction = prepareContractCall({ contract, method: 'repay', params: [parsedAmount] });
      }
      else if (action === 'withdraw' || action === 'borrow') {
        mainTransaction = prepareContractCall({
            contract,
            method: action === 'withdraw' ? 'withdrawCollateral' : 'borrowDRUB',
            params: [parsedAmount],
        });
      }

      if (mainTransaction) {
        await sendAndConfirmTx(mainTransaction);
      }
      
      setAmount('');
      refetchAll();
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