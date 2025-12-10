'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { client } from '../app/client';
import { useActiveAccount } from 'thirdweb/react';
import { getContract, prepareContractCall, sendTransaction } from 'thirdweb';
import { base } from 'thirdweb/chains';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../../utils/contracts';
import { toUnits } from 'thirdweb/utils';
import { formatAmount } from '../../utils/format';

const SkeletonLoader = () => (
  <div className="grid grid-cols-2 gap-4">
    {[...Array(4)].map((_, i) => (
      <div
        key={i}
        className="p-2 border border-gray-700 rounded-lg h-[60px] bg-gray-800 animate-pulse"
      >
        <div className="flex items-center justify-between h-full">
          <div className="h-4 bg-gray-700 rounded w-1/4"></div>
          <div className="h-4 bg-gray-700 rounded w-1/3"></div>
        </div>
      </div>
    ))}
  </div>
);

export default function PriceUpdater({
  tokens,
  onTransactionSuccess,
}: {
  tokens: Record<string, string>;
  onTransactionSuccess: () => void;
}) {
  const [prices, setPrices] = useState<
    Record<string, { rub: number; usd: number }>
  >({});
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const account = useActiveAccount();

  const fetchPrices = async () => {
    setIsLoading(true);
    try {
      const btc_data = await axios.get(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=rub,usd'
      );
      const eth_data = await axios.get(
        'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=rub,usd'
      );
      const usdc_data = await axios.get(
        'https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=rub,usd'
      );
      const hash_data = await axios.get(
        'https://api.geckoterminal.com/api/v2/networks/base/pools/0x9ab05414f0a3872a78459693f3e3c9ea3f0d6e71?fields=base_token_price_usd'
      );

      const usdc_rub_price = usdc_data.data['usd-coin'].rub;
      const usdc_usd_price = usdc_data.data['usd-coin'].usd;
      const hash_usd_price = parseFloat(
        hash_data.data.data.attributes.base_token_price_usd
      );

      setPrices({
        cbBTC: {
          rub: btc_data.data.bitcoin.rub,
          usd: btc_data.data.bitcoin.usd,
        },
        ETH: {
          rub: eth_data.data.ethereum.rub,
          usd: eth_data.data.ethereum.usd,
        },
        USDC: { rub: usdc_rub_price, usd: usdc_usd_price },
        HASH: { rub: hash_usd_price * usdc_rub_price, usd: hash_usd_price }, // HASH USD price is direct, RUB is converted
        RUB: { rub: 1, usd: 1 / usdc_rub_price }, // Assuming 1 RUB = 1/USDC_RUB_PRICE USD
      });
    } catch (error) {
      console.error('Error fetching prices', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendPrices = async () => {
    if (!account || Object.keys(prices).length === 0) return;
    try {
      const contract = getContract({
        client,
        address: CONTRACT_ADDRESS,
        chain: base,
        abi: CONTRACT_ABI,
      });

      const tokenAddresses = Object.keys(tokens)
        .filter((t) => t !== 'RUB')
        .map((t) => tokens[t]);
      const priceValues = Object.keys(tokens)
        .filter((t) => t !== 'RUB')
        .map((t) => toUnits(prices[t].rub.toString(), 18));

      const transaction = prepareContractCall({
        contract,
        method: 'setPrices',
        params: [tokenAddresses, priceValues],
      });

      const { transactionHash } = await sendTransaction({
        transaction,
        account,
      });
      setTxHash(transactionHash);
      onTransactionSuccess(); // Trigger refresh
    } catch (error) {
      console.error('Error sending prices', error);
    }
  };

  useEffect(() => {
    fetchPrices();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-aave-light-blue">Prices</h3>
        <button
          className="text-aave-text-dark text-sm font-bold w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center hover:bg-gray-600"
          onClick={() => setIsInfoModalOpen(true)}
        >
          ?
        </button>
      </div>
      {isLoading ? (
        <SkeletonLoader />
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(prices)
            .filter(([token]) => token !== 'RUB')
            .map(([token, price]) => (
              <div
                key={token}
                className="flex flex-col md:flex-row items-start md:items-center justify-between text-lg p-2 border border-gray-700 rounded-lg h-[60px]"
              >
                <span className="font-medium">{token}</span>
                <div className="flex flex-col md:flex-row md:space-x-2">
                  <span className="text-sm font-semibold">
                    {formatAmount(price.rub || 0)} RUB
                  </span>
                  <span className="text-xs text-aave-text-dark">
                    ({formatAmount(price.usd || 0)} $)
                  </span>
                </div>
              </div>
            ))}
        </div>
      )}

      {txHash && (
        <p className="mt-4 text-sm text-aave-text-dark">
          Tx:{' '}
          <a
            href={`https://basescan.org/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-aave-light-blue hover:underline"
          >
            {txHash}
          </a>
        </p>
      )}

      {isInfoModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg max-w-sm w-full relative">
            <h3 className="text-xl font-bold mb-4 text-aave-light-blue">
              About the Oracle
            </h3>
            <p className="text-aave-text-light mb-4">
              The Decentralized Ruble Lending Protocol is a smart contract that
              allows users to take out loans in the DRUB stablecoin,
              collateralized by crypto assets. The protocol combines a
              decentralized approach with a centralized oracle in its current MVP
              stage.
            </p>
            <button
              className="absolute top-2 right-2 text-aave-text-dark hover:text-white text-2xl"
              onClick={() => setIsInfoModalOpen(false)}
            >
              &times;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
