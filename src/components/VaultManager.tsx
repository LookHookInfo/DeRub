'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  useReadContract,
  useSendTransaction,
} from 'thirdweb/react';
import { getContract, prepareContractCall } from 'thirdweb';
import { formatUnits } from 'ethers';
import { client } from '../app/client';
import { chain } from '../app/chain';
import {
  VAULT_CONTRACT_ADDRESS,
  VAULT_CONTRACT_ABI,
  DRUB_TOKEN_ADDRESS,
  HASH_TOKEN_ADDRESS,
} from '../app/contracts';
import { balanceOf } from 'thirdweb/extensions/erc20';

const VaultManager = () => {
  const { mutate: sendTransaction, isPending: isTxPending } = useSendTransaction();

  const [drubBalance, setDrubBalance] = useState('0');
  const [hashBalance, setHashBalance] = useState('0');

  const vaultContract = getContract({
    client,
    address: VAULT_CONTRACT_ADDRESS,
    chain: chain,
    abi: VAULT_CONTRACT_ABI,
  });

  const drubContract = getContract({
    client,
    address: DRUB_TOKEN_ADDRESS,
    chain: chain,
  });

  const hashContract = getContract({
    client,
    address: HASH_TOKEN_ADDRESS,
    chain: chain,
  });


  const fetchBalances = useCallback(async () => {
    try {
      const drubBal = await balanceOf({ contract: drubContract, address: VAULT_CONTRACT_ADDRESS });
      const hashBal = await balanceOf({ contract: hashContract, address: VAULT_CONTRACT_ADDRESS });
      setDrubBalance(formatUnits(drubBal.toString(), 18));
      setHashBalance(formatUnits(hashBal.toString(), 18));
    } catch (error) {
      console.error("Error fetching vault balances:", error);
    }
  }, [drubContract, hashContract]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  const handleAddLiquidity = async () => {
    try {
      const transaction = await prepareContractCall({
        contract: vaultContract,
        method: 'addLiquidity',
        params: [],
      });
      await sendTransaction(transaction);
      fetchBalances();
    } catch (error) {
      console.error('Error adding liquidity:', error);
      alert('Error adding liquidity. See console for details.');
    }
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-md w-full mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-white">Treasury Vault</h2>
        <button 
          onClick={fetchBalances} 
          disabled={isTxPending}
          className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-1 px-3 rounded-lg text-sm disabled:bg-gray-600"
        >
          Refresh
        </button>
      </div>
      <p className="text-gray-400 mb-4">
        This vault collects fees and liquidated collateral. Anyone can help the protocol by calling &apos;Add Liquidity&apos;, which will create a Uniswap V3 position from the tokens held in this vault.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-white">
        <div>Available DRUB: {parseFloat(drubBalance).toFixed(4)}</div>
        <div>Available HASH: {parseFloat(hashBalance).toFixed(4)}</div>
      </div>

      <button 
        onClick={handleAddLiquidity} 
        disabled={isTxPending || parseFloat(drubBalance) === 0 || parseFloat(hashBalance) === 0} 
        className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg w-full disabled:bg-gray-600"
      >
        {isTxPending ? 'Adding Liquidity...' : 'Add Liquidity'}
      </button>
    </div>
  );
};

export default VaultManager;
