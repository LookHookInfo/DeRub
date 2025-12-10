'use client';

import { useState, useCallback } from 'react';
import { client } from '../app/client';
import { useActiveAccount } from 'thirdweb/react';
import {
  getContract,
  prepareContractCall,
  sendTransaction,
  readContract,
  getContractEvents,
  prepareEvent,
} from 'thirdweb';
import { getRpcClient, eth_blockNumber } from 'thirdweb/rpc';
import { base } from 'thirdweb/chains';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../../utils/contracts';
import { formatAmount } from '../../utils/format';

type LiquidationStatus = 'checking' | 'liquidatable' | 'safe' | 'error';

// Add position prop back, even if not directly used by this component's logic
export default function LiquidationManager({
  position,
  onTransactionSuccess,
}: {
  position: any;
  onTransactionSuccess: () => void;
}) {
  const [participants, setParticipants] = useState<string[]>([]);
  const [liquidationStatus, setLiquidationStatus] = useState<
    Record<string, LiquidationStatus>
  >({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debtorDetails, setDebtorDetails] = useState<
    Record<string, { debt: bigint; maxBorrow: bigint; totalValueDRUB: bigint }>
  >({});
  const account = useActiveAccount();

  const scanForLiquidations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setParticipants([]);
    setLiquidationStatus({});
    console.log('Scanning for liquidations...');
    try {
      console.log('Step 1: Initializing contract and events.');

      const contract = getContract({
        client,
        address: CONTRACT_ADDRESS,
        chain: base,
        abi: CONTRACT_ABI,
      });
      console.log('Step 2: Contract obtained.');

      // Fetch debtors using new contract functions
      const numDebtors = Number(
        await readContract({ contract, method: 'debtorsLength', params: [] })
      );
      console.log(`Step 3: Found ${numDebtors} potential debtors.`);

      const debtorAddresses: string[] = [];
      for (let i = 0; i < numDebtors; i++) {
        const debtorAddress = await readContract({
          contract,
          method: 'getDebtor',
          params: [BigInt(i)],
        });
        debtorAddresses.push(debtorAddress);
      }

      const allUsers = debtorAddresses;
      console.log(`Step 8: Found ${allUsers.length} unique users.`);
      setParticipants(allUsers);

      const initialStatus: Record<string, LiquidationStatus> = {};
      allUsers.forEach((user) => {
        initialStatus[user] = 'checking';
      });
      setLiquidationStatus(initialStatus);
      console.log('Step 9: Initializing liquidation status for users.');

      const updatedLiquidationStatus: Record<string, LiquidationStatus> = {};
      const fetchedDebtorDetails: Record<
        string,
        { debt: bigint; maxBorrow: bigint; totalValueDRUB: bigint }
      > = {};

      for (const user of allUsers) {
        console.log(
          `Step 10: Checking liquidatable status and fetching position for user: ${user}`
        );
        try {
          const isUserLiquidatable = await readContract({
            contract,
            method: 'isLiquidatable',
            params: [user],
          });
          updatedLiquidationStatus[user] = isUserLiquidatable
            ? 'liquidatable'
            : 'safe';

          const userPosition = await readContract({
            contract,
            method: 'getUserPosition',
            params: [user],
          });
          // userPosition returns [tokens, balances, debt, maxBorrow, totalValueDRUB]
          fetchedDebtorDetails[user] = {
            debt: userPosition[2],
            maxBorrow: userPosition[3],
            totalValueDRUB: userPosition[4],
          };

          console.log(
            `Step 10.1: User ${user} is ${isUserLiquidatable ? 'liquidatable' : 'safe'}. Debt: ${userPosition[2]}, Max Borrow: ${userPosition[3]}`
          );
        } catch (e) {
          console.error(
            `Step 10.2: Could not check liquidatable status or fetch position for ${user}`,
            e
          );
          updatedLiquidationStatus[user] = 'error';
        }
      }
      setLiquidationStatus(updatedLiquidationStatus);
      setDebtorDetails(fetchedDebtorDetails); // Set the new state variable
      console.log('Step 11: Finished checking all users.');
    } catch (err) {
      console.error(
        'Error scanning for liquidations',
        JSON.stringify(err, Object.getOwnPropertyNames(err))
      );
      setError(
        err instanceof Error
          ? err.message
          : 'An unknown error occurred while scanning.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleLiquidation = async (addressToLiquidate: string) => {
    if (!account) return;
    try {
      const contract = getContract({
        client,
        address: CONTRACT_ADDRESS,
        chain: base,
        abi: CONTRACT_ABI,
      });
      const transaction = prepareContractCall({
        contract,
        method: 'autoLiquidate',
        params: [addressToLiquidate],
      });
      await sendTransaction({ transaction, account });
      onTransactionSuccess();
      await scanForLiquidations();
    } catch (err) {
      console.error('Error during liquidation', err);
      setError(
        err instanceof Error
          ? err.message
          : 'An unknown error occurred during liquidation.'
      );
    }
  };

  const handleLiquidateAll = async () => {
    const liquidatableAddresses = participants.filter(
      (p) => liquidationStatus[p] === 'liquidatable'
    );
    if (!account || liquidatableAddresses.length === 0) return;
    try {
      const contract = getContract({
        client,
        address: CONTRACT_ADDRESS,
        chain: base,
        abi: CONTRACT_ABI,
      });
      const transaction = prepareContractCall({
        contract,
        method: 'autoLiquidateAll',
        params: [liquidatableAddresses],
      });
      await sendTransaction({ transaction, account });
      onTransactionSuccess();
      await scanForLiquidations();
    } catch (err) {
      console.error('Error during liquidate all', err);
      setError(
        err instanceof Error
          ? err.message
          : 'An unknown error occurred during liquidation.'
      );
    }
  };

  const displayedLiquidatableParticipants = participants.filter(
    (address) =>
      liquidationStatus[address] === 'liquidatable' &&
      debtorDetails[address]?.totalValueDRUB > BigInt(0)
  );
  const liquidatableCount = displayedLiquidatableParticipants.length;

  return (
    <div className="p-4 border border-gray-700 rounded-lg mt-4">
      <h3 className="text-xl font-semibold mb-4 text-aave-light-blue">
        Liquidation Management
      </h3>
      <p className="text-sm text-gray-400 mb-4">
        A user is liquidatable if their Loan-to-Value (LTV) exceeds 80%. LTV
        is the ratio of debt to collateral value.
      </p>

      <button
        onClick={scanForLiquidations}
        disabled={isLoading || !account}
        className="bg-aave-light-blue text-white px-4 py-2 rounded-lg hover:opacity-80 transition-opacity disabled:bg-gray-500 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Scanning...' : 'Scan for Participants'}
      </button>

      {error && <p className="mt-4 text-sm text-aave-red">{error}</p>}

      {participants.length > 0 && (
        <div className="mt-4">
          <h4 className="text-lg font-semibold mb-2">
            Participants ({participants.length}):
          </h4>
          <ul className="space-y-2">
            {participants
              .filter(
                (address) =>
                  liquidationStatus[address] === 'liquidatable' &&
                  debtorDetails[address]?.totalValueDRUB > BigInt(0)
              )
              .map((address) => {
                const details = debtorDetails[address];
                let hf = Infinity;
                if (details && details.debt > 0) {
                  hf = Number(details.maxBorrow) / Number(details.debt);
                }

                return (
                  <li
                    key={address}
                    className="flex justify-between items-center bg-gray-800 p-2 rounded-lg"
                  >
                    <div>
                      <span className="font-mono text-sm">{address}</span>
                      {details && details.totalValueDRUB > BigInt(0) && (
                        <div className="text-xs text-gray-400 mt-1">
                          <span
                            className={`font-bold ${
                              hf > 1.0 ? 'text-yellow-500' : 'text-aave-red'
                            }`}
                          >
                            HF: {hf.toFixed(4)}
                          </span>
                          {' | '}LTV:{' '}
                          <span className="font-bold">
                            {(
                              (Number(details.debt) /
                                Number(details.totalValueDRUB)) *
                              100
                            ).toFixed(2)}%
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-4">
                      <span
                        className={`text-sm font-bold ${
                          liquidationStatus[address] === 'liquidatable'
                            ? 'text-aave-red'
                            : liquidationStatus[address] === 'safe'
                            ? 'text-aave-green'
                            : 'text-aave-text-dark'
                        }`}
                      >
                        {liquidationStatus[address].toUpperCase()}
                      </span>
                      <button
                        onClick={() => handleLiquidation(address)}
                        disabled={
                          !account ||
                          liquidationStatus[address] !== 'liquidatable'
                        }
                        className="bg-aave-red text-white px-3 py-1 rounded-lg text-sm hover:opacity-80 transition-opacity disabled:bg-gray-600 disabled:cursor-not-allowed"
                      >
                        Liquidate
                      </button>
                    </div>
                  </li>
                );
              })}
          </ul>
          {liquidatableCount > 0 && (
            <button
              onClick={handleLiquidateAll}
              disabled={!account || liquidatableCount === 0}
              className="mt-4 bg-aave-red text-white px-4 py-2 rounded-lg w-full hover:opacity-80 transition-opacity disabled:bg-gray-500 disabled:cursor-not-allowed"
            >
              Liquidate All ({liquidatableCount})
            </button>
          )}
        </div>
      )}

      {participants.length === 0 && !isLoading && (
        <p className="mt-4 text-aave-text-dark">
          No participants found. Click scan to search.
        </p>
      )}
    </div>
  );
}
