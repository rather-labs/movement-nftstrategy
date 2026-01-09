/// NFT Marketplace Module
/// A simple marketplace for listing and buying NFTs using native MOVE coin.
/// Features:
/// - Fixed-price listings (no auctions)
/// - Native MOVE (AptosCoin) payments
/// - Configurable marketplace fees (updatable by admin)
/// - Escrow mechanism for secure trades
module nft_strategy_addr::marketplace {
    use std::signer;
    use aptos_std::smart_table::{Self, SmartTable};
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::coin;
    use aptos_framework::fungible_asset::{Self, FungibleAsset};
    use aptos_framework::primary_fungible_store;
    use aptos_framework::object::{Self, Object, ExtendRef};
    use aptos_framework::event;

    use nft_strategy_addr::errors;

    // ============ Constants ============

    /// Maximum fee in basis points (10% = 1000 bps)
    const MAX_FEE_BPS: u64 = 1000;

    /// Basis points denominator (100% = 10000 bps)
    const BPS_DENOMINATOR: u64 = 10000;

    // ============ Data Structures ============

    /// Main marketplace resource stored at module address
    struct Marketplace has key {
        /// Mapping from NFT address to listing info
        listings: SmartTable<address, Listing>,
        /// Marketplace fee in basis points (e.g., 250 = 2.5%)
        fee_bps: u64,
        /// Address that receives marketplace fees
        fee_recipient: address,
        /// Admin address that can update fee settings
        admin: address,
        /// Total number of successful sales
        total_sales: u64
    }

    /// Individual listing information
    struct Listing has store, drop, copy {
        /// Address of the seller
        seller: address,
        /// Address of the NFT object
        nft_address: address,
        /// Price in MOVE (with 8 decimals)
        price: u64
    }

    #[resource_group_member(group = aptos_framework::object::ObjectGroup)]
    struct EscrowInfo has key {
        /// ExtendRef to generate signer for transfers
        extend_ref: ExtendRef,
        /// Original owner (seller) of the NFT
        original_owner: address
    }

    // ============ Events ============
    #[event]
    struct ListingCreated has drop, store {
        nft_address: address,
        seller: address,
        price: u64
    }

    #[event]
    struct ListingSold has drop, store {
        nft_address: address,
        seller: address,
        buyer: address,
        price: u64,
        fee_amount: u64
    }

    #[event]
    struct ListingCanceled has drop, store {
        nft_address: address,
        seller: address
    }

    #[event]
    struct PriceUpdated has drop, store {
        nft_address: address,
        seller: address,
        old_price: u64,
        new_price: u64
    }

    #[event]
    struct FeeUpdated has drop, store {
        old_fee_bps: u64,
        new_fee_bps: u64,
        updated_by: address
    }

    #[event]
    struct FeeRecipientUpdated has drop, store {
        old_recipient: address,
        new_recipient: address,
        updated_by: address
    }

    // Escrow resource attached to escrowed NFT objects.
    // Stores the ExtendRef to allow marketplace to transfer NFT.

    // ============ Initialization ============

    /// Initialize the marketplace with admin, fee settings
    /// Can only be called once
    public entry fun initialize(
        admin: &signer, fee_bps: u64, fee_recipient: address
    ) {
        let admin_addr = signer::address_of(admin);

        // Ensure marketplace is not already initialized
        assert!(
            !exists<Marketplace>(@nft_strategy_addr),
            errors::marketplace_already_initialized()
        );

        // Validate fee
        assert!(fee_bps <= MAX_FEE_BPS, errors::invalid_fee_percentage());

        // Validate fee recipient
        assert!(fee_recipient != @0x0, errors::invalid_fee_recipient());

        // Create marketplace resource at module address
        move_to(
            admin,
            Marketplace {
                listings: smart_table::new(),
                fee_bps,
                fee_recipient,
                admin: admin_addr,
                total_sales: 0
            }
        );
    }

    // ============ Admin Functions ============

