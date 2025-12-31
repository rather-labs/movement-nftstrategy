# Wrapped MOVE (WMOVE) Documentation

This document explains the Wrapped MOVE (WMOVE) token implementation and its usage with the liquidity pool.

---

## Overview

WMOVE is a fungible asset wrapper for the native MOVE coin. It enables native MOVE to be used in FA-based liquidity pools, allowing users to create trading pairs like `RatherToken/WMOVE`.

### Key Properties

| Property    | Value                                    |
| ----------- | ---------------------------------------- |
| Name        | Wrapped MOVE                             |
| Symbol      | WMOVE                                    |
| Decimals    | 8 (same as native MOVE)                  |
| Backing     | 1:1 with native MOVE                     |
| Trust Model | Fully trustless - anyone can wrap/unwrap |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    WMOVE Module                         │
├─────────────────────────────────────────────────────────┤
│  struct WMOVE {}           <- Marker type for pools     │
│  struct WMOVERef {         <- Stored on metadata object │
│      mint_ref,                                          │
│      burn_ref,                                          │
│      transfer_ref,                                      │
│      extend_ref            <- Signs reserve operations  │
│  }                                                      │
├─────────────────────────────────────────────────────────┤
│  Reserve: Native MOVE FA held at WMOVE object address   │
└─────────────────────────────────────────────────────────┘
```

### Wrap Flow

```
User MOVE Balance ──► coin::withdraw ──► coin_to_fungible_asset ──► Reserve
                                                                      │
User WMOVE Balance ◄────────────── mint WMOVE ◄───────────────────────┘
```

### Unwrap Flow

```
User WMOVE Balance ──► withdraw ──► burn WMOVE
                                        │
User MOVE Balance ◄── deposit ◄── withdraw from Reserve (via extend_ref)
```

---

## CLI Usage

Replace `YOUR_ADDRESS` with your deployed contract address.

### 1. Wrap Native MOVE

Convert native MOVE to WMOVE:

```bash
# Wrap 10 MOVE (amount in base units: 10 * 10^8 = 1000000000)
movement move run \
  --function-id 'YOUR_ADDRESS::wmove::wrap' \
  --args u64:1000000000 \
  --profile YOUR_PROFILE
```

### 2. Unwrap WMOVE

Convert WMOVE back to native MOVE:

```bash
# Unwrap 10 WMOVE back to MOVE
movement move run \
  --function-id 'YOUR_ADDRESS::wmove::unwrap' \
  --args u64:1000000000 \
  --profile YOUR_PROFILE
```

### 3. Query WMOVE State

```bash
# Check WMOVE metadata object
movement move view \
  --function-id 'YOUR_ADDRESS::wmove::get_metadata' \
  --profile YOUR_PROFILE

# Check total MOVE reserve backing WMOVE
movement move view \
  --function-id 'YOUR_ADDRESS::wmove::get_reserve' \
  --profile YOUR_PROFILE

# Check total WMOVE supply
movement move view \
  --function-id 'YOUR_ADDRESS::wmove::get_total_supply' \
  --profile YOUR_PROFILE
```

---

## Liquidity Pool Integration

### Create RatherToken/WMOVE Pool

```bash
# First, ensure you have both tokens:
# - RatherToken: mint via rather_token::mint_entry
# - WMOVE: wrap native MOVE via wmove::wrap

# Create the pool
movement move run \
  --function-id 'YOUR_ADDRESS::factory::create_pool_entry' \
  --type-args 'YOUR_ADDRESS::rather_token::RatherToken' 'YOUR_ADDRESS::wmove::WMOVE' \
  --profile YOUR_PROFILE
```

### Add Liquidity

```bash
# Add 100 RatherToken and 100 WMOVE to the pool
movement move run \
  --function-id 'YOUR_ADDRESS::pool::add_liquidity_entry' \
  --type-args 'YOUR_ADDRESS::rather_token::RatherToken' 'YOUR_ADDRESS::wmove::WMOVE' \
  --args u64:10000000000 u64:10000000000 \
  --profile YOUR_PROFILE
```

### Swap RatherToken for WMOVE

```bash
# Swap 1 RatherToken for WMOVE (min 0.9 WMOVE expected)
movement move run \
  --function-id 'YOUR_ADDRESS::pool::swap_x_to_y_entry' \
  --type-args 'YOUR_ADDRESS::rather_token::RatherToken' 'YOUR_ADDRESS::wmove::WMOVE' \
  --args u64:100000000 u64:90000000 \
  --profile YOUR_PROFILE
