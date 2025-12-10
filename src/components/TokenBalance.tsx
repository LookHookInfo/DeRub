'use client';

import { useEffect, useState } from 'react';
import { getContract, readContract } from 'thirdweb';
import { client } from '../app/client';
import { useActiveAccount, useActiveWallet } from 'thirdweb/react';
import { toTokens } from 'thirdweb/utils';
import { formatAmount } from '../../utils/format';
import { getWalletBalance } from 'thirdweb/wallets';
import { base } from 'thirdweb/chains';
import { ERC20_ABI } from '../../utils/contracts';

export default function TokenBalance({
  tokenAddress,
  decimals = 18,
  name,
  ownerAddress,
}: {
  tokenAddress: string;
  decimals?: number;
  name: string;
  ownerAddress?: string;
}) {
  const [balance, setBalance] = useState('0');
  const account = useActiveAccount();
  const wallet = useActiveWallet();

  const addressToFetch = ownerAddress || account?.address;

  useEffect(() => {
    if (!addressToFetch || !tokenAddress || !wallet) return;

    const fetchBalance = async () => {
      try {
        if (name === 'ETH') {
          const balance = await getWalletBalance({
            client,
            address: addressToFetch,
            chain: base,
          });
          setBalance(formatAmount(toTokens(balance.value, balance.decimals)));
        } else {
          const contract = getContract({
            client,
            address: tokenAddress,
            chain: base,
            abi: ERC20_ABI,
          });

          const bal = await readContract({
            contract,
            method: 'balanceOf',
            params: [addressToFetch],
          });

          // Dynamically fetch decimals for ERC20 tokens
          const tokenDecimals = await readContract({
            contract,
            method: 'decimals',
            params: [],
          });

          setBalance(formatAmount(toTokens(bal, Number(tokenDecimals))));
        }
      } catch (error) {
        console.error('Error fetching balance for', tokenAddress, error);
      }
    };

    fetchBalance();
  }, [addressToFetch, tokenAddress, decimals, wallet, name]);

  return (
    <div className="flex justify-between items-center text-lg">
      <span className="font-semibold text-aave-text-light">{name}:</span>
      <span className="text-aave-text-light">{balance}</span>
    </div>
  );
}
