'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  useActiveAccount,
  useReadContract,
  useSendTransaction,
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
} from '../app/contracts';
import { approve, allowance } from 'thirdweb/extensions/erc20';

const DeRubManager = () => {
  const account = useActiveAccount();
  const { mutate: sendTransaction, isPending: isTxPending } = useSendTransaction();

  const [amount, setAmount] = useState('');
  const [collateral, setCollateral] = useState('0');
  const [debt, setDebt] = useState('0');
  const [maxDebt, setMaxDebt] = useState('0');
  const [drubPerHash, setDrubPerHash] = useState('0');
  const [hasDebtors, setHasDebtors] = useState(false);

  const contract = getContract({
    client,
    address: DE_RUB_CONTRACT_ADDRESS,
    chain: chain,
    abi: DE_RUB_CONTRACT_ABI,
  });

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

  useEffect(() => {
    if (collateralData) setCollateral(formatUnits(collateralData.toString(), 18));
    if (debtData) setDebt(formatUnits(debtData.toString(), 18));
    if (maxDebtData) setMaxDebt(formatUnits(maxDebtData.toString(), 18));
    if (drubPerHashData) setDrubPerHash(formatUnits(drubPerHashData.toString(), 18));
    if (debtorsLengthData) setHasDebtors(Number(debtorsLengthData) > 0);
  }, [collateralData, debtData, maxDebtData, drubPerHashData, debtorsLengthData]);

  const refetchAll = useCallback(() => {
    refetchCollateral();
    refetchDebt();
    refetchMaxDebt();
    refetchDrubPerHash();
    refetchDebtorsLength();
  }, [refetchCollateral, refetchDebt, refetchMaxDebt, refetchDrubPerHash, refetchDebtorsLength]);
  
  useEffect(() => {
    if (account) {
      refetchAll();
    }
  },[account, refetchAll])

  const handleBatchLiquidate = async () => {
    try {
      const transaction = prepareContractCall({
        contract,
        method: 'liquidateBatch',
        params: [10], // Liquidate up to 10 users
      });
      await sendTransaction(transaction);
      refetchAll();
    } catch (error) {
      console.error('Error during batch liquidation:', error);
      alert('Error during batch liquidation. See console for details.');
    }
  };

  const handleAction = async (action: 'deposit' | 'withdraw' | 'borrow' | 'repay' | 'buy') => {
    if (!account || !amount) return;
    const parsedAmount = parseUnits(amount, 18);
  
    try {
      let transaction;

      if (action === 'deposit' || action === 'buy') {
        const hashContract = getContract({ client, address: HASH_TOKEN_ADDRESS, chain });
        const currentAllowance = await allowance({ contract: hashContract, owner: account.address, spender: DE_RUB_CONTRACT_ADDRESS });
        if (currentAllowance < parsedAmount) {
          const approveTx = approve({
            contract: hashContract,
            spender: DE_RUB_CONTRACT_ADDRESS,
            amount: amount,
          });
          await sendTransaction(approveTx);
        }
      }

      if (action === 'repay') {
        const drubContract = getContract({ client, address: DRUB_TOKEN_ADDRESS, chain });
        const currentAllowance = await allowance({ contract: drubContract, owner: account.address, spender: DE_RUB_CONTRACT_ADDRESS });
        if (currentAllowance < parsedAmount) {
          const approveTx = approve({
            contract: drubContract,
            spender: DE_RUB_CONTRACT_ADDRESS,
            amount: amount,
          });
          await sendTransaction(approveTx);
        }
      }

      switch (action) {
        case 'deposit':
          transaction = prepareContractCall({
            contract,
            method: 'depositCollateral',
            params: [parsedAmount],
          });
          break;
        case 'withdraw':
          transaction = prepareContractCall({
            contract,
            method: 'withdrawCollateral',
            params: [parsedAmount],
          });
          break;
        case 'borrow':
          transaction = prepareContractCall({
            contract,
            method: 'borrowDRUB',
            params: [parsedAmount],
          });
          break;
        case 'repay':
            transaction = prepareContractCall({
                contract,
                method: 'repay',
                params: [parsedAmount],
              });
          break;
        case 'buy':
          transaction = prepareContractCall({
            contract,
            method: 'buyDRUB',
            params: [parsedAmount],
          });
          break;
      }
      await sendTransaction(transaction);
      setAmount('');
      refetchAll();
    } catch (error) {
      console.error(`Error during ${action}:`, error);
      alert(`Error during ${action}. See console for details.`);
    }
  };

  const healthFactor = parseFloat(maxDebt) > 0 ? (parseFloat(debt) / parseFloat(maxDebt)) * 100 : 0;

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-md w-full">
      <h2 className="text-2xl font-bold text-white mb-4">DeRub Manager</h2>
      
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
        <button onClick={() => handleAction('deposit')} disabled={isTxPending} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-600">Deposit HASH</button>
        <button onClick={() => handleAction('withdraw')} disabled={isTxPending} className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-600">Withdraw HASH</button>
        <button onClick={() => handleAction('borrow')} disabled={isTxPending} className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-600">Borrow DRUB</button>
        <button onClick={() => handleAction('repay')} disabled={isTxPending} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-600">Repay DRUB</button>
        <button onClick={() => handleAction('buy')} disabled={isTxPending} className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-600">Buy DRUB with HASH</button>
      </div>

      <div className="mt-4 text-white">
        1 HASH ≈ {parseFloat(drubPerHash).toFixed(4)} DRUB
      </div>

      <div className="mt-8 border-t border-gray-700 pt-6">
        <h3 className="text-xl font-bold text-white mb-4">Liquidation</h3>
        <p className="text-gray-400 mb-4">
          Run a batch liquidation to check and liquidate up to 10 of the most risky positions. 
          This button is active if there are any borrowers in the system.
        </p>
        <button 
            onClick={handleBatchLiquidate} 
            disabled={isTxPending || !hasDebtors} 
            className="bg-red-700 hover:bg-red-800 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-600 w-full"
          >
            {isTxPending ? 'Liquidating...' : 'Liquidate Batch (up to 10)'}
          </button>
      </div>
    </div>
  );
};

export default DeRubManager;