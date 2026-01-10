# Perpetual Strategy Machines

A DeFi primitive for the Movement ecosystem that enables on-chain, non-custodial strategy tokens powered by automated smart contract execution.

## Overview

Perpetual Strategy Machines implements a "strategy token" model where each token embeds a predefined economic loop ("perpetual machine") that:

- Manages a treasury
- Executes automated buy/sell actions on target assets (NFTs)
- Applies supply control mechanisms (token burns)
- Creates a self-sustaining flywheel

This project adapts the emerging strategy token model into a reusable, Move-native framework for the Movement blockchain.

## Project Structure

```
├── move/                    # Move smart contracts
│   ├── sources/            # Contract source files
│   └── tests/              # Contract tests
├── frontend/               # Next.js frontend application
│   └── src/
│       ├── app/            # App Router pages
│       ├── components/     # UI components
│       ├── lib/            # Contract operations
│       └── hooks/          # React hooks
├── docs/                   # Documentation
└── AGENTS.MD              # Development commands reference
```

## Quick Start

### Prerequisites

- [Movement CLI](https://docs.movementnetwork.xyz/)
- [Node.js](https://nodejs.org/) v18+
- Movement-compatible wallet (e.g., Nightly)

### Smart Contracts

```bash
cd move

# Compile
movement move compile --skip-fetch-latest-git-deps

# Test
movement move test

# Deploy
movement move publish --profile YOUR_PROFILE
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your MODULE_ADDRESS

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the application.

## Smart Contract Modules

| Module           | Purpose                             |
| ---------------- | ----------------------------------- |
| `strategy`       | Perpetual strategy execution engine |
| `pool`           | Uniswap V2-style AMM                |
| `marketplace`    | NFT marketplace with escrow         |
| `nft_collection` | RatherRobots NFT collection         |
| `rather_token`   | Deflationary strategy token         |
| `wmove`          | Wrapped MOVE token                  |
| `factory`        | Pool registry                       |
| `lp_token`       | Liquidity provider tokens           |
| `vault`          | Fungible asset storage              |
| `math`           | Safe arithmetic operations          |
| `errors`         | Centralized error codes             |

## Strategy Mechanics

The perpetual machine operates as a continuous loop:

1. **Treasury** holds WMOVE as operating capital
2. **Floor Buy** - Anyone triggers purchase of lowest-priced NFT
3. **Premium Relist** - NFT is relisted at 10% premium
4. **Sale Proceeds** - Treasury collects MOVE when NFT sells
5. **Buyback** - Anyone triggers swap of proceeds for RATHER tokens
6. **Burn** - Purchased RATHER tokens are permanently burned

All actions are **permissionless** - anyone can trigger them using treasury funds.

## Features

### DeFi Stack

- ✅ Uniswap V2-style AMM with configurable fees
- ✅ LP tokens for liquidity providers
- ✅ Wrapped MOVE (WMOVE) token

### NFT Ecosystem

- ✅ 10,000 max supply NFT collection
- ✅ Fixed-price marketplace with escrow
- ✅ Configurable marketplace fees

### Strategy Engine

- ✅ Permissionless execution
- ✅ Automated floor buying
- ✅ Premium relisting (10%)
- ✅ Buy & burn mechanism
- ✅ On-chain treasury accounting

### Frontend

- ✅ Wallet integration (Nightly)
- ✅ Strategy dashboard
- ✅ Liquidity management
- ✅ NFT marketplace interface
- ✅ Admin panel

## Documentation

- [Perpetual Strategy Machines](docs/PerpetualStrategyMachines.md) - Detailed project documentation
- [AGENTS.MD](AGENTS.MD) - Development commands and CLI testing guide
- [Frontend README](frontend/README.md) - Frontend setup and architecture
- [Move README](move/README.md) - Smart contract details

## Development

### Compile & Test Contracts

```bash
cd move
movement move compile && movement move test
```

### Run Frontend

```bash
cd frontend
npm run dev
```

### Full CLI Testing

See [AGENTS.MD](AGENTS.MD) for complete end-to-end testing commands including:

- Contract deployment
- Module initialization
- Token minting
- Pool creation
- Swap execution
- Strategy actions

## Security

- Signer-based authorization for admin functions
- Safe arithmetic operations (overflow protection)
- Escrow mechanism for NFT trades
- Slippage protection for swaps
- Move ownership model prevents double-spending

## License

MIT

## Acknowledgments

- AMM implementation based on [Movement DeFi Examples](https://github.com/movementlabsxyz/movement-defi-examples/tree/main/univ2)
- Strategy token model inspired by [PunkStrategy](https://punkstrategy.com/)
