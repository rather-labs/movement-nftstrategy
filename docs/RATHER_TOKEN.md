# Rather Token Module Documentation

This document provides a comprehensive explanation of the `rather_token.move` module, covering high-level architecture down to granular syntax details.

---

## Table of Contents

1. [Overview](#overview)
2. [Module Declaration & Imports](#module-declaration--imports)
3. [Constants](#constants)
4. [Struct Definitions](#struct-definitions)
5. [Module Initialization](#module-initialization)
6. [View Functions](#view-functions)
7. [Core Functions](#core-functions)
8. [Entry Functions](#entry-functions)
9. [Movement/Aptos Framework Concepts](#movementaptos-framework-concepts)

---

## Overview

The `rather_token` module implements a **fungible asset** (FA) token called "Rather Token" with symbol "RATHER". It leverages Movement's (Aptos-compatible) fungible asset framework to create a token with:

- **Minting capabilities** - Create new tokens
- **Burning capabilities** - Destroy existing tokens
- **Transfer capabilities** - Move tokens between accounts
- **Primary fungible store integration** - Automatic wallet creation for holders

This is a modern fungible asset implementation, distinct from the legacy `coin` module pattern.

---

## Module Declaration & Imports

```move
module nft_strategy_addr::rather_token {
    use std::string;
    use std::option;
    use aptos_framework::fungible_asset::{Self, MintRef, TransferRef, BurnRef, Metadata};
    use aptos_framework::object::{Self, Object};
    use aptos_framework::primary_fungible_store;
```

### Line-by-Line Breakdown

| Line                                                        | Syntax             | Explanation                                                                                                                       |
| ----------------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `module nft_strategy_addr::rather_token`                    | Module declaration | Declares a module named `rather_token` under the address alias `nft_strategy_addr`. The address is defined in `Move.toml`.        |
| `use std::string`                                           | Import statement   | Imports the `string` module from Move's standard library for UTF-8 string operations.                                             |
| `use std::option`                                           | Import statement   | Imports the `option` module for `Option<T>` type (similar to Rust's Option).                                                      |
| `use aptos_framework::fungible_asset::{Self, MintRef, ...}` | Selective import   | Imports the `fungible_asset` module itself (`Self`) plus specific types. `Self` allows calling `fungible_asset::function_name()`. |
| `use aptos_framework::object::{Self, Object}`               | Selective import   | Imports object framework for creating and managing on-chain objects. `Object<T>` is a typed wrapper around an object address.     |
| `use aptos_framework::primary_fungible_store`               | Full module import | Imports the primary fungible store module for managing token balances.                                                            |

### Import Syntax Patterns

```move
// Pattern 1: Import entire module
use std::string;
// Usage: string::utf8(b"hello")

// Pattern 2: Import module + specific items
use aptos_framework::fungible_asset::{Self, MintRef, BurnRef};
// Usage: fungible_asset::mint(...) or just MintRef directly

// Pattern 3: Import specific items only (no Self)
use aptos_framework::object::{Object};
// Usage: Object<Metadata> (cannot call object::create_named_object)
```

---

## Constants

```move
const DECIMALS: u8 = 8;
```

### Explanation

| Element    | Type            | Purpose                                                                       |
| ---------- | --------------- | ----------------------------------------------------------------------------- |
| `const`    | Keyword         | Declares a compile-time constant                                              |
| `DECIMALS` | Identifier      | Name follows SCREAMING_SNAKE_CASE convention                                  |
| `u8`       | Type annotation | Unsigned 8-bit integer (0-255)                                                |
| `8`        | Value           | Token uses 8 decimal places (like Bitcoin). 1 RATHER = 100,000,000 base units |

### Decimal Implications

With 8 decimals:

- `1_00000000` (100,000,000) = 1.0 RATHER
- `50000000` = 0.5 RATHER
- `1` = 0.00000001 RATHER (smallest unit)

---

## Struct Definitions

### Marker Struct

```move
struct RatherToken {}
```

**Purpose**: This is a **phantom/marker struct** used as a type witness. It has no fields and exists purely for type identification. It can be used for type-based dispatch or as a unique identifier for this token type.

### Token Reference Struct

```move
#[resource_group_member(group = aptos_framework::object::ObjectGroup)]
struct RatherTokenRef has key {
    mint_ref: MintRef,
    transfer_ref: TransferRef,
    burn_ref: BurnRef
}
```

#### Attribute Breakdown

```move
#[resource_group_member(group = aptos_framework::object::ObjectGroup)]
```

| Component                                      | Meaning                                       |
| ---------------------------------------------- | --------------------------------------------- |
| `#[...]`                                       | Attribute syntax (compiler directive)         |
| `resource_group_member`                        | Marks this struct as part of a resource group |
| `group = aptos_framework::object::ObjectGroup` | Specifies which group this belongs to         |

**Resource Groups**: Multiple structs in the same group share a single storage slot on-chain, reducing gas costs when accessing related data.

#### Struct Declaration

```move
struct RatherTokenRef has key {
```

| Component        | Meaning                                                                |
| ---------------- | ---------------------------------------------------------------------- |
| `struct`         | Keyword to define a data structure                                     |
| `RatherTokenRef` | Struct name (PascalCase convention)                                    |
| `has key`        | Ability declaration - can be stored in global storage under an address |

#### Move Abilities Reference

| Ability | Meaning                            | Implication                                               |
| ------- | ---------------------------------- | --------------------------------------------------------- |
| `key`   | Can be stored in global storage    | Enables `move_to`, `move_from`, `borrow_global`, `exists` |
| `store` | Can be stored inside other structs | Enables composition                                       |
| `copy`  | Can be copied                      | Enables implicit duplication                              |
| `drop`  | Can be dropped/discarded           | Enables going out of scope without explicit destruction   |

`RatherTokenRef` only has `key` because:

- It must live in storage ✓
- It should NOT be copied (security - only one set of refs)
- It should NOT be arbitrarily dropped (refs are precious)
- It doesn't need to be stored inside other structs

#### Fields

```move
mint_ref: MintRef,
transfer_ref: TransferRef,
burn_ref: BurnRef
```

| Field          | Type          | Purpose                                          |
| -------------- | ------------- | ------------------------------------------------ |
| `mint_ref`     | `MintRef`     | Capability to create new tokens                  |
| `transfer_ref` | `TransferRef` | Capability to transfer tokens (even frozen ones) |
| `burn_ref`     | `BurnRef`     | Capability to destroy tokens                     |

These are **capability objects** - whoever possesses them controls that action for this token.

---

## Module Initialization

```move
fun init_module(admin: &signer) {
    let constructor_ref = object::create_named_object(admin, b"RatherToken");
    primary_fungible_store::create_primary_store_enabled_fungible_asset(
        &constructor_ref,
        option::none(),
        string::utf8(b"Rather Token"),
        string::utf8(b"RATHER"),
        DECIMALS,
        string::utf8(b""),
        string::utf8(b"")
    );

    let mint_ref = fungible_asset::generate_mint_ref(&constructor_ref);
    let burn_ref = fungible_asset::generate_burn_ref(&constructor_ref);
    let transfer_ref = fungible_asset::generate_transfer_ref(&constructor_ref);

    move_to(
        &object::generate_signer(&constructor_ref),
        RatherTokenRef { mint_ref, transfer_ref, burn_ref }
    );
}
```

### Function Signature

```move
fun init_module(admin: &signer) {
```

| Component              | Meaning                                                          |
| ---------------------- | ---------------------------------------------------------------- |
| `fun`                  | Function declaration keyword                                     |
| `init_module`          | **Special name** - automatically called when module is published |
| `admin: &signer`       | Parameter: immutable reference to signer (the deployer)          |
| No visibility modifier | Private function (only callable within module)                   |

### Step 1: Create Named Object

```move
let constructor_ref = object::create_named_object(admin, b"RatherToken");
```

| Component                     | Meaning                                           |
| ----------------------------- | ------------------------------------------------- |
| `let`                         | Variable binding keyword                          |
| `constructor_ref`             | Variable name (holds a `ConstructorRef`)          |
| `object::create_named_object` | Creates a deterministic object address            |
| `admin`                       | The signer who owns this object                   |
| `b"RatherToken"`              | Byte string literal - seed for address derivation |

**Named Objects**: Address is derived from `hash(creator_address + seed)`, making it predictable and retrievable.

### Step 2: Create Fungible Asset

```move
primary_fungible_store::create_primary_store_enabled_fungible_asset(
    &constructor_ref,        // Reference to the object being created
    option::none(),          // Maximum supply (None = unlimited)
    string::utf8(b"Rather Token"),  // Display name
    string::utf8(b"RATHER"),        // Symbol
    DECIMALS,                // Decimal places
    string::utf8(b""),       // Icon URI (empty)
    string::utf8(b"")        // Project URI (empty)
);
```

| Parameter         | Type              | Value          | Purpose                |
| ----------------- | ----------------- | -------------- | ---------------------- |
| `constructor_ref` | `&ConstructorRef` | Reference      | Links FA to the object |
| `maximum_supply`  | `Option<u128>`    | `none()`       | No supply cap          |
| `name`            | `String`          | "Rather Token" | Human-readable name    |
| `symbol`          | `String`          | "RATHER"       | Ticker symbol          |
| `decimals`        | `u8`              | 8              | Decimal precision      |
| `icon_uri`        | `String`          | ""             | Token icon URL         |
| `project_uri`     | `String`          | ""             | Project website URL    |

### Step 3: Generate Capability References

```move
let mint_ref = fungible_asset::generate_mint_ref(&constructor_ref);
let burn_ref = fungible_asset::generate_burn_ref(&constructor_ref);
let transfer_ref = fungible_asset::generate_transfer_ref(&constructor_ref);
```

Each `generate_*_ref` function creates a **one-time capability** from the constructor reference. Once the `constructor_ref` goes out of scope, no new refs can be generated.

### Step 4: Store References

```move
move_to(
    &object::generate_signer(&constructor_ref),
    TokenARef { mint_ref, transfer_ref, burn_ref }
);
```

| Component                                             | Meaning                                                |
| ----------------------------------------------------- | ------------------------------------------------------ |
| `move_to`                                             | Built-in function to store a resource under an address |
| `object::generate_signer(&constructor_ref)`           | Creates a signer for the object's address              |
| `&` prefix                                            | Takes a reference to the signer                        |
| `RatherTokenRef { mint_ref, transfer_ref, burn_ref }` | Struct literal with shorthand field syntax             |

**Field Shorthand**: When variable name matches field name, you can write `{ field }` instead of `{ field: field }`.

---

## View Functions

```move
#[view]
public fun get_metadata(): Object<Metadata> {
    object::address_to_object<Metadata>(
        object::create_object_address(&@uniswap_v2, b"RatherToken")
    )
}
```

### Attribute

```move
#[view]
```

Marks function as **read-only**. Can be called off-chain without a transaction (free, no gas).

### Signature

```move
public fun get_metadata(): Object<Metadata>
```

| Component            | Meaning                          |
| -------------------- | -------------------------------- |
| `public`             | Callable from outside the module |
| `fun`                | Function keyword                 |
| `get_metadata`       | Function name                    |
| `()`                 | No parameters                    |
| `: Object<Metadata>` | Return type annotation           |

### Body

```move
object::address_to_object<Metadata>(
    object::create_object_address(&@uniswap_v2, b"RatherToken")
)
```

| Component                             | Meaning                                          |
| ------------------------------------- | ------------------------------------------------ |
| `object::address_to_object<Metadata>` | Converts address to typed `Object<Metadata>`     |
| `object::create_object_address`       | Computes deterministic object address            |
| `&@uniswap_v2`                        | Reference to address literal (⚠️ see note below) |
| `b"RatherToken"`                      | Same seed used in `init_module`                  |

> ⚠️ **Bug**: Uses `@uniswap_v2` instead of `@nft_strategy_addr`. This will return an incorrect address unless both aliases point to the same value.

---

## Core Functions

### Mint Function

```move
public fun mint(_admin: &signer, to: address, amount: u64) acquires RatherTokenRef {
    let asset = get_metadata();
    let token_ref = borrow_global<RatherTokenRef>(object::object_address(&asset));
    let fa = fungible_asset::mint(&token_ref.mint_ref, amount);
    primary_fungible_store::deposit(to, fa);
}
```

#### Signature Breakdown

| Component                 | Meaning                                                           |
| ------------------------- | ----------------------------------------------------------------- |
| `public`                  | Callable from other modules                                       |
| `_admin: &signer`         | Underscore prefix = unused parameter (no admin check!)            |
| `to: address`             | Recipient address                                                 |
| `amount: u64`             | Token amount (in base units)                                      |
| `acquires RatherTokenRef` | Declares this function reads/writes `RatherTokenRef` from storage |

#### Function Body

```move
let asset = get_metadata();
```

Gets the `Object<Metadata>` representing this token.

```move
let token_ref = borrow_global<RatherTokenRef>(object::object_address(&asset));
```

| Component                        | Meaning                                          |
| -------------------------------- | ------------------------------------------------ |
| `borrow_global<RatherTokenRef>`  | Borrows resource from global storage (immutable) |
| `object::object_address(&asset)` | Extracts the raw address from the Object wrapper |

```move
let fa = fungible_asset::mint(&token_ref.mint_ref, amount);
```

Creates `amount` new tokens, returns a `FungibleAsset` value.

```move
primary_fungible_store::deposit(to, fa);
```

Deposits the minted tokens into recipient's primary store.

### Burn Function

```move
public fun burn(admin: &signer, _from: address, amount: u64) acquires RatherTokenRef {
    let asset = get_metadata();
    let token_ref = borrow_global<RatherTokenRef>(object::object_address(&asset));
    let fa = primary_fungible_store::withdraw(admin, get_metadata(), amount);
    fungible_asset::burn(&token_ref.burn_ref, fa);
}
```

#### Key Differences from Mint

| Aspect            | Mint                 | Burn                           |
| ----------------- | -------------------- | ------------------------------ |
| Token source      | Created from nothing | Withdrawn from `admin`'s store |
| Token destination | Deposited to `to`    | Destroyed completely           |
| Who pays          | N/A                  | `admin` (signer)               |

> ⚠️ **Note**: `_from` parameter is unused. Burns come from `admin`'s account, not `from`.

---

## Entry Functions

```move
public entry fun mint_entry(admin: &signer, to: address, amount: u64) acquires RatherTokenRef {
    mint(admin, to, amount);
}

public entry fun burn_entry(admin: &signer, from: address, amount: u64) acquires RatherTokenRef {
    burn(admin, from, amount);
}
```

### Entry Function Characteristics

| Modifier | Meaning                                               |
| -------- | ----------------------------------------------------- |
| `public` | Callable externally                                   |
| `entry`  | Can be transaction entry point (callable via CLI/SDK) |

**Why separate entry functions?**

1. `entry` functions cannot return values
2. `entry` functions can only take primitive types and `&signer`
3. Core logic in non-entry functions enables composability with other modules

---

## Movement/Aptos Framework Concepts

### Object Model

The Aptos Object model provides:

- **Deterministic addresses** via `create_named_object`
- **Type safety** via `Object<T>` wrapper
- **Resource groups** for gas-efficient storage
- **Signer generation** for objects to own resources

### Fungible Asset vs Coin

| Aspect        | Fungible Asset (FA)  | Coin                         |
| ------------- | -------------------- | ---------------------------- |
| Storage       | Objects              | Resources under user address |
| Flexibility   | High (custom stores) | Low (fixed structure)        |
| Composability | Better               | Limited                      |
| Modern        | Yes                  | Legacy                       |

### Primary Fungible Store

Automatically creates a "wallet" for any address receiving tokens:

```
User Address
    └── Primary Store (auto-created)
            └── RATHER balance
```

---

## Potential Improvements

1. **Fix address mismatch**: Change `@uniswap_v2` to `@nft_strategy_addr` in `get_metadata()`
2. **Add access control**: The `mint` function has no admin verification
3. **Fix burn logic**: `_from` parameter is misleading since tokens are burned from `admin`
4. **Add events**: Emit mint/burn events for off-chain indexing

---

## CLI Usage Examples

```bash
# Mint tokens
movement move run \
  --function-id 'nft_strategy_addr::rather_token::mint_entry' \
  --args address:RECIPIENT_ADDRESS u64:100000000

# Burn tokens
movement move run \
  --function-id 'nft_strategy_addr::rather_token::burn_entry' \
  --args address:FROM_ADDRESS u64:100000000
```

---

## Summary

The `rather_token` module implements a fungible token using Movement's modern object-based architecture. It demonstrates:

- Module initialization patterns
- Capability-based access control via `*Ref` types
- Object model for deterministic addressing
- Primary fungible store integration
- Entry function patterns for CLI access

The code provides a solid foundation but would benefit from access control improvements and the address fix noted above.
