# Move Smart Contracts

This directory contains the Move smart contracts for the Perpetual Strategy Machines project, built for the Movement blockchain.

## Module Overview

| Module                | Description                                                     |
| --------------------- | --------------------------------------------------------------- |
| `errors.move`         | Centralized error constants for all modules                     |
| `math.move`           | Safe arithmetic operations (sqrt, mul_div, amount calculations) |
| `vault.move`          | Fungible asset vault for secure pool storage                    |
| `lp_token.move`       | LP token management (Fungible Asset + Coin)                     |
| `wmove.move`          | Wrapped MOVE token (1:1 backing with native MOVE)               |
| `rather_token.move`   | RATHER strategy token with burn mechanics                       |
| `pool.move`           | Uniswap V2-style AMM with configurable fees                     |
| `factory.move`        | Pool registry and creation                                      |
| `nft_collection.move` | RatherRobots NFT collection (10k max supply)                    |
| `marketplace.move`    | NFT marketplace with escrow mechanism                           |
| `strategy.move`       | Perpetual strategy execution engine                             |

## Prerequisites

- [Movement CLI](https://docs.movementnetwork.xyz/) installed
- A Movement wallet with testnet/devnet funds

## Commands

### Compile

```bash
movement move compile --skip-fetch-latest-git-deps
```

### Test

```bash
# Run all tests
movement move test

# Run specific test module
movement move test --filter pool_test
movement move test --filter marketplace_test
movement move test --filter nft_collection_test

# Verbose output
movement move test -v
```

### Deploy

```bash
movement move publish --profile YOUR_PROFILE
```

## Post-Deployment Setup

After deploying the modules, initialize the components in this order:

### 1. Initialize Factory

```bash
movement move run --function-id 'MODULE_ADDRESS::factory::initialize' \
  --args address:FEE_SETTER_ADDRESS \
  --profile YOUR_PROFILE
```

### 2. Initialize Marketplace

```bash
movement move run --function-id 'MODULE_ADDRESS::marketplace::initialize' \
  --args u64:250 address:FEE_RECIPIENT \
  --profile YOUR_PROFILE
```

### 3. Initialize Strategy

```bash
movement move run --function-id 'MODULE_ADDRESS::strategy::initialize' \
  --profile YOUR_PROFILE
```

### 4. Create RATHER/WMOVE Pool

```bash
movement move run --function-id 'MODULE_ADDRESS::factory::create_pool_entry' \
  --type-args 'MODULE_ADDRESS::rather_token::RatherToken' 'MODULE_ADDRESS::wmove::WMOVE' \
  --args address:ADMIN address:FEE_RECIPIENT u64:30 u8:1 \
  --profile YOUR_PROFILE
```

### 5. Create NFT Collection

```bash
movement move run --function-id 'MODULE_ADDRESS::nft_collection::create_collection' \
  --args 'string:RatherRobots collection description' \
  --profile YOUR_PROFILE
```

## Configuration

### Move.toml

The `Move.toml` file defines the package configuration. Update `nft_strategy_addr` with your deployment address:

```toml
[addresses]
nft_strategy_addr = "YOUR_DEPLOYMENT_ADDRESS"
```

### Move_devnet.toml

For devnet deployment, use `Move_devnet.toml` which has pre-configured settings.

## Architecture

```
sources/
├── errors.move         # Error constants
├── math.move           # Math utilities
├── vault.move          # Asset vault
├── lp_token.move       # LP tokens
├── wmove.move          # Wrapped MOVE
├── rather_token.move   # RATHER token
├── pool.move           # AMM pool (~940 lines)
├── factory.move        # Pool factory
├── nft_collection.move # NFT collection
├── marketplace.move    # NFT marketplace
└── strategy.move       # Strategy engine

tests/
├── marketplace_test.move
└── nft_collection_test.move
```

## Key Features

### AMM Pool

- Constant product formula (x × y = k)
- 0.3% swap fee
- Configurable protocol fees (up to 10%)
- Fee collection in either token

### Strategy Engine

- Permissionless execution
- Floor buy + 10% premium relist
- Buy & burn mechanism
- Treasury accounting

### NFT Marketplace

- Fixed-price listings
- Escrow mechanism
- Configurable fees

## References

- [Movement Documentation](https://docs.movementnetwork.xyz/)
- [Move Language Reference](https://move-language.github.io/move/)
- [AGENTS.MD](../AGENTS.MD) - Detailed CLI testing commands
