# Crowdly: decentralized crowdfunding on Ethereum

A blockchain mini project (BCT). Anyone can start a funding campaign, and contributors send ETH to a smart contract that holds the money until the deadline. If the goal is met, the creator withdraws the funds. If it is missed, every contributor can claim a refund. No middleman holds the money.

**Network:** Ethereum Sepolia testnet
**Contract:** `0x64fa5352DBCe822A4E1c8B85B6c3dcBdC9EeCE05`

## Features

- Create a campaign (title, description, image URL, goal in ETH, duration in days)
- Contribute ETH before the deadline
- Creator withdraws after the deadline if the goal was met
- Contributors refund themselves after the deadline if the goal was missed
- Live progress bars, status badges and Etherscan links

## Tech stack

| Layer | Tools |
| --- | --- |
| Smart contract | Solidity 0.8.28 |
| Dev and testing | Hardhat 2, Chai, Hardhat Network Helpers |
| Frontend | React, Vite, Tailwind CSS |
| Web3 | Ethers.js v6, browser wallet (Rabby or MetaMask) |
| Network | Hardhat local node, Sepolia testnet via Alchemy |

## How the contract works

| Function | Who can call it | Rule |
| --- | --- | --- |
| `createCampaign` | anyone | goal and duration must be greater than 0 |
| `contribute` | anyone | before the deadline, amount greater than 0 |
| `withdraw` | campaign creator | after the deadline, goal met, only once |
| `refund` | contributor | after the deadline, goal missed |

Security notes: `refund` zeroes the contributor's balance before sending ETH (checks-effects-interactions) to prevent reentrancy, and all ETH transfers check for failure.

## Run it locally

Requirements: Node.js 18 to 22 (LTS), a browser wallet.

```bash
# 1. Contract side
cd contracts-app
npm install
npx hardhat test
npx hardhat node                                           # terminal 1
npx hardhat run scripts/deploy.js --network localhost      # terminal 2

# 2. Frontend
cd ../frontend
npm install
npm run dev
```

Add the Hardhat network to your wallet (RPC `http://127.0.0.1:8545`, chain ID `31337`) and import one of the test accounts printed by `hardhat node`.

To skip a campaign deadline on the local chain: `npx hardhat run scripts/skip-time.js --network localhost`

## Deploy to Sepolia

Copy `contracts-app/.env.example` to `contracts-app/.env` and fill in your own values, then:

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

Never commit `.env`. Use a dedicated wallet that only holds test ETH.

## Screenshots

Add your screenshots here.