    /// Update marketplace fee (admin only)
    public entry fun set_fee_bps(admin: &signer, new_fee_bps: u64) acquires Marketplace {
        let admin_addr = signer::address_of(admin);

        assert!(
            exists<Marketplace>(@nft_strategy_addr),
            errors::marketplace_not_initialized()
        );

        let marketplace = borrow_global_mut<Marketplace>(@nft_strategy_addr);

        // Only admin can update fees
        assert!(admin_addr == marketplace.admin, errors::not_authorized());

        // Validate new fee
        assert!(new_fee_bps <= MAX_FEE_BPS, errors::invalid_fee_percentage());

        let old_fee_bps = marketplace.fee_bps;
        marketplace.fee_bps = new_fee_bps;

        event::emit(FeeUpdated { old_fee_bps, new_fee_bps, updated_by: admin_addr });
    }

    /// Update fee recipient address (admin only)
    public entry fun set_fee_recipient(
        admin: &signer, new_recipient: address
    ) acquires Marketplace {
        let admin_addr = signer::address_of(admin);

        assert!(
            exists<Marketplace>(@nft_strategy_addr),
            errors::marketplace_not_initialized()
        );

        let marketplace = borrow_global_mut<Marketplace>(@nft_strategy_addr);

        // Only admin can update fee recipient
        assert!(admin_addr == marketplace.admin, errors::not_authorized());

        // Validate new recipient
        assert!(new_recipient != @0x0, errors::invalid_fee_recipient());

        let old_recipient = marketplace.fee_recipient;
        marketplace.fee_recipient = new_recipient;

        event::emit(
            FeeRecipientUpdated {
                old_recipient,
                new_recipient,
                updated_by: admin_addr
            }
        );
    }

    /// Transfer admin role to new address (admin only)
    public entry fun set_admin(admin: &signer, new_admin: address) acquires Marketplace {
        let admin_addr = signer::address_of(admin);

        assert!(
            exists<Marketplace>(@nft_strategy_addr),
            errors::marketplace_not_initialized()
        );

        let marketplace = borrow_global_mut<Marketplace>(@nft_strategy_addr);

        // Only current admin can transfer admin role
        assert!(admin_addr == marketplace.admin, errors::not_authorized());

        // Validate new admin
        assert!(new_admin != @0x0, errors::not_authorized());

        marketplace.admin = new_admin;
    }

    // ============ Listing Functions ============

    /// List an NFT for sale
    /// Transfers the NFT to escrow and creates a listing
    public entry fun list_nft<T: key>(
        seller: &signer, nft: Object<T>, price: u64
    ) acquires Marketplace {
        let seller_addr = signer::address_of(seller);
        let nft_address = object::object_address(&nft);

        assert!(
            exists<Marketplace>(@nft_strategy_addr),
            errors::marketplace_not_initialized()
        );

        // Validate price
        assert!(price > 0, errors::invalid_price());

        // Verify seller owns the NFT
        assert!(object::is_owner(nft, seller_addr), errors::nft_not_owned());

        let marketplace = borrow_global_mut<Marketplace>(@nft_strategy_addr);

        // Check NFT is not already listed
        assert!(
            !smart_table::contains(&marketplace.listings, nft_address),
            errors::listing_already_exists()
        );

        // Create escrow object to hold the NFT
        let constructor_ref = object::create_object(seller_addr);
        let extend_ref = object::generate_extend_ref(&constructor_ref);
        let escrow_signer = object::generate_signer(&constructor_ref);
        let escrow_addr = signer::address_of(&escrow_signer);

        // Store escrow info on the escrow object
        move_to(&escrow_signer, EscrowInfo { extend_ref, original_owner: seller_addr });

        // Transfer NFT to escrow
        object::transfer(seller, nft, escrow_addr);

        // Create listing
        let listing = Listing { seller: seller_addr, nft_address, price };

        smart_table::add(&mut marketplace.listings, nft_address, listing);

        event::emit(ListingCreated { nft_address, seller: seller_addr, price });
    }

