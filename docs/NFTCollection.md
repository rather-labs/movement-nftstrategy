# NFT Collection - RatherRobots

A simple NFT collection module for Movement blockchain. Creates unique robot avatar NFTs with deterministic metadata URIs.

## Overview

The RatherRobots collection enables:

- **Create collection** with fixed 10,000 token supply
- **Mint NFTs** to any recipient (creator-only)
- **Transfer NFTs** between accounts
- **Burn NFTs** to permanently remove them

All NFTs are fully transferable and compatible with the [Marketplace](Marketplace.md).

## Architecture

### Data Structures

```move
// Collection resource stored at deterministic address
#[resource_group_member(group = aptos_framework::object::ObjectGroup)]
struct Collection has key {
    creator: address,              // Only address that can mint
    name: String,                  // "RatherRobots"
    description: String,           // User-provided description
    current_supply: u64,           // Minted count (0 to 10,000)
    tokens: SmartTable<u64, address>,  // token_id → NFT address
    extend_ref: ExtendRef          // For future extensions
}

// NFT resource stored at individual object addresses
#[resource_group_member(group = aptos_framework::object::ObjectGroup)]
struct NFT has key {
    collection: address,           // Parent collection address
    token_id: u64                  // Unique ID (1 to 10,000)
}
```

### Constants

| Constant          | Value                       | Description                       |
| ----------------- | --------------------------- | --------------------------------- |
| `MAX_SUPPLY`      | 10,000                      | Maximum tokens that can be minted |
| `BASE_URI`        | `https://robohash.org/user` | Base URL for token metadata       |
| `COLLECTION_NAME` | `RatherRobots`              | Fixed collection name             |

### Token URI

Each NFT's metadata URI is deterministically derived:

```
Token ID 1    → https://robohash.org/user1
Token ID 42   → https://robohash.org/user42
Token ID 9999 → https://robohash.org/user9999
```

## Entry Functions

### Create Collection

```bash
# Create the RatherRobots collection
movement move run --function-id 'YOUR_ADDRESS::nft_collection::create_collection' \
  --args 'string:A collection of unique robot avatars' \
  --profile YOUR_PROFILE
```

| Parameter     | Type      | Description                                  |
| ------------- | --------- | -------------------------------------------- |
| `creator`     | `&signer` | Collection creator (becomes the only minter) |
| `description` | `String`  | Collection description                       |

**Note:** Only one RatherRobots collection can exist per creator address.

### Mint NFT

```bash
# Mint a single NFT to recipient
movement move run --function-id 'YOUR_ADDRESS::nft_collection::mint' \
  --args address:RECIPIENT_ADDRESS \
  --profile YOUR_PROFILE
```

| Parameter   | Type      | Description                    |
| ----------- | --------- | ------------------------------ |
| `creator`   | `&signer` | Must be the collection creator |
| `recipient` | `address` | Address to receive the NFT     |

**Restrictions:**

- Only the collection creator can mint
- Maximum 10,000 tokens can be minted
- Token IDs are assigned sequentially (1, 2, 3, ...)

### Batch Mint

```bash
# Mint 10 NFTs to recipient
movement move run --function-id 'YOUR_ADDRESS::nft_collection::mint_batch' \
  --args address:RECIPIENT_ADDRESS u64:10 \
  --profile YOUR_PROFILE
```

| Parameter   | Type      | Description                    |
| ----------- | --------- | ------------------------------ |
| `creator`   | `&signer` | Must be the collection creator |
| `recipient` | `address` | Address to receive all NFTs    |
| `count`     | `u64`     | Number of NFTs to mint         |

### Transfer NFT

```bash
# Transfer NFT to new owner
movement move run --function-id 'YOUR_ADDRESS::nft_collection::transfer' \
  --args object:NFT_OBJECT_ADDRESS address:NEW_OWNER \
  --profile YOUR_PROFILE
```

| Parameter | Type          | Description            |
| --------- | ------------- | ---------------------- |
| `owner`   | `&signer`     | Current NFT owner      |
| `nft`     | `Object<NFT>` | NFT object to transfer |
| `to`      | `address`     | New owner address      |

**Alternative:** You can also use the native `object::transfer` function directly.

### Burn NFT

