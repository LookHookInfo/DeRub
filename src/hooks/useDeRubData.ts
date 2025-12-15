
import { useState, useEffect, useCallback } from 'react';
import { useActiveAccount, useReadContract } from 'thirdweb/react';
import { getContract } from 'thirdweb';
import { formatUnits } from 'ethers';
import { client, chain } from '../app/config';
import {
  DE_RUB_CONTRACT_ADDRESS,
  DE_RUB_CONTRACT_ABI,
  HASH_TOKEN_ADDRESS,
  DRUB_TOKEN_ADDRESS,
  VAULT_CONTRACT_ADDRESS,
} from '../app/contracts';
import { balanceOf } from 'thirdweb/extensions/erc20';

// Contract Setups
const deRubContract = getContract({ client, address: DE_RUB_CONTRACT_ADDRESS, chain, abi: DE_RUB_CONTRACT_ABI });
const drubTokenContract = getContract({ client, address: DRUB_TOKEN_ADDRESS, chain, abi: DE_RUB_CONTRACT_ABI });
const hashTokenContract = getContract({ client, address: HASH_TOKEN_ADDRESS, chain, abi: DE_RUB_CONTRACT_ABI });


export const useDeRubData = () => {
  const account = useActiveAccount();
  const address = account?.address || '';

  // --- Local State ---
  const [collateral, setCollateral] = useState('0');
  const [debt, setDebt] = useState('0');
  const [maxDebt, setMaxDebt] = useState('0');
  const [drubPerHash, setDrubPerHash] = useState('0');
  const [hasDebtors, setHasDebtors] = useState(false);
  const [drubBalance, setDrubBalance] = useState('0');
  const [hashBalance, setHashBalance] = useState('0');

  // --- Read Hooks ---
  const { data: collateralData, refetch: refetchCollateral } = useReadContract({
    contract: deRubContract,
    method: 'collateral',
    params: [address],
    queryOptions: { enabled: !!account },
  });

  const { data: debtData, refetch: refetchDebt } = useReadContract({
    contract: deRubContract,
    method: 'debt',
    params: [address],
    queryOptions: { enabled: !!account },
  });

  const { data: maxDebtData, refetch: refetchMaxDebt } = useReadContract({
    contract: deRubContract,
    method: 'maxDebt',
    params: [address],
    queryOptions: { enabled: !!account },
  });

  const { data: drubPerHashData, refetch: refetchDrubPerHash } = useReadContract({
    contract: deRubContract,
    method: 'getDrubPerHash',
    params: [],
  });

  const { data: debtorsLengthData, refetch: refetchDebtorsLength } = useReadContract({
    contract: deRubContract,
    method: 'debtorsLength',
    params: [],
  });
  
  // --- Balance Fetching ---
  const fetchBalances = useCallback(async () => {
    try {
      const drubBal = await balanceOf({ contract: drubTokenContract, address: VAULT_CONTRACT_ADDRESS });
      const hashBal = await balanceOf({ contract: hashTokenContract, address: VAULT_CONTRACT_ADDRESS });
      setDrubBalance(formatUnits(drubBal, 18));
      setHashBalance(formatUnits(hashBal, 18));
    } catch (error) {
      console.error("Error fetching vault balances:", error);
    }
  }, [drubTokenContract, hashTokenContract]);

  // --- Initial Fetch and Refreshes ---
  const refetchAllUserData = useCallback(() => {
    if (account) {
        refetchCollateral();
        refetchDebt();
        refetchMaxDebt();
    }
  }, [account, refetchCollateral, refetchDebt, refetchMaxDebt]);

  const refetchSystemData = useCallback(() => {
    refetchDrubPerHash();
    refetchDebtorsLength();
    fetchBalances();
  }, [refetchDrubPerHash, refetchDebtorsLength, fetchBalances]);

  useEffect(() => {
    if (account) {
      refetchAllUserData();
      refetchSystemData();
    }
  }, [account, refetchAllUserData, refetchSystemData]);


  // --- Data Formatting & State Setting ---
  useEffect(() => {
    if (collateralData !== undefined) setCollateral(formatUnits(collateralData, 18));
  }, [collateralData]);

  useEffect(() => {
    if (debtData !== undefined) setDebt(formatUnits(debtData, 18));
  }, [debtData]);

  useEffect(() => {
    if (maxDebtData !== undefined) setMaxDebt(formatUnits(maxDebtData, 18));
  }, [maxDebtData]);

  useEffect(() => {
    if (drubPerHashData !== undefined) setDrubPerHash(formatUnits(drubPerHashData, 18));
  }, [drubPerHashData]);

  useEffect(() => {
    if (debtorsLengthData !== undefined) setHasDebtors(Number(debtorsLengthData) > 0);
  }, [debtorsLengthData]);


  return {
    // Data
    collateral,
    debt,
    maxDebt,
    drubPerHash,
    hasDebtors,
    drubBalance,
    hashBalance,
    
    // Selective Refetch Functions
    refetchCollateral,
    refetchDebt,
    refetchMaxDebt,
    refetchDrubPerHash,
    refetchDebtorsLength,
    fetchBalances,
    refetchAllUserData,
    refetchSystemData,

    // Contracts (for actions)
    deRubContract,
    drubTokenContract,
    hashTokenContract,
  };
};