    /// Cancel a listing and return NFT to seller
    public entry fun cancel_listing<T: key>(
        seller: &signer, nft: Object<T>
    ) acquires Marketplace, EscrowInfo {
        let seller_addr = signer::address_of(seller);
        let nft_address = object::object_address(&nft);

        assert!(
            exists<Marketplace>(@nft_strategy_addr),
            errors::marketplace_not_initialized()
        );

        let marketplace = borrow_global_mut<Marketplace>(@nft_strategy_addr);

        // Check listing exists
        assert!(
            smart_table::contains(&marketplace.listings, nft_address),
            errors::listing_not_exists()
        );

        let listing = smart_table::borrow(&marketplace.listings, nft_address);

        // Only seller can cancel
        assert!(listing.seller == seller_addr, errors::not_seller());

        // Get current NFT owner (escrow address)
        let escrow_addr = object::owner(nft);

        // Get escrow info and transfer NFT back to seller
        let EscrowInfo { extend_ref, original_owner: _ } =
            move_from<EscrowInfo>(escrow_addr);
        let escrow_signer = object::generate_signer_for_extending(&extend_ref);
        object::transfer(&escrow_signer, nft, seller_addr);

        // Remove listing
        smart_table::remove(&mut marketplace.listings, nft_address);

        event::emit(ListingCanceled { nft_address, seller: seller_addr });
    }

    /// Update the price of an existing listing
    public entry fun update_price<T: key>(
        seller: &signer, nft: Object<T>, new_price: u64
    ) acquires Marketplace {
        let seller_addr = signer::address_of(seller);
        let nft_address = object::object_address(&nft);

        assert!(
            exists<Marketplace>(@nft_strategy_addr),
            errors::marketplace_not_initialized()
        );

        // Validate new price
        assert!(new_price > 0, errors::invalid_price());

        let marketplace = borrow_global_mut<Marketplace>(@nft_strategy_addr);

        // Check listing exists
        assert!(
            smart_table::contains(&marketplace.listings, nft_address),
            errors::listing_not_exists()
        );

        let listing = smart_table::borrow_mut(&mut marketplace.listings, nft_address);

        // Only seller can update price
        assert!(listing.seller == seller_addr, errors::not_seller());

        let old_price = listing.price;
        listing.price = new_price;

        event::emit(
            PriceUpdated {
                nft_address,
                seller: seller_addr,
                old_price,
                new_price
            }
        );
    }

    // ============ Purchase Functions ============

    /// Buy a listed NFT
    /// Transfers MOVE from buyer to seller (minus fee), NFT from escrow to buyer
    public entry fun buy_nft<T: key>(buyer: &signer, nft: Object<T>) acquires Marketplace, EscrowInfo {
        let buyer_addr = signer::address_of(buyer);
        let nft_address = object::object_address(&nft);

        assert!(
            exists<Marketplace>(@nft_strategy_addr),
            errors::marketplace_not_initialized()
        );

        let marketplace = borrow_global_mut<Marketplace>(@nft_strategy_addr);

        // Check listing exists
        assert!(
            smart_table::contains(&marketplace.listings, nft_address),
            errors::listing_not_exists()
        );

        let listing = smart_table::borrow(&marketplace.listings, nft_address);
        let seller_addr = listing.seller;
        let price = listing.price;

        // Seller cannot buy their own NFT
        assert!(buyer_addr != seller_addr, errors::seller_cannot_buy());

        // Calculate fee
        let fee_amount = (price * marketplace.fee_bps) / BPS_DENOMINATOR;

        // Withdraw payment from buyer
        let payment = coin::withdraw<AptosCoin>(buyer, price);

        // Split payment: fee to recipient, rest to seller
        if (fee_amount > 0) {
            let fee_coin = coin::extract(&mut payment, fee_amount);
            coin::deposit(marketplace.fee_recipient, fee_coin);
        };
        coin::deposit(seller_addr, payment);

        // Get current NFT owner (escrow address)
        let escrow_addr = object::owner(nft);

        // Transfer NFT from escrow to buyer
        let EscrowInfo { extend_ref, original_owner: _ } =
            move_from<EscrowInfo>(escrow_addr);
        let escrow_signer = object::generate_signer_for_extending(&extend_ref);
        object::transfer(&escrow_signer, nft, buyer_addr);

        // Remove listing and update stats
        smart_table::remove(&mut marketplace.listings, nft_address);
        marketplace.total_sales = marketplace.total_sales + 1;

        event::emit(
            ListingSold {
                nft_address,
                seller: seller_addr,
                buyer: buyer_addr,
                price,
                fee_amount
            }
        );
    }