```bash
# Permanently destroy an NFT
movement move run --function-id 'YOUR_ADDRESS::nft_collection::burn' \
  --args object:NFT_OBJECT_ADDRESS \
  --profile YOUR_PROFILE
```

| Parameter | Type          | Description           |
| --------- | ------------- | --------------------- |
| `owner`   | `&signer`     | Must be the NFT owner |
| `nft`     | `Object<NFT>` | NFT object to burn    |

**Warning:** Burning is permanent. The token ID will not be reused.

## View Functions

### Get Collection Address

```bash
movement move view --function-id 'YOUR_ADDRESS::nft_collection::get_collection_address' \
  --args address:CREATOR_ADDRESS \
  --profile YOUR_PROFILE
```

Returns: `address` (deterministic collection address)

### Get Collection Info

```bash
movement move view --function-id 'YOUR_ADDRESS::nft_collection::get_collection_info' \
  --args address:COLLECTION_ADDRESS \
  --profile YOUR_PROFILE
```

Returns: `(creator: address, name: String, description: String, current_supply: u64, max_supply: u64)`

### Get NFT Info

```bash
movement move view --function-id 'YOUR_ADDRESS::nft_collection::get_nft_info' \
  --args address:NFT_ADDRESS \
  --profile YOUR_PROFILE
```

Returns: `(collection: address, token_id: u64)`

### Get Token URI

```bash
movement move view --function-id 'YOUR_ADDRESS::nft_collection::token_uri' \
  --args object:NFT_OBJECT_ADDRESS \
  --profile YOUR_PROFILE
```

Returns: `String` (e.g., `"https://robohash.org/user42"`)

### Get NFT Owner

```bash
movement move view --function-id 'YOUR_ADDRESS::nft_collection::get_owner' \
  --args object:NFT_OBJECT_ADDRESS \
  --profile YOUR_PROFILE
```

Returns: `address`

### Get NFT by Token ID

```bash
movement move view --function-id 'YOUR_ADDRESS::nft_collection::get_nft_by_token_id' \
  --args address:COLLECTION_ADDRESS u64:TOKEN_ID \
  --profile YOUR_PROFILE
```

Returns: `address` (NFT object address)

### Check Collection Exists

```bash
movement move view --function-id 'YOUR_ADDRESS::nft_collection::collection_exists' \
  --args address:CREATOR_ADDRESS \
  --profile YOUR_PROFILE
```

Returns: `bool`

### Get Current Supply

```bash
movement move view --function-id 'YOUR_ADDRESS::nft_collection::get_current_supply' \
  --args address:COLLECTION_ADDRESS \
  --profile YOUR_PROFILE
```

Returns: `u64`

### Get Max Supply

```bash
movement move view --function-id 'YOUR_ADDRESS::nft_collection::get_max_supply' \
  --profile YOUR_PROFILE
```

Returns: `u64` (always 10,000)

### Check NFT Exists

```bash
movement move view --function-id 'YOUR_ADDRESS::nft_collection::nft_exists' \
  --args address:NFT_ADDRESS \
  --profile YOUR_PROFILE
```

Returns: `bool`

## Events

All collection actions emit events for off-chain indexing:

| Event               | Fields                                               | Description            |
| ------------------- | ---------------------------------------------------- | ---------------------- |
| `CollectionCreated` | `collection`, `creator`, `name`, `max_supply`        | New collection created |
| `NFTMinted`         | `collection`, `token_id`, `nft_address`, `recipient` | NFT minted             |
| `NFTTransferred`    | `nft_address`, `from`, `to`                          | NFT transferred        |
| `NFTBurned`         | `collection`, `token_id`, `nft_address`, `owner`     | NFT burned             |

## Error Codes

| Code | Constant                     | Description                         |
| ---- | ---------------------------- | ----------------------------------- |
| 32   | `ECOLLECTION_NOT_EXISTS`     | Collection not found                |
| 33   | `ECOLLECTION_ALREADY_EXISTS` | Collection already created          |
| 34   | `EMAX_SUPPLY_REACHED`        | Cannot mint more than 10,000 tokens |
| 35   | `ENOT_COLLECTION_CREATOR`    | Only creator can mint               |
| 36   | `EINVALID_TOKEN_ID`          | Token ID not found                  |
| 27   | `ENFT_NOT_OWNED`             | Caller is not the NFT owner         |

