
import { useState, useEffect, useCallback } from 'react';
import { useActiveAccount, useReadContract } from 'thirdweb/react';
import { getContract } from 'thirdweb';
import { formatUnits } from 'ethers';
import { client, chain } from '../app/config';
import {
  DE_RUB_CONTRACT_ADDRESS,
  DE_RUB_CONTRACT_ABI,
  VAULT_CONTRACT_ADDRESS,
  VAULT_CONTRACT_ABI,
  HASH_TOKEN_ADDRESS,
  DRUB_TOKEN_ADDRESS,
} from '../app/contracts';
import { balanceOf } from 'thirdweb/extensions/erc20';

const NFPM_CONTRACT_ADDRESS = '0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1';

// --- ERC20/ERC721 ABI for balance checks ---
// A minimal ABI that includes the `balanceOf` function, compatible with both ERC20 and ERC721.
const BALANCE_OF_ABI = [
  {
    "constant": true,
    "inputs": [{"name": "_owner","type": "address"}],
    "name": "balanceOf",
    "outputs": [{"name": "balance","type": "uint256"}],
    "type": "function"
  }
] as const;


// --- Contract Instances ---
export const deRubContract = getContract({ 
  client, 
  address: DE_RUB_CONTRACT_ADDRESS, 
  chain, 
  abi: DE_RUB_CONTRACT_ABI 
});

export const vaultContract = getContract({ 
  client, 
  address: VAULT_CONTRACT_ADDRESS, 
  chain, 
  abi: VAULT_CONTRACT_ABI 
});

export const hashTokenContract = getContract({
    client,
    address: HASH_TOKEN_ADDRESS,
    chain,
    abi: BALANCE_OF_ABI, 
});

export const drubTokenContract = getContract({
    client,
    address: DRUB_TOKEN_ADDRESS,
    chain,
    abi: BALANCE_OF_ABI,
});

export const nfpmContract = getContract({
    client,
    address: NFPM_CONTRACT_ADDRESS,
    chain,
    abi: BALANCE_OF_ABI,
});


export const useDeRubData = () => {
  const account = useActiveAccount();
  const address = account?.address || '';

  // --- Local State for Data ---
  const [drubPerHash, setDrubPerHash] = useState('0');
  const [rubPerUsd, setRubPerUsd] = useState('0');
  const [usdPerHash, setUsdPerHash] = useState('0');
  
  const [userHashBalance, setUserHashBalance] = useState('0');
  const [userDrubBalance, setUserDrubBalance] = useState('0');

  const [vaultHashBalance, setVaultHashBalance] = useState('0');
  const [vaultDrubBalance, setVaultDrubBalance] = useState('0');
  const [hasLPPositions, setHasLPPositions] = useState(false);
  const [lpBalance, setLpBalance] = useState('0');
  
  // --- Read Hooks for Contract Data ---
  const { data: drubPerHashData, refetch: refetchDrubPerHash } = useReadContract({
    contract: deRubContract,
    method: 'getDrubPerHash',
    params: [],
  });

  const { data: rubPerUsdData, refetch: refetchRubPerUsd } = useReadContract({
    contract: deRubContract,
    method: 'rubPerUsd',
    params: [],
  });

  const { data: usdPerHashData, refetch: refetchUsdPerHash } = useReadContract({
    contract: deRubContract,
    method: 'getUsdPerHash',
    params: [],
  });

  // Check the vault's balance of LP NFTs
  const { data: lpBalanceData, refetch: refetchLpBalance } = useReadContract({
    contract: nfpmContract,
    method: 'balanceOf',
    params: [VAULT_CONTRACT_ADDRESS],
  });

  // --- Balance Fetching Logic ---
  const fetchBalances = useCallback(async () => {
    if (address) {
        try {
            const [userHash, userDrub, vaultHash, vaultDrub] = await Promise.all([
                balanceOf({ contract: hashTokenContract, address }),
                balanceOf({ contract: drubTokenContract, address }),
                balanceOf({ contract: hashTokenContract, address: VAULT_CONTRACT_ADDRESS }),
                balanceOf({ contract: drubTokenContract, address: VAULT_CONTRACT_ADDRESS }),
            ]);
            setUserHashBalance(formatUnits(userHash, 18));
            setUserDrubBalance(formatUnits(userDrub, 18));
            setVaultHashBalance(formatUnits(vaultHash, 18));
            setVaultDrubBalance(formatUnits(vaultDrub, 18));
        } catch (error) {
            console.error("Error fetching balances:", error);
        }
    }
  }, [address]);


  // --- Refetch All Data ---
  const refetchAll = useCallback(() => {
    refetchDrubPerHash();
    refetchRubPerUsd();
    refetchUsdPerHash();
    refetchLpBalance(); // Refetch LP balance
    fetchBalances();
  }, [refetchDrubPerHash, refetchRubPerUsd, refetchUsdPerHash, refetchLpBalance, fetchBalances]);

  useEffect(() => {
    refetchAll();
    const interval = setInterval(refetchAll, 15000); // Refresh every 15 seconds
    return () => clearInterval(interval);
  }, [account, refetchAll]);

  // --- Update State when Read Hook Data Changes ---
  useEffect(() => {
    if (drubPerHashData !== undefined) setDrubPerHash(formatUnits(drubPerHashData, 18));
  }, [drubPerHashData]);

  useEffect(() => {
    if (rubPerUsdData !== undefined) setRubPerUsd(formatUnits(rubPerUsdData, 18));
  }, [rubPerUsdData]);
  
  useEffect(() => {
    // This value is scaled by 1e30 in the contract, and needs to be adjusted
    // 1e30 = 1e18 (target) + 1e6 (USDC decimals) + 1e6 (extra)
    // To get back to 1e18, we divide by 1e12
    if (usdPerHashData !== undefined) {
        const adjustedUsdPerHash = formatUnits(usdPerHashData, 30); // 18 (ethers) + 12 = 30
        setUsdPerHash(adjustedUsdPerHash);
    }
  }, [usdPerHashData]);

  useEffect(() => {
    if (lpBalanceData !== undefined) {
      setHasLPPositions(lpBalanceData > 0n);
      setLpBalance(lpBalanceData.toString());
    }
  }, [lpBalanceData]);


  return {
    // Data
    drubPerHash,
    rubPerUsd,
    usdPerHash,
    userHashBalance,
    userDrubBalance,
    vaultHashBalance,
    vaultDrubBalance,
    hasLPPositions,
    lpBalance,
    
    // Refetch Function
    refetchAll,

    // Contracts (for actions)
    deRubContract,
    vaultContract,
    hashTokenContract,
  };
};
