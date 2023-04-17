# XLA Revenue Share Smart Contract - Waterfall

This repository contains solidity smart contracts + tests for XLA RSC Waterfall created by BlockCzech L&B

This smart contract is designed to distribute funds to the current recipient.
Current recipient is always chosen based on the highest priority of recipients in the pool.

Every recipient has maxCap which determines the maximum funds that will be distributed to the recipient,
maxCap can be bounded to the USD or ETH based on chosen contract.

## Deployment

### testing - polygon

```
X.LA RSC Waterfall factory deployed to:  0x10175899cE9029e5687cC875A283D1CFEc2D241E
```

#### production - polygon

## Running locally

This repository is standard hardhat repository. Use the following commands to test / deploy RSC Prepayment Factory locally.

```shell
npx hardhat test
npx hardhat node
npx hardhat run scripts/deployRSCPrepaymentFactory.ts
```
