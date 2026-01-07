# DRUB — An Experimental Ruble Stablecoin on Base

DRUB is a decentralized ruble-denominated stablecoin launched by the LOOKHOOK team as an experimental project running in production. The token operates on the Base network and is designed to demonstrate a transparent, on-chain economic model without banks or custodial intermediaries.

## Why DRUB Exists

The core idea behind DRUB is to prove that a fiat-referenced stablecoin can exist:

- without banks
- without custodial liquidity
- with transparent minting logic
- and with permanently growing on-chain liquidity

DRUB is launched as an experiment, but it already operates with real contracts, real liquidity, and real users.

## Network and Contract Addresses

- **Network:** Base
- **DRUB Token:** `0x1339c3a22ccdd7560B4Ccacd065Cd4b578BDA12d`
- **Treasury Contract:** `0xd2237A2f81C8Fce8d61919e2e35639897848722d`
- **DRUB / HASH Uniswap V3 Pool:** `0x3609869E22C1f1FeC32b9426aa969F4FC7a3fDb1`

## How DRUB Pricing Works

At the time of writing, the price provider contract is temporarily controlled by the LOOKHOOK team.

1.  The ruble price is sourced from the **Central Bank of the Russian Federation**.
2.  This price is used only as an input reference for minting DRUB.
3.  DRUB can be purchased **exclusively with Hashcoin**, as it is a native asset of the Look Hook ecosystem.

In other words, DRUB uses a fiat reference price (RUB) but is not a bank-issued or custodial asset and is not backed by off-chain reserves.

## DRUB Purchase Mechanics

The purchase flow is fully on-chain and intentionally simple:

1.  A user buys DRUB using **Hashcoin**.
2.  The contract converts RUB → HASH using the reference price.
3.  DRUB is minted to the buyer.
4.  An equal amount of DRUB and the HASH payment are sent to the treasury contract.

**Important:**
- No funds are withdrawn.
- No liquidity is sold.
- The system only accumulates and locks liquidity.

## Treasury Contract & Liquidity Decentralization

The treasury contract (`0xd2237A2f81C8Fce8d61919e2e35639897848722d`):

- has **no owner**.
- is **not controlled by the team**.
- has all administrative rights removed.

It exposes only two public functions:
1.  Aggregate accumulated DRUB and HASH.
2.  Add liquidity to Uniswap V3 and **burn the LP tokens** (sent to `0x...dEaD`).

Anyone can call these functions, making the treasury fully decentralized and trustless.

## Uniswap Pool & Market Arbitrage

Liquidity in the DRUB/HASH Uniswap V3 pool (`0x3609869E22C1f1FeC32b9426aa969F4FC7a3fDb1`):

- grows continuously.
- is **permanently locked** (LP tokens are burned).
- cannot be withdrawn by the team or any third party.

Price alignment is expected to occur naturally through arbitrage, balancing the reference RUB price used for minting and the market price inside the decentralized pool.

## DRUB Model Summary

At its current stage, DRUB features:

- ✔️ Reference RUB price sourced from the Central Bank of Russia.
- ✔️ Purchase exclusively via Hashcoin.
- ✔️ Minting without debt or lending mechanics.
- ✔️ All liquidity locked on-chain.
- ✔️ Uniswap pool with no rug-pull risk.
- ✔️ Experimental but live and functioning design.

DRUB is not a promise of perfect stability. It is an experiment in honest, transparent, and irreversible token economics.

## Important Notice

DRUB is launched as an experimental token. The model may evolve, be refined, or adjusted as the Look Hook ecosystem grows. This project does not constitute financial advice and is not a bank-issued or government-backed instrument.

## Getting Started (Locally)

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