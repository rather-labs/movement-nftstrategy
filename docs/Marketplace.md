# NFT Marketplace

A simple, production-ready NFT marketplace module for Movement blockchain. Supports fixed-price listings with native MOVE coin payments and configurable marketplace fees.

## Overview

The marketplace enables users to:

- **List NFTs** for sale at a fixed price
- **Buy NFTs** using native MOVE coin
- **Cancel listings** and retrieve NFTs
- **Update prices** on active listings

Administrators can configure marketplace fees (up to 10%) that are automatically deducted from sales.

## Architecture

### Data Structures

```move
/// Main marketplace resource stored at module address
struct Marketplace has key {
    listings: SmartTable<address, Listing>,  // NFT address → Listing
    fee_bps: u64,                            // Fee in basis points (250 = 2.5%)
    fee_recipient: address,                  // Address receiving fees
    admin: address,                          // Admin address
    total_sales: u64                         // Total successful sales count
}

/// Individual listing information
struct Listing has store, drop, copy {
    seller: address,
    nft_address: address,
    price: u64           // Price in MOVE (8 decimals)
}
```

### Escrow Mechanism

When an NFT is listed, it's transferred to an escrow object. The `EscrowInfo` resource stores an `ExtendRef` that allows the marketplace to transfer the NFT to a buyer or back to the seller on cancellation.

```move
#[resource_group_member(group = aptos_framework::object::ObjectGroup)]
struct EscrowInfo has key {
    extend_ref: ExtendRef,
    original_owner: address
}
```

## Entry Functions

### Initialization

```bash
# Initialize marketplace with 2.5% fee
movement move run --function-id 'YOUR_ADDRESS::marketplace::initialize' \
  --args address:ADMIN_ADDRESS u64:250 address:FEE_RECIPIENT \
  --profile YOUR_PROFILE
```

| Parameter       | Type      | Description                              |
| --------------- | --------- | ---------------------------------------- |
| `admin`         | `&signer` | Admin signer (becomes marketplace admin) |
| `fee_bps`       | `u64`     | Fee in basis points (max 1000 = 10%)     |
| `fee_recipient` | `address` | Address to receive marketplace fees      |

### Listing NFTs

```bash
# List an NFT for 100 MOVE
movement move run --function-id 'YOUR_ADDRESS::marketplace::list_nft' \
  --type-args 'YOUR_ADDRESS::nft::NFT' \
  --args object:NFT_OBJECT_ADDRESS u64:10000000000 \
  --profile YOUR_PROFILE
```

| Parameter | Type        | Description                |
| --------- | ----------- | -------------------------- |
| `seller`  | `&signer`   | NFT owner                  |
| `nft`     | `Object<T>` | NFT object to list         |
| `price`   | `u64`       | Price in MOVE (8 decimals) |

### Buying NFTs

```bash
# Buy a listed NFT
movement move run --function-id 'YOUR_ADDRESS::marketplace::buy_nft' \
  --type-args 'YOUR_ADDRESS::nft::NFT' \
  --args object:NFT_OBJECT_ADDRESS \
  --profile YOUR_PROFILE
```

| Parameter | Type        | Description                               |
| --------- | ----------- | ----------------------------------------- |
| `buyer`   | `&signer`   | Buyer (must have sufficient MOVE balance) |
| `nft`     | `Object<T>` | NFT object to purchase                    |

**Payment Flow:**

1. Buyer's MOVE is withdrawn
2. Fee amount sent to `fee_recipient`
3. Remaining amount sent to seller
4. NFT transferred from escrow to buyer

### Canceling Listings

```bash
# Cancel a listing and retrieve NFT
movement move run --function-id 'YOUR_ADDRESS::marketplace::cancel_listing' \
  --type-args 'YOUR_ADDRESS::nft::NFT' \
  --args object:NFT_OBJECT_ADDRESS \
  --profile YOUR_PROFILE
```

### Updating Price

```bash
# Update listing price to 150 MOVE
movement move run --function-id 'YOUR_ADDRESS::marketplace::update_price' \
  --type-args 'YOUR_ADDRESS::nft::NFT' \
  --args object:NFT_OBJECT_ADDRESS u64:15000000000 \
  --profile YOUR_PROFILE
```

## Admin Functions

### Update Fee

```bash
# Set fee to 5% (500 basis points)
movement move run --function-id 'YOUR_ADDRESS::marketplace::set_fee_bps' \
  --args u64:500 \
  --profile YOUR_PROFILE
```

### Update Fee Recipient

```bash
movement move run --function-id 'YOUR_ADDRESS::marketplace::set_fee_recipient' \
  --args address:NEW_RECIPIENT \
  --profile YOUR_PROFILE
```

### Transfer Admin

```bash
movement move run --function-id 'YOUR_ADDRESS::marketplace::set_admin' \
  --args address:NEW_ADMIN \
  --profile YOUR_PROFILE
```

## View Functions

### Get Listing

```bash
movement move view --function-id 'YOUR_ADDRESS::marketplace::get_listing' \
  --args address:NFT_ADDRESS \
  --profile YOUR_PROFILE
```

Returns: `(seller: address, price: u64)`

### Check if Listed

```bash
movement move view --function-id 'YOUR_ADDRESS::marketplace::is_listed' \
  --args address:NFT_ADDRESS \
  --profile YOUR_PROFILE
```

