'use client';

import { useState } from 'react';
import {
  useActiveAccount,
  useSendAndConfirmTransaction,
} from 'thirdweb/react';
import { prepareContractCall, toWei } from 'thirdweb';
import { approve, allowance } from 'thirdweb/extensions/erc20';
import {
  useDeRubData,
  deRubContract,
  vaultContract,
  hashTokenContract,
} from '../hooks/useDeRubData';
import { DE_RUB_CONTRACT_ADDRESS } from '../app/contracts';

const DeRubManager = () => {
  const account = useActiveAccount();
  const { mutate: sendAndConfirmTx, isPending: isTxPending } = useSendAndConfirmTransaction();

  const [hashAmount, setHashAmount] = useState('');

  const {
    drubPerHash,
    rubPerUsd,
    usdPerHash,
    userHashBalance,
    userDrubBalance,
    vaultHashBalance,
    vaultDrubBalance,
    hasLPPositions,
    lpBalance,
    refetchAll,
  } = useDeRubData();

  // --- UI Computed Values ---
  const drubToReceive = hashAmount && drubPerHash > 0 ? parseFloat(hashAmount) * drubPerHash : 0;
  const isBuyButtonDisabled = isTxPending || !hashAmount || parseFloat(hashAmount) <= 0 || parseFloat(hashAmount) > parseFloat(userHashBalance);
  const isAddLiquidityDisabled = isTxPending || parseFloat(vaultDrubBalance) <= 0 || parseFloat(vaultHashBalance) <= 0;
  const isBurnPositionsDisabled = isTxPending || !hasLPPositions;

  // --- Event Handlers ---

  const handleSetMax = () => {
    setHashAmount(userHashBalance.toString());
  };

  const handleBuy = async () => {
    if (!account || !hashAmount || parseFloat(hashAmount) <= 0) {
      console.error('Please enter a valid amount.');
      return;
    }
    const amountWei = toWei(hashAmount.toString());

    try {
      const currentAllowance = await allowance({
        contract: hashTokenContract,
        owner: account.address,
        spender: DE_RUB_CONTRACT_ADDRESS,
      });

      if (currentAllowance < amountWei) {
        const approveTx = approve({
          contract: hashTokenContract,
          spender: DE_RUB_CONTRACT_ADDRESS,
          amount: hashAmount.toString(),
        });
        await sendAndConfirmTx(approveTx);
      }

      const transaction = prepareContractCall({
        contract: deRubContract,
        method: 'buyDRUB',
        params: [amountWei],
      });
      await sendAndConfirmTx(transaction);

      setHashAmount('');
      refetchAll();
    } catch (error) {
      console.error('Error during purchase:', error);
    }
  };

  const handleAddLiquidity = async () => {
    console.log('--- handleAddLiquidity triggered ---');
    console.log('Checking account:', account);
    if (!account) {
      console.error('No active account found. Aborting.');
      return;
    }

    // Also log the values used for the disabled check
    console.log('Vault HASH Balance:', vaultHashBalance);
    console.log('Vault DRUB Balance:', vaultDrubBalance);
    console.log('isAddLiquidityDisabled:', isAddLiquidityDisabled);

    if (isAddLiquidityDisabled) {
        console.error('Button is disabled, but was clicked. This should not happen.');
        return;
    }

    try {
      console.log('Preparing contract call...');
      console.log('Contract:', vaultContract.address);
      console.log('Method: addLiquidity');

      const transaction = prepareContractCall({ 
        contract: vaultContract, 
        method: 'addLiquidity', 
        params: [] 
      });

      console.log('Transaction prepared:', transaction);
      console.log('Sending and confirming transaction...');

      await sendAndConfirmTx(transaction);
      
      console.log('Transaction confirmed! Refetching all data.');
      refetchAll();
    } catch (error) {
      console.error('Error adding liquidity:', error);
    }
  };

  const handleBurnPositions = async () => {
    if (!account) return;
    try {
      const transaction = prepareContractCall({ contract: vaultContract, method: 'burnAllPositions', params: [] });
      await sendAndConfirmTx(transaction);
      refetchAll();
    } catch (error) {
      console.error('Error burning positions:', error);
    }
  };


  return (
    <div className="space-y-8">
      {/* ----------- Buy DRUB Panel ----------- */}
      <div className="bg-gray-800 p-6 rounded-lg shadow-md w-full">
        <h2 className="text-2xl font-bold text-white mb-4">Buy DRUB with HASH</h2>

        <div className="grid grid-cols-2 gap-4 mb-4 text-sm text-gray-300">
          <div>Your HASH Balance: {parseFloat(userHashBalance).toFixed(4)}</div>
          <div>Your DRUB Balance: {parseFloat(userDrubBalance).toFixed(4)}</div>
        </div>

        <div className="flex items-center space-x-4 mb-4">
          <div className="relative w-full">
            <input
              type="number"
              value={hashAmount}
              onChange={(e) => setHashAmount(e.target.value)}
              placeholder={`HASH Balance: ${parseFloat(userHashBalance).toFixed(4)}`}
              className="w-full px-4 py-2 bg-gray-700 text-white border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 pr-12"
            />
            <button
              onClick={handleSetMax}
              className="absolute inset-y-0 right-0 px-3 flex items-center bg-gray-600 hover:bg-gray-500 text-white text-sm font-bold rounded-r-lg"
            >
              MAX
            </button>
          </div>
          <button
            onClick={handleBuy}
            disabled={isBuyButtonDisabled}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded-lg disabled:bg-gray-600 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {isTxPending ? 'Working...' : `Buy ${drubToReceive.toFixed(2)} DRUB`}
          </button>
        </div>
        {parseFloat(hashAmount) > parseFloat(userHashBalance) && (
          <p className="text-red-500 text-sm mt-2">Insufficient HASH balance.</p>
        )}
      </div>


      {/* ----------- Info Panel ----------- */}
      <div className="bg-gray-800 p-6 rounded-lg shadow-md w-full">
        <h2 className="text-2xl font-bold text-white mb-4">Market Info</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-white text-center">
          <div className="bg-gray-700 p-4 rounded-lg">
            <div className="text-sm text-gray-400">DRUB per HASH</div>
            <div className="text-xl font-bold">{parseFloat(drubPerHash).toFixed(4)}</div>
          </div>
          <div className="bg-gray-700 p-4 rounded-lg">
            <div className="text-sm text-gray-400">USD per HASH</div>
            <div className="text-xl font-bold">${parseFloat(usdPerHash).toFixed(4)}</div>
          </div>
          <div className="bg-gray-700 p-4 rounded-lg">
            <div className="text-sm text-gray-400">RUB per USD (Oracle)</div>
            <div className="text-xl font-bold">₽{parseFloat(rubPerUsd).toFixed(2)}</div>
          </div>
        </div>
      </div>


      {/* ----------- Treasury Panel ----------- */}
      <div className="bg-gray-800 p-6 rounded-lg shadow-md w-full">
        <h2 className="text-2xl font-bold text-white mb-4">Treasury Vault</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 text-white">
          <div className="bg-gray-700 p-4 rounded-lg">
            <div className="text-sm text-gray-400">Vault HASH Balance</div>
            <div className="text-lg">{parseFloat(vaultHashBalance).toFixed(4)}</div>
          </div>
          <div className="bg-gray-700 p-4 rounded-lg">
            <div className="text-sm text-gray-400">Vault DRUB Balance</div>
            <div className="text-lg">{parseFloat(vaultDrubBalance).toFixed(4)}</div>
          </div>
          <div className="bg-gray-700 p-4 rounded-lg">
            <div className="text-sm text-gray-400">LP to Burn</div>
            <div className="text-lg">{lpBalance}</div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <button
            onClick={handleAddLiquidity}
            disabled={isAddLiquidityDisabled}
            className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded-lg w-full disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            {isTxPending ? 'Working...' : 'Add Liquidity to Pool'}
          </button>
          <button
            onClick={handleBurnPositions}
            disabled={isBurnPositionsDisabled}
            className="bg-red-700 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-600 w-full"
          >
            {isTxPending ? 'Working...' : 'Burn All LP Tokens'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeRubManager;
