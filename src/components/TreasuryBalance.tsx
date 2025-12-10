'use client';

import { useEffect, useState } from 'react';
import { getContract, readContract } from 'thirdweb';
import { client } from '../app/client';
import { base } from 'thirdweb/chains';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../../utils/contracts';
import TokenBalance from './TokenBalance';

export default function TreasuryBalance({
  tokens,
}: {
  tokens: Record<string, string>;
}) {
  const [treasuryAddress, setTreasuryAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTreasuryAddress = async () => {
      try {
        const contract = getContract({
          client,
          address: CONTRACT_ADDRESS,
          chain: base,
          abi: CONTRACT_ABI,
        });

        const address = await readContract({
          contract,
          method: 'treasury',
          params: [],
        });
        setTreasuryAddress(address);
      } catch (err) {
        console.error('Error fetching treasury address', err);
        setError(
          'Could not fetch treasury address. It may not be defined in the contract.'
        );
      }
    };

    fetchTreasuryAddress();
  }, []);

  if (error) {
    return <div className="text-aave-red">{error}</div>;
  }

  if (!treasuryAddress) {
    return <div>Loading treasury balance...</div>;
  }

  return (
    <div>
      <h3 className="text-xl font-semibold mb-4 text-aave-light-blue">
        Treasury Balance
      </h3>
      <p className="text-sm text-aave-text-dark mb-4">
        Address: {treasuryAddress}
      </p>
      <div className="space-y-2">
        {Object.entries(tokens).map(([name, address]) => (
          <TokenBalance
            key={name}
            tokenAddress={address}
            decimals={18}
            name={name}
            ownerAddress={treasuryAddress}
          />
        ))}
      </div>
    </div>
  );
}
