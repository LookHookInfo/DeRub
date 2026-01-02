# Decentralized Ruble (DRUB) Protocol v3

**Developed by [lookhook.info](https://lookhook.info/)**

This project is a decentralized application (DApp) for interacting with the DRUB Protocol on the Base network. The protocol introduces a simplified, robust mechanism for creating a stablecoin pegged to the Russian Ruble, backed by cryptocurrency assets.

This version moves away from a collateralized debt model to a direct purchase and liquidity provision model.

## Core Concepts

The protocol consists of two main smart contracts:

### 1. The `DeRub` Contract
- **Functionality:** This is an ERC20 token contract for DRUB. Its primary purpose is to allow users to purchase (mint) DRUB tokens by spending HASH tokens.
- **Price Mechanism:** The exchange rate (`DRUB per HASH`) is calculated using two data points:
    1.  **USD per HASH:** The price of the HASH token in USD, derived from a Uniswap V3 HASH/USDC liquidity pool.
    2.  **RUB per USD:** A fiat exchange rate provided by a trusted external oracle.
- **Treasury Mint:** When a user buys DRUB, an equivalent amount of DRUB is also minted and sent to the `DrubTreasuryVault` contract. This ensures that for every DRUB in circulation, there is a corresponding DRUB in the treasury, ready to be paired with HASH for liquidity.

### 2. The `DrubTreasuryVault` Contract
- **Functionality:** This vault acts as the protocol's treasury, accumulating HASH tokens from user purchases and the corresponding DRUB tokens from the treasury mint.
- **Liquidity Provision:** Anyone can call the `addLiquidity` function on this contract. This function takes the entire HASH and DRUB balance of the vault and uses it to create a new liquidity position on Uniswap V3. This deepens the market for DRUB and decentralizes its liquidity.
- **Irreversible Liquidity Lock:** The contract includes a `burnAllPositions` function. When called, this function transfers all of the vault's Uniswap V3 LP tokens (represented as NFTs) to a dead address (`0x...dEaD`). This is a **permanent, one-way action** that locks the protocol's liquidity forever, creating a true "liquidity burn".

## Features

The dashboard provides a simple interface for the following actions:
- **Connect Wallet:** Connect to the application on the Base network.
- **Buy DRUB:** Purchase DRUB tokens using your HASH tokens. The UI handles the necessary `approve` and `buyDRUB` transactions.
- **View Market Info:** See the current exchange rates (`DRUB per HASH`, `USD per HASH`) and the oracle's fiat price (`RUB per USD`).
- **Manage Treasury Vault:**
    - View the current HASH and DRUB balances held within the treasury.
    - Initiate the `addLiquidity` transaction.
    - Initiate the irreversible `burnAllPositions` transaction (use with extreme caution).

## Getting Started

To run this project locally:

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```

3.  **Set up environment variables:**
    Create a `.env` file in the root of the project and add your Thirdweb client ID:
    ```
    NEXT_PUBLIC_THIRDWEB_CLIENT_ID=your_thirdweb_client_id
    ```

4.  **Run the development server:**
    ```bash
    npm run dev
    ```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