```

### Swap WMOVE for RatherToken

```bash
# Swap 1 WMOVE for RatherToken (min 0.9 RatherToken expected)
movement move run \
  --function-id 'YOUR_ADDRESS::pool::swap_y_to_x_entry' \
  --type-args 'YOUR_ADDRESS::rather_token::RatherToken' 'YOUR_ADDRESS::wmove::WMOVE' \
  --args u64:100000000 u64:90000000 \
  --profile YOUR_PROFILE
```

### Remove Liquidity

```bash
# Remove liquidity by burning LP tokens
movement move run \
  --function-id 'YOUR_ADDRESS::pool::remove_liquidity_entry' \
  --type-args 'YOUR_ADDRESS::rather_token::RatherToken' 'YOUR_ADDRESS::wmove::WMOVE' \
  --args u64:1000000000 \
  --profile YOUR_PROFILE
```

---

## Complete Example Workflow

```bash
# 1. Deploy the contract
movement move publish --profile YOUR_PROFILE

# 2. Initialize factory
movement move run \
  --function-id 'YOUR_ADDRESS::factory::initialize' \
  --args address:YOUR_ADDRESS \
  --profile YOUR_PROFILE

# 3. Mint some RatherToken
movement move run \
  --function-id 'YOUR_ADDRESS::rather_token::mint_entry' \
  --args address:YOUR_ADDRESS u64:100000000000 \
  --profile YOUR_PROFILE

# 4. Wrap some MOVE into WMOVE
movement move run \
  --function-id 'YOUR_ADDRESS::wmove::wrap' \
  --args u64:100000000000 \
  --profile YOUR_PROFILE

# 5. Create the RatherToken/WMOVE pool
movement move run \
  --function-id 'YOUR_ADDRESS::factory::create_pool_entry' \
  --type-args 'YOUR_ADDRESS::rather_token::RatherToken' 'YOUR_ADDRESS::wmove::WMOVE' \
  --profile YOUR_PROFILE

# 6. Add liquidity (50 of each token)
movement move run \
  --function-id 'YOUR_ADDRESS::pool::add_liquidity_entry' \
  --type-args 'YOUR_ADDRESS::rather_token::RatherToken' 'YOUR_ADDRESS::wmove::WMOVE' \
  --args u64:5000000000 u64:5000000000 \
  --profile YOUR_PROFILE

# 7. Swap RatherToken → WMOVE
movement move run \
  --function-id 'YOUR_ADDRESS::pool::swap_x_to_y_entry' \
  --type-args 'YOUR_ADDRESS::rather_token::RatherToken' 'YOUR_ADDRESS::wmove::WMOVE' \
  --args u64:100000000 u64:90000000 \
  --profile YOUR_PROFILE

# 8. Unwrap WMOVE back to native MOVE
movement move run \
  --function-id 'YOUR_ADDRESS::wmove::unwrap' \
  --args u64:100000000 \
  --profile YOUR_PROFILE
```

---

## Token Amounts Reference

All amounts use 8 decimal places:

| Human Readable | Base Units      |
| -------------- | --------------- |
| 0.01 tokens    | 1,000,000       |
| 0.1 tokens     | 10,000,000      |
| 1 token        | 100,000,000     |
| 10 tokens      | 1,000,000,000   |
| 100 tokens     | 10,000,000,000  |
| 1000 tokens    | 100,000,000,000 |

---

## Error Codes

| Code | Constant                 | Meaning                              |
| ---- | ------------------------ | ------------------------------------ |
| 1    | `E_ZERO_AMOUNT`          | Cannot wrap/unwrap zero amount       |
| 2    | `E_INSUFFICIENT_RESERVE` | Not enough MOVE in reserve to unwrap |

---

## Security Model

- **Trustless**: No admin controls on wrap/unwrap - fully permissionless
- **1:1 Backing**: Every WMOVE is backed by exactly 1 MOVE in the reserve
- **Transparent**: `get_reserve()` view function allows anyone to verify backing
- **No Fees**: Wrap/unwrap operations have no protocol fees (only gas)

---

## Module Reference

| Function              | Type  | Description                      |
| --------------------- | ----- | -------------------------------- |
| `wrap(signer, u64)`   | Entry | Wrap native MOVE into WMOVE      |
| `unwrap(signer, u64)` | Entry | Unwrap WMOVE back to native MOVE |
| `get_metadata()`      | View  | Get WMOVE metadata object        |
| `get_reserve()`       | View  | Get native MOVE backing amount   |
| `get_total_supply()`  | View  | Get total WMOVE in circulation   |