    // ============ View Functions ============
    #[view]
    /// Get listing information for an NFT
    public fun get_listing(nft_address: address): (address, u64) acquires Marketplace {
        assert!(
            exists<Marketplace>(@nft_strategy_addr),
            errors::marketplace_not_initialized()
        );

        let marketplace = borrow_global<Marketplace>(@nft_strategy_addr);

        assert!(
            smart_table::contains(&marketplace.listings, nft_address),
            errors::listing_not_exists()
        );

        let listing = smart_table::borrow(&marketplace.listings, nft_address);
        (listing.seller, listing.price)
    }

    #[view]
    /// Check if an NFT is listed
    public fun is_listed(nft_address: address): bool acquires Marketplace {
        if (!exists<Marketplace>(@nft_strategy_addr)) {
            return false
        };

        let marketplace = borrow_global<Marketplace>(@nft_strategy_addr);
        smart_table::contains(&marketplace.listings, nft_address)
    }

    #[view]
    /// Get marketplace configuration
    public fun get_marketplace_info(): (u64, address, address, u64) acquires Marketplace {
        assert!(
            exists<Marketplace>(@nft_strategy_addr),
            errors::marketplace_not_initialized()
        );

        let marketplace = borrow_global<Marketplace>(@nft_strategy_addr);
        (
            marketplace.fee_bps,
            marketplace.fee_recipient,
            marketplace.admin,
            marketplace.total_sales
        )
    }

    #[view]
    /// Calculate fee for a given price
    public fun calculate_fee(price: u64): u64 acquires Marketplace {
        assert!(
            exists<Marketplace>(@nft_strategy_addr),
            errors::marketplace_not_initialized()
        );

        let marketplace = borrow_global<Marketplace>(@nft_strategy_addr);
        (price * marketplace.fee_bps) / BPS_DENOMINATOR
    }

    #[view]
    /// Check if marketplace is initialized
    public fun is_initialized(): bool {
        exists<Marketplace>(@nft_strategy_addr)
    }

    // ============ Public Functions for Module Interoperability ============

    /// Buy a listed NFT (non-entry version for module calls)
    /// Transfers MOVE from buyer to seller (minus fee), NFT from escrow to buyer
    public fun buy_nft_internal<T: key>(
        buyer: &signer, nft: Object<T>
    ) acquires Marketplace, EscrowInfo {
        let buyer_addr = signer::address_of(buyer);
        let nft_address = object::object_address(&nft);

        assert!(
            exists<Marketplace>(@nft_strategy_addr),
            errors::marketplace_not_initialized()
        );

        let marketplace = borrow_global_mut<Marketplace>(@nft_strategy_addr);

        // Check listing exists
        assert!(
            smart_table::contains(&marketplace.listings, nft_address),
            errors::listing_not_exists()
        );

        let listing = smart_table::borrow(&marketplace.listings, nft_address);
        let seller_addr = listing.seller;
        let price = listing.price;

        // Seller cannot buy their own NFT
        assert!(buyer_addr != seller_addr, errors::seller_cannot_buy());

        // Calculate fee
        let fee_amount = (price * marketplace.fee_bps) / BPS_DENOMINATOR;

        // Withdraw payment from buyer
        let payment = coin::withdraw<AptosCoin>(buyer, price);

        // Split payment: fee to recipient, rest to seller
        if (fee_amount > 0) {
            let fee_coin = coin::extract(&mut payment, fee_amount);
            coin::deposit(marketplace.fee_recipient, fee_coin);
        };
        coin::deposit(seller_addr, payment);

        // Get current NFT owner (escrow address)
        let escrow_addr = object::owner(nft);

        // Transfer NFT from escrow to buyer
        let EscrowInfo { extend_ref, original_owner: _ } =
            move_from<EscrowInfo>(escrow_addr);
        let escrow_signer = object::generate_signer_for_extending(&extend_ref);
        object::transfer(&escrow_signer, nft, buyer_addr);

        // Remove listing and update stats
        smart_table::remove(&mut marketplace.listings, nft_address);
        marketplace.total_sales = marketplace.total_sales + 1;

        event::emit(
            ListingSold {
                nft_address,
                seller: seller_addr,
                buyer: buyer_addr,
                price,
                fee_amount
            }
        );
    }

