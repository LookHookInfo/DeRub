# Decentralized Ruble (DRUB) Lending Protocol

**Developed by [lookhook.info](https://lookhook.info/)**

## Core Concept

The Decentralized Ruble Lending Protocol is a smart contract that enables users to borrow the DRUB stablecoin against cryptocurrency assets. In its current MVP stage, the protocol combines a decentralized architecture with a centralized oracle for price feeds.

## Key Features

### 1. Collateral Deposits

Users can deposit three types of assets as collateral:

- **cbBTC:** `0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf` (8 decimals)
- **Ethereum (ETH):** The native network token
- **HASH:** `0xA9B631ABcc4fd0bc766d7C0C8fCbf866e2bB0445` (18 decimals)

Collateral is stored directly within the contract, with individual balances tracked in the `collateralBalance` mapping.

### 2. Borrowing DRUB

The maximum loan amount is calculated using the following formula:

```solidity
Max Loan = (Total Collateral Value in DRUB) * 80%
```

Users can borrow any amount of DRUB up to this limit, which is then minted to their wallet.

### 3. Liquidation Mechanism

Liquidation is a critical function that protects the protocol. It is triggered when the following condition is met:

```solidity
Debt > 80% of Collateral Value
```

Upon liquidation:
1.  The user's debt is fully repaid.
2.  **All collateral is seized** and transferred to the protocol's treasury.
3.  The user is removed from the list of debtors.

### 4. Buying DRUB with USDC

Users can purchase DRUB directly using USDC. The formula is:

```solidity
DRUB Amount = (USDC Amount * USDC Price) * 100 / (100 - 5%)
```
Where `5%` is the protocol's fee (`USDC_MARKUP`).

---

## ⚠️ Important Terms & Risks

### Loan Conditions
- **Minimum Loan:** Must be greater than 0 DRUB.
- **Collateralization:** Must always be maintained at a minimum of 125% (the inverse of the 80% loan-to-value ratio).
- **Debtor List:** A user is automatically added to the list of debtors upon taking their first loan.

### User Risks
- **Total Loss of Collateral:** In a liquidation event, the user loses their entire collateral.
- **Oracle Dependency:** The protocol's health and liquidation calculations are dependent on the prices provided by the centralized oracle.
- **Volatility:** The value of collateral assets can fluctuate rapidly, which may quickly change a user's collateralization level and lead to liquidation.

---

## ️ Governance & Oracle

### Current MVP Model
- **Oracle:** A centralized `priceUpdater` address is responsible for setting asset prices.
- **Ownership:** The contract owner has the authority to change the `priceUpdater` address. The contract also includes a function to renounce ownership completely.

### Price Update Mechanism
- Prices can be updated in batches via the `setPrices()` function.
- Only trusted addresses designated by the owner can update prices.
- Zero-value prices are not permitted.

---

## Technical Features

### Optimizations
- **O(1) Debtor Removal:** A mapping-based index allows for efficient (O(1)) removal of users from the debtors list during liquidation.
- **Gas Savings:** `unchecked` blocks are used in loops for gas efficiency, and custom errors are used instead of `require` statements.

### Security
- **Checks-Effects-Interactions Pattern:** Implemented to prevent re-entrancy attacks.
- **`nonReentrant` Modifier:** Provides an additional layer of protection against re-entrancy.
- **Pre-computation Checks:** The protocol validates collateralization levels before allowing collateral withdrawal to prevent undercollateralized positions.

---

## Conclusion

The Decentralized Ruble protocol offers a simple yet powerful mechanism for crypto-backed lending. Its strict liquidation mechanism (seizure of all collateral) is designed to robustly protect the protocol from risk but requires users to diligently monitor their collateralization level.

This MVP version, with its centralized oracle, lays a secure and predictable foundation for future decentralization and expansion.