## Marketplace Integration

RatherRobots NFTs are fully compatible with the marketplace:

```bash
# 1. Create collection
movement move run --function-id 'YOUR_ADDRESS::nft_collection::create_collection' \
  --args 'string:My robot collection' \
  --profile YOUR_PROFILE

# 2. Mint an NFT to yourself
movement move run --function-id 'YOUR_ADDRESS::nft_collection::mint' \
  --args address:YOUR_ADDRESS \
  --profile YOUR_PROFILE

# 3. Get the NFT address
movement move view --function-id 'YOUR_ADDRESS::nft_collection::get_nft_by_token_id' \
  --args address:COLLECTION_ADDRESS u64:1 \
  --profile YOUR_PROFILE

# 4. List on marketplace for 10 MOVE
movement move run --function-id 'YOUR_ADDRESS::marketplace::list_nft' \
  --type-args 'YOUR_ADDRESS::nft_collection::NFT' \
  --args object:NFT_ADDRESS u64:1000000000 \
  --profile YOUR_PROFILE
```

### Type Argument

When interacting with the marketplace, use the NFT type:

```
YOUR_ADDRESS::nft_collection::NFT
```

## Complete Lifecycle Example

```bash
# Step 1: Create collection
movement move run --function-id 'YOUR_ADDRESS::nft_collection::create_collection' \
  --args 'string:Unique robot avatars on Movement' \
  --profile creator

# Step 2: Mint 5 NFTs to a user
movement move run --function-id 'YOUR_ADDRESS::nft_collection::mint_batch' \
  --args address:0x123...abc u64:5 \
  --profile creator

# Step 3: Check collection supply
movement move view --function-id 'YOUR_ADDRESS::nft_collection::get_current_supply' \
  --args address:COLLECTION_ADDRESS \
  --profile creator
# Returns: 5

# Step 4: Get token URI for NFT #3
movement move view --function-id 'YOUR_ADDRESS::nft_collection::get_nft_by_token_id' \
  --args address:COLLECTION_ADDRESS u64:3 \
  --profile creator
# Returns: NFT_ADDRESS

movement move view --function-id 'YOUR_ADDRESS::nft_collection::token_uri' \
  --args object:NFT_ADDRESS \
  --profile creator
# Returns: "https://robohash.org/user3"

# Step 5: User transfers NFT to another user
movement move run --function-id 'YOUR_ADDRESS::nft_collection::transfer' \
  --args object:NFT_ADDRESS address:0x456...def \
  --profile user

# Step 6: New owner burns the NFT
movement move run --function-id 'YOUR_ADDRESS::nft_collection::burn' \
  --args object:NFT_ADDRESS \
  --profile new_owner
```

## Testing

Run NFT collection tests:

```bash
# Run all NFT collection tests
movement move test --filter nft_collection_test

# Run with verbose output
movement move test --filter nft_collection_test -v
```

## Security Considerations

1. **Creator-Only Minting**: Only the address that created the collection can mint NFTs
2. **Ownership Verification**: Transfer and burn operations verify the caller owns the NFT
3. **Supply Cap**: Hard-coded 10,000 token limit prevents infinite minting
4. **Deterministic Addresses**: Collection addresses are predictable via `create_named_object`
5. **Burn Permanence**: Burned tokens are permanently removed from tracking

## Design Decisions

| Decision                   | Rationale                                                  |
| -------------------------- | ---------------------------------------------------------- |
| Fixed collection name      | Simplifies deployment, one collection per creator          |
| Sequential token IDs       | Predictable, easy to enumerate                             |
| Off-chain metadata via URI | Gas efficient, flexible metadata updates                   |
| Ungated transfers          | Maximum composability with marketplace and other protocols |
| SmartTable for tokens      | Efficient O(1) lookup by token_id                          |

## Future Enhancements

Potential features for future development:

- **Whitelist minting**: Allow specific addresses to mint
- **Public minting phases**: Time-based public mint windows
- **On-chain attributes**: Store traits/properties on-chain
- **Reveal mechanism**: Hidden metadata until reveal event
- **Royalty support**: Creator royalties on secondary sales
- **Batch transfers**: Transfer multiple NFTs in one transaction