    /// List an NFT for sale (non-entry version for module calls)
    /// Transfers the NFT to escrow and creates a listing
    public fun list_nft_internal<T: key>(
        seller: &signer, nft: Object<T>, price: u64
    ) acquires Marketplace {
        let seller_addr = signer::address_of(seller);
        let nft_address = object::object_address(&nft);

        assert!(
            exists<Marketplace>(@nft_strategy_addr),
            errors::marketplace_not_initialized()
        );

        // Validate price
        assert!(price > 0, errors::invalid_price());

        // Verify seller owns the NFT
        assert!(object::is_owner(nft, seller_addr), errors::nft_not_owned());

        let marketplace = borrow_global_mut<Marketplace>(@nft_strategy_addr);

        // Check NFT is not already listed
        assert!(
            !smart_table::contains(&marketplace.listings, nft_address),
            errors::listing_already_exists()
        );

        // Create escrow object to hold the NFT
        let constructor_ref = object::create_object(seller_addr);
        let extend_ref = object::generate_extend_ref(&constructor_ref);
        let escrow_signer = object::generate_signer(&constructor_ref);
        let escrow_addr = signer::address_of(&escrow_signer);

        // Store escrow info on the escrow object
        move_to(&escrow_signer, EscrowInfo { extend_ref, original_owner: seller_addr });

        // Transfer NFT to escrow
        object::transfer(seller, nft, escrow_addr);

        // Create listing
        let listing = Listing { seller: seller_addr, nft_address, price };

        smart_table::add(&mut marketplace.listings, nft_address, listing);

        event::emit(ListingCreated { nft_address, seller: seller_addr, price });
    }

    /// Buy a listed NFT with FungibleAsset payment (for module-to-module calls)
    /// Used by strategy module to buy NFTs on behalf of treasury
    /// The payment is provided as FungibleAsset and NFT is sent to buyer_addr
    public fun buy_nft_with_fa<T: key>(
        payment: FungibleAsset, nft: Object<T>, buyer_addr: address
    ) acquires Marketplace, EscrowInfo {
        let nft_address = object::object_address(&nft);

        assert!(
            exists<Marketplace>(@nft_strategy_addr),
            errors::marketplace_not_initialized()
        );

        let marketplace = borrow_global_mut<Marketplace>(@nft_strategy_addr);

        // Check listing exists
        assert!(
            smart_table::contains(&marketplace.listings, nft_address),
            errors::listing_not_exists()
        );

        let listing = smart_table::borrow(&marketplace.listings, nft_address);
        let seller_addr = listing.seller;
        let price = listing.price;

        // Buyer cannot be the seller
        assert!(buyer_addr != seller_addr, errors::seller_cannot_buy());

        // Verify payment amount matches price
        let payment_amount = fungible_asset::amount(&payment);
        assert!(payment_amount >= price, errors::insufficient_payment());

        // Calculate fee
        let fee_amount = (price * marketplace.fee_bps) / BPS_DENOMINATOR;

        // Split payment: fee to recipient, rest to seller
        if (fee_amount > 0) {
            let fee_fa = fungible_asset::extract(&mut payment, fee_amount);
            primary_fungible_store::deposit(marketplace.fee_recipient, fee_fa);
        };

        // Send remaining payment to seller
        let seller_payment = fungible_asset::extract(&mut payment, price - fee_amount);
        primary_fungible_store::deposit(seller_addr, seller_payment);

        // If there's any excess, return to buyer
        if (fungible_asset::amount(&payment) > 0) {
            primary_fungible_store::deposit(buyer_addr, payment);
        } else {
            fungible_asset::destroy_zero(payment);
        };

        // Get current NFT owner (escrow address)
        let escrow_addr = object::owner(nft);

        // Transfer NFT from escrow to buyer
        let EscrowInfo { extend_ref, original_owner: _ } =
            move_from<EscrowInfo>(escrow_addr);
        let escrow_signer = object::generate_signer_for_extending(&extend_ref);
        object::transfer(&escrow_signer, nft, buyer_addr);

        // Remove listing and update stats
        smart_table::remove(&mut marketplace.listings, nft_address);
        marketplace.total_sales = marketplace.total_sales + 1;

        event::emit(
            ListingSold {
                nft_address,
                seller: seller_addr,
                buyer: buyer_addr,
                price,
                fee_amount
            }
        );
    }
}

