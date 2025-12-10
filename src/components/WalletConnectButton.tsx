'use client';

import { useConnect, useActiveAccount } from 'thirdweb/react';
import { createWallet, walletConnect } from 'thirdweb/wallets';
import { client } from '../app/client';

export default function WalletConnectButton() {
  const { connect, isConnecting } = useConnect();
  const account = useActiveAccount();

  const connectMetaMask = async () => {
    await connect(async () => {
      const walletInstance = createWallet('io.metamask');
      await walletInstance.connect({ client });
      return walletInstance;
    });
  };

  const connectCoinbase = async () => {
    await connect(async () => {
      const walletInstance = createWallet('com.coinbase.wallet');
      await walletInstance.connect({ client });
      return walletInstance;
    });
  };

  const connectWalletConnect = async () => {
    await connect(async () => {
      const walletInstance = walletConnect();
      await walletInstance.connect({ client });
      return walletInstance;
    });
  };

  return (
    <div>
      {account ? (
        <p>Connected: {account.address}</p>
      ) : (
        <div className="flex gap-2">
          <button
            className="bg-aave-light-blue text-white px-4 py-2 rounded-lg hover:opacity-80 transition-opacity"
            onClick={connectMetaMask}
            disabled={isConnecting}
          >
            {isConnecting ? 'Connecting...' : 'Connect MetaMask'}
          </button>
          <button
            className="bg-aave-light-blue text-white px-4 py-2 rounded-lg hover:opacity-80 transition-opacity"
            onClick={connectCoinbase}
            disabled={isConnecting}
          >
            {isConnecting ? 'Connecting...' : 'Connect Coinbase'}
          </button>
          <button
            className="bg-aave-light-blue text-white px-4 py-2 rounded-lg hover:opacity-80 transition-opacity"
            onClick={connectWalletConnect}
            disabled={isConnecting}
          >
            {isConnecting ? 'Connecting...' : 'Connect WalletConnect'}
          </button>
        </div>
      )}
    </div>
  );
}