Returns: `bool`

### Get Marketplace Info

```bash
movement move view --function-id 'YOUR_ADDRESS::marketplace::get_marketplace_info' \
  --profile YOUR_PROFILE
```

Returns: `(fee_bps: u64, fee_recipient: address, admin: address, total_sales: u64)`

### Calculate Fee

```bash
movement move view --function-id 'YOUR_ADDRESS::marketplace::calculate_fee' \
  --args u64:10000000000 \
  --profile YOUR_PROFILE
```

Returns: `u64` (fee amount for given price)

### Check Initialization

```bash
movement move view --function-id 'YOUR_ADDRESS::marketplace::is_initialized' \
  --profile YOUR_PROFILE
```

Returns: `bool`

## Events

All marketplace actions emit events for off-chain indexing:

| Event                 | Fields                                                  | Description               |
| --------------------- | ------------------------------------------------------- | ------------------------- |
| `ListingCreated`      | `nft_address`, `seller`, `price`                        | NFT listed for sale       |
| `ListingSold`         | `nft_address`, `seller`, `buyer`, `price`, `fee_amount` | NFT purchased             |
| `ListingCanceled`     | `nft_address`, `seller`                                 | Listing canceled          |
| `PriceUpdated`        | `nft_address`, `seller`, `old_price`, `new_price`       | Price changed             |
| `FeeUpdated`          | `old_fee_bps`, `new_fee_bps`, `updated_by`              | Fee configuration changed |
| `FeeRecipientUpdated` | `old_recipient`, `new_recipient`, `updated_by`          | Fee recipient changed     |

## Error Codes

| Code | Constant                           | Description                         |
| ---- | ---------------------------------- | ----------------------------------- |
| 24   | `ELISTING_NOT_EXISTS`              | Listing not found for NFT           |
| 25   | `ELISTING_ALREADY_EXISTS`          | NFT is already listed               |
| 26   | `EINVALID_PRICE`                   | Price must be greater than 0        |
| 27   | `ENFT_NOT_OWNED`                   | Caller does not own the NFT         |
| 28   | `ENOT_SELLER`                      | Only seller can perform this action |
| 29   | `ESELLER_CANNOT_BUY`               | Seller cannot buy their own NFT     |
| 30   | `EMARKETPLACE_NOT_INITIALIZED`     | Marketplace not initialized         |
| 31   | `EMARKETPLACE_ALREADY_INITIALIZED` | Marketplace already initialized     |
| 18   | `ENOT_AUTHORIZED`                  | Caller is not admin                 |
| 22   | `EINVALID_FEE_PERCENTAGE`          | Fee exceeds maximum (10%)           |
| 23   | `EINVALID_FEE_RECIPIENT`           | Invalid fee recipient address       |

## Token Amounts

All MOVE amounts use 8 decimal places:

| Human Readable | Raw Value      |
| -------------- | -------------- |
| 0.01 MOVE      | `1000000`      |
| 0.1 MOVE       | `10000000`     |
| 1 MOVE         | `100000000`    |
| 10 MOVE        | `1000000000`   |
| 100 MOVE       | `10000000000`  |
| 1000 MOVE      | `100000000000` |

## Fee Calculation

Fees are calculated in basis points (1 bps = 0.01%):

| Fee BPS | Percentage | Fee on 100 MOVE |
| ------- | ---------- | --------------- |
| 100     | 1.0%       | 1 MOVE          |
| 250     | 2.5%       | 2.5 MOVE        |
| 500     | 5.0%       | 5 MOVE          |
| 1000    | 10.0%      | 10 MOVE         |

Formula: `fee_amount = (price * fee_bps) / 10000`

## Security Considerations

1. **Escrow Protection**: NFTs are held in escrow during listing, preventing double-spending
2. **Ownership Verification**: Only NFT owners can list, only sellers can cancel/update
3. **Fee Limits**: Maximum fee capped at 10% to prevent abuse
4. **Admin Controls**: Fee changes require admin authorization
5. **Self-Purchase Prevention**: Sellers cannot buy their own NFTs

## Integration Example

```move
module example::nft_sale {
    use aptos_framework::object::{Self, Object};
    use nft_strategy_addr::marketplace;
    use example::my_nft::MyNFT;

    /// List an NFT for sale
    public entry fun sell_nft(
        seller: &signer,
        nft: Object<MyNFT>,
        price: u64
    ) {
        marketplace::list_nft(seller, nft, price);
    }

    /// Buy an NFT
    public entry fun purchase_nft(
        buyer: &signer,
        nft: Object<MyNFT>
    ) {
        marketplace::buy_nft(buyer, nft);
    }
}
```

## Testing

Run marketplace tests:

```bash
# Run all marketplace tests
movement move test --filter marketplace_test

# Run with verbose output
movement move test --filter marketplace_test -v
```

## Future Enhancements

Potential features for future development:

- **Auction Support**: Time-based bidding system
- **Offer System**: Allow buyers to make offers below listing price
- **Collection Offers**: Bid on any NFT from a collection
- **Royalty Enforcement**: Creator royalties on secondary sales
- **Bulk Operations**: List/delist multiple NFTs in one transaction
- **Price History**: On-chain price tracking for analytics
