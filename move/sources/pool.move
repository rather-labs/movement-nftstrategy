module nft_strategy_addr::pool {
    use std::signer;
    use std::vector;
    use aptos_framework::fungible_asset::{Self, FungibleAsset, Metadata};
    use aptos_framework::object::{Self, Object};
    use aptos_framework::primary_fungible_store;
    use aptos_framework::timestamp;
    use aptos_framework::account;
    use aptos_framework::event::{Self, EventHandle};
    use aptos_std::type_info;
    use nft_strategy_addr::errors;
    use nft_strategy_addr::math;
    use nft_strategy_addr::lp_token;
    use nft_strategy_addr::vault;

    struct Pool<phantom X, phantom Y> has key {
        reserve_x: u64,
        reserve_y: u64,
        last_block_timestamp: u64,
        k_last: u128,
        // Store vault account addresses instead of assets directly
        vault_addr: address,
        // Fee configuration
        fee_recipient: address,
        fee_bps: u64 // Fee in basis points (e.g., 30 = 0.3%)
    }

    struct PoolEvents<phantom X, phantom Y> has key {
        mint_events: EventHandle<MintEvent>,
        burn_events: EventHandle<BurnEvent>,
        swap_events: EventHandle<SwapEvent>,
        sync_events: EventHandle<SyncEvent>,
        fee_collected_events: EventHandle<FeeCollectedEvent>
    }

    struct MintEvent has drop, store {
        sender: address,
        amount_x: u64,
        amount_y: u64
    }

    struct BurnEvent has drop, store {
        sender: address,
        amount_x: u64,
        amount_y: u64,
        to: address
    }

    struct SwapEvent has drop, store {
        sender: address,
        amount_x_in: u64,
        amount_y_in: u64,
        amount_x_out: u64,
        amount_y_out: u64,
        to: address
    }

    struct SyncEvent has drop, store {
        reserve_x: u64,
        reserve_y: u64
    }

    struct FeeCollectedEvent has drop, store {
        token_type: u8, // 0 = X, 1 = Y
        fee_amount: u64,
        fee_recipient: address
    }

    // Fee constants
    const MAX_FEE_BPS: u64 = 1000; // Maximum 10% fee
    const ZERO_ADDRESS: address = @0x0;

    public fun create_pool<X, Y>(
        account: &signer, fee_recipient: address, fee_bps: u64
    ) {
        let account_addr = signer::address_of(account);

        assert!(
            !exists<Pool<X, Y>>(account_addr),
            errors::pool_already_exists()
        );
        assert!(
            !is_same_coin<X, Y>(),
            errors::identical_addresses()
        );
        // Validate fee parameters
        assert!(fee_bps <= MAX_FEE_BPS, errors::invalid_fee_percentage());
        // If fee_bps > 0, fee_recipient must be non-zero
        assert!(
            fee_bps == 0 || fee_recipient != ZERO_ADDRESS,
            errors::invalid_fee_recipient()
        );

        lp_token::initialize<X, Y>(account);

        // Create a dedicated vault for this pool
        let (_vault_signer, vault_addr) = vault::create_vault(account);

        move_to(
            account,
            Pool<X, Y> {
                reserve_x: 0,
                reserve_y: 0,
                last_block_timestamp: timestamp::now_seconds(),
                k_last: 0,
                vault_addr,
                fee_recipient,
                fee_bps
            }
        );

        move_to(
            account,
            PoolEvents<X, Y> {
                mint_events: account::new_event_handle<MintEvent>(account),
                burn_events: account::new_event_handle<BurnEvent>(account),
                swap_events: account::new_event_handle<SwapEvent>(account),
                sync_events: account::new_event_handle<SyncEvent>(account),
                fee_collected_events: account::new_event_handle<FeeCollectedEvent>(account)
            }
        );
    }

    public fun add_liquidity<X, Y>(
        account: &signer, asset_x: FungibleAsset, asset_y: FungibleAsset
    ): FungibleAsset acquires Pool, PoolEvents {
        let pool_addr = get_pool_address<X, Y>();
        assert!(
            exists<Pool<X, Y>>(pool_addr),
            errors::pool_not_exists()
        );

        let amount_x = fungible_asset::amount(&asset_x);
        let amount_y = fungible_asset::amount(&asset_y);
        assert!(amount_x > 0, errors::zero_amount());
        assert!(amount_y > 0, errors::zero_amount());

        let pool = borrow_global_mut<Pool<X, Y>>(pool_addr);
        let pool_events = borrow_global_mut<PoolEvents<X, Y>>(pool_addr);

        // Store the assets in the pool's dedicated vault
        vault::deposit(pool.vault_addr, asset_x);
        vault::deposit(pool.vault_addr, asset_y);

        let liquidity =
            if (lp_token::supply<X, Y>() == 0) {
                let liquidity_val =
                    (math::sqrt(((amount_x as u128) * (amount_y as u128))) as u128)
                        - (math::minimum_liquidity() as u128);
                assert!(liquidity_val > 0, errors::insufficient_liquidity_minted());

                let min_liquidity_tokens =
                    lp_token::mint<X, Y>(account, math::minimum_liquidity());
                lp_token::burn<X, Y>(account, min_liquidity_tokens);

                (liquidity_val as u64)
            } else {
                let total_supply = lp_token::supply<X, Y>();
                let liquidity_x =
                    math::safe_mul_div(amount_x, (total_supply as u64), pool.reserve_x);
                let liquidity_y =
                    math::safe_mul_div(amount_y, (total_supply as u64), pool.reserve_y);
                math::min(liquidity_x, liquidity_y)
            };

        assert!(liquidity > 0, errors::insufficient_liquidity_minted());

        let new_reserve_x = pool.reserve_x + amount_x;
        let new_reserve_y = pool.reserve_y + amount_y;
        update_reserves(pool, new_reserve_x, new_reserve_y);

        event::emit_event(
            &mut pool_events.mint_events,
            MintEvent {
                sender: signer::address_of(account),
                amount_x,
                amount_y
            }
        );

        lp_token::mint_fa<X, Y>(account, liquidity)
    }

    public fun remove_liquidity<X, Y>(
        account: &signer, lp_tokens: FungibleAsset, to: address
    ): (FungibleAsset, FungibleAsset) acquires Pool, PoolEvents {
        let pool_addr = get_pool_address<X, Y>();
        assert!(
            exists<Pool<X, Y>>(pool_addr),
            errors::pool_not_exists()
        );

        let liquidity = fungible_asset::amount(&lp_tokens);
        assert!(liquidity > 0, errors::zero_amount());

        let pool = borrow_global_mut<Pool<X, Y>>(pool_addr);
        let pool_events = borrow_global_mut<PoolEvents<X, Y>>(pool_addr);

        let total_supply = lp_token::supply<X, Y>();
        let amount_x = math::safe_mul_div(
            liquidity, pool.reserve_x, (total_supply as u64)
        );
        let amount_y = math::safe_mul_div(
            liquidity, pool.reserve_y, (total_supply as u64)
        );

        assert!(
            amount_x > 0 && amount_y > 0, errors::insufficient_liquidity_burned()
        );

        lp_token::burn_fa<X, Y>(account, lp_tokens);

        // Withdraw assets from the pool's dedicated vault
        let metadata_x = get_token_metadata<X>();
        let metadata_y = get_token_metadata<Y>();

        let asset_x_out = vault::withdraw(pool.vault_addr, metadata_x, amount_x);
        let asset_y_out = vault::withdraw(pool.vault_addr, metadata_y, amount_y);

        let new_reserve_x = pool.reserve_x - amount_x;
        let new_reserve_y = pool.reserve_y - amount_y;
        update_reserves(pool, new_reserve_x, new_reserve_y);

        event::emit_event(
            &mut pool_events.burn_events,
            BurnEvent {
                sender: signer::address_of(account),
                amount_x,
                amount_y,
                to
            }
        );

        (asset_x_out, asset_y_out)
    }

    public fun swap_x_to_y<X, Y>(
        account: &signer,
        asset_x: FungibleAsset,
        min_amount_out: u64,
        to: address
    ): FungibleAsset acquires Pool, PoolEvents {
        let pool_addr = get_pool_address<X, Y>();
        assert!(
            exists<Pool<X, Y>>(pool_addr),
            errors::pool_not_exists()
        );

        let total_amount_x_in = fungible_asset::amount(&asset_x);
        assert!(total_amount_x_in > 0, errors::zero_amount());

        let pool = borrow_global_mut<Pool<X, Y>>(pool_addr);

        // Calculate protocol fee from input amount
        let fee_amount = calculate_fee(total_amount_x_in, pool.fee_bps);
        let amount_x_in = total_amount_x_in - fee_amount;

        let amount_y_out =
            math::get_amount_out(amount_x_in, pool.reserve_x, pool.reserve_y);
        assert!(amount_y_out >= min_amount_out, errors::insufficient_output_amount());

        // Store input asset in vault
        vault::deposit(pool.vault_addr, asset_x);

        // Withdraw and send fee to fee recipient if applicable
        let fee_recipient = pool.fee_recipient;
        if (fee_amount > 0 && fee_recipient != ZERO_ADDRESS) {
            let metadata_x = get_token_metadata<X>();
            let fee_asset = vault::withdraw(pool.vault_addr, metadata_x, fee_amount);
            primary_fungible_store::deposit(fee_recipient, fee_asset);
        };

        let metadata_y = get_token_metadata<Y>();
        let asset_y_out = vault::withdraw(pool.vault_addr, metadata_y, amount_y_out);

        let new_reserve_x = pool.reserve_x + amount_x_in;
        let new_reserve_y = pool.reserve_y - amount_y_out;
        update_reserves(pool, new_reserve_x, new_reserve_y);

        let pool_events = borrow_global_mut<PoolEvents<X, Y>>(pool_addr);
        event::emit_event(
            &mut pool_events.swap_events,
            SwapEvent {
                sender: signer::address_of(account),
                amount_x_in,
                amount_y_in: 0,
                amount_x_out: 0,
                amount_y_out,
                to
            }
        );

        // Emit fee collected event if fee was taken
        if (fee_amount > 0 && fee_recipient != ZERO_ADDRESS) {
            event::emit_event(
                &mut pool_events.fee_collected_events,
                FeeCollectedEvent {
                    token_type: 0, // X token
                    fee_amount,
                    fee_recipient
                }
            );
        };

        asset_y_out
    }

    public fun swap_y_to_x<X, Y>(
        account: &signer,
        asset_y: FungibleAsset,
        min_amount_out: u64,
        to: address
    ): FungibleAsset acquires Pool, PoolEvents {
        let pool_addr = get_pool_address<X, Y>();
        assert!(
            exists<Pool<X, Y>>(pool_addr),
            errors::pool_not_exists()
        );

        let total_amount_y_in = fungible_asset::amount(&asset_y);
        assert!(total_amount_y_in > 0, errors::zero_amount());

        let pool = borrow_global_mut<Pool<X, Y>>(pool_addr);

        // Calculate protocol fee from input amount
        let fee_amount = calculate_fee(total_amount_y_in, pool.fee_bps);
        let amount_y_in = total_amount_y_in - fee_amount;

        let amount_x_out =
            math::get_amount_out(amount_y_in, pool.reserve_y, pool.reserve_x);
        assert!(amount_x_out >= min_amount_out, errors::insufficient_output_amount());

        // Store input asset in vault
        vault::deposit(pool.vault_addr, asset_y);

        // Withdraw and send fee to fee recipient if applicable
        let fee_recipient = pool.fee_recipient;
        if (fee_amount > 0 && fee_recipient != ZERO_ADDRESS) {
            let metadata_y = get_token_metadata<Y>();
            let fee_asset = vault::withdraw(pool.vault_addr, metadata_y, fee_amount);
            primary_fungible_store::deposit(fee_recipient, fee_asset);
        };

        let metadata_x = get_token_metadata<X>();
        let asset_x_out = vault::withdraw(pool.vault_addr, metadata_x, amount_x_out);

        let new_reserve_x = pool.reserve_x - amount_x_out;
        let new_reserve_y = pool.reserve_y + amount_y_in;
        update_reserves(pool, new_reserve_x, new_reserve_y);

        let pool_events = borrow_global_mut<PoolEvents<X, Y>>(pool_addr);
        event::emit_event(
            &mut pool_events.swap_events,
            SwapEvent {
                sender: signer::address_of(account),
                amount_x_in: 0,
                amount_y_in,
                amount_x_out,
                amount_y_out: 0,
                to
            }
        );

        // Emit fee collected event if fee was taken
        if (fee_amount > 0 && fee_recipient != ZERO_ADDRESS) {
            event::emit_event(
                &mut pool_events.fee_collected_events,
                FeeCollectedEvent {
                    token_type: 1, // Y token
                    fee_amount,
                    fee_recipient
                }
            );
        };

        asset_x_out
    }

    #[view]
    public fun get_reserves<X, Y>(): (u64, u64, u64) acquires Pool {
        let pool_addr = get_pool_address<X, Y>();
        if (!exists<Pool<X, Y>>(pool_addr)) {
            return (0, 0, 0)
        };

        let pool = borrow_global<Pool<X, Y>>(pool_addr);
        (pool.reserve_x, pool.reserve_y, pool.last_block_timestamp)
    }

    #[view]
    public fun get_fee_info<X, Y>(): (address, u64) acquires Pool {
        let pool_addr = get_pool_address<X, Y>();
        if (!exists<Pool<X, Y>>(pool_addr)) {
            return (ZERO_ADDRESS, 0)
        };

        let pool = borrow_global<Pool<X, Y>>(pool_addr);
        (pool.fee_recipient, pool.fee_bps)
    }

    /// Calculate fee amount from input amount
    /// fee_bps: fee in basis points (100 bps = 1%)
    fun calculate_fee(amount: u64, fee_bps: u64): u64 {
        if (fee_bps == 0) { 0 }
        else {
            // fee = amount * fee_bps / 10000
            math::safe_mul_div(amount, fee_bps, 10000)
        }
    }

    fun update_reserves<X, Y>(
        pool: &mut Pool<X, Y>, reserve_x: u64, reserve_y: u64
    ) {
        pool.reserve_x = reserve_x;
        pool.reserve_y = reserve_y;
        pool.last_block_timestamp = timestamp::now_seconds();
        pool.k_last = (reserve_x as u128) * (reserve_y as u128);
    }

    fun get_pool_address<X, Y>(): address {
        let x_type = type_info::type_of<X>();
        let y_type = type_info::type_of<Y>();

        if (is_ordered<X, Y>()) {
            type_info::account_address(&x_type)
        } else {
            type_info::account_address(&y_type)
        }
    }

    fun is_same_coin<X, Y>(): bool {
        let x_type_info = type_info::type_of<X>();
        let y_type_info = type_info::type_of<Y>();
        x_type_info == y_type_info
    }

    fun get_token_metadata<T>(): Object<Metadata> {
        // Get metadata from the token's module based on type name
        let type_name = type_info::struct_name(&type_info::type_of<T>());
        if (type_name == b"WMOVE") {
            // WMOVE (Wrapped MOVE) Integration:
            // ─────────────────────────────────
            // WMOVE is a fungible asset that wraps the native MOVE coin 1:1.
            // When a user calls pool functions with type parameter `WMOVE`, we need to
            // resolve it to the correct FA metadata object.
            //
            // The WMOVE module creates its metadata object at a deterministic address
            // derived from: sha3_256(deployer_address || seed || 0xFE)
            // where seed = b"WMOVE" (set in wmove::init_module).
            //
            // This allows the pool to:
            // 1. Accept WMOVE as a valid token type (e.g., Pool<RatherToken, WMOVE>)
            // 2. Withdraw/deposit WMOVE via primary_fungible_store using this metadata
            // 3. Enable trading pairs like RatherToken/WMOVE (native MOVE exposure)
            //
            // Users must first wrap their native MOVE via wmove::wrap() before
            // adding liquidity or swapping. After trading, they can unwrap via
            // wmove::unwrap() to get native MOVE back.
            object::address_to_object<Metadata>(
                object::create_object_address(&@nft_strategy_addr, b"WMOVE")
            )
        } else if (type_name == b"RatherToken") {
            // Rather Token
            object::address_to_object<Metadata>(
                object::create_object_address(&@nft_strategy_addr, b"RatherToken")
            )
        } else {
            // For any other token type, try to use the type name as the object seed
            object::address_to_object<Metadata>(
                object::create_object_address(&@nft_strategy_addr, type_name)
            )
        }
    }

    fun is_ordered<X, Y>(): bool {
        let x_type_info = type_info::type_of<X>();
        let y_type_info = type_info::type_of<Y>();

        let x_struct_name = type_info::struct_name(&x_type_info);
        let y_struct_name = type_info::struct_name(&y_type_info);

        compare_vectors(&x_struct_name, &y_struct_name)
    }

    fun compare_vectors(v1: &vector<u8>, v2: &vector<u8>): bool {
        let len1 = vector::length(v1);
        let len2 = vector::length(v2);
        let min_len = if (len1 < len2) len1 else len2;

        let i = 0;
        while (i < min_len) {
            let byte1 = *vector::borrow(v1, i);
            let byte2 = *vector::borrow(v2, i);
            if (byte1 < byte2) {
                return true
            };
            if (byte1 > byte2) {
                return false
            };
            i = i + 1;
        };

        len1 < len2
    }

    public fun exists_pool<X, Y>(): bool {
        let pool_addr = get_pool_address<X, Y>();
        exists<Pool<X, Y>>(pool_addr)
    }

    // Entry functions
    public entry fun add_liquidity_entry<X, Y>(
        account: &signer, amount_x: u64, amount_y: u64
    ) acquires Pool, PoolEvents {
        let metadata_x = get_token_metadata<X>();
        let metadata_y = get_token_metadata<Y>();

        let asset_x = primary_fungible_store::withdraw(account, metadata_x, amount_x);
        let asset_y = primary_fungible_store::withdraw(account, metadata_y, amount_y);

        let lp_tokens = add_liquidity<X, Y>(account, asset_x, asset_y);

        primary_fungible_store::deposit(signer::address_of(account), lp_tokens);
    }

    public entry fun remove_liquidity_entry<X, Y>(
        account: &signer, lp_amount: u64
    ) acquires Pool, PoolEvents {
        let lp_metadata = lp_token::get_metadata<X, Y>();
        let lp_tokens = primary_fungible_store::withdraw(account, lp_metadata, lp_amount);

        let (asset_x, asset_y) =
            remove_liquidity<X, Y>(account, lp_tokens, signer::address_of(account));

        primary_fungible_store::deposit(signer::address_of(account), asset_x);
        primary_fungible_store::deposit(signer::address_of(account), asset_y);
    }

    public entry fun swap_x_to_y_entry<X, Y>(
        account: &signer, amount_x_in: u64, min_amount_y_out: u64
    ) acquires Pool, PoolEvents {
        let metadata_x = get_token_metadata<X>();
        let asset_x = primary_fungible_store::withdraw(account, metadata_x, amount_x_in);

        let asset_y =
            swap_x_to_y<X, Y>(
                account,
                asset_x,
                min_amount_y_out,
                signer::address_of(account)
            );

        primary_fungible_store::deposit(signer::address_of(account), asset_y);
    }

    public entry fun swap_y_to_x_entry<X, Y>(
        account: &signer, amount_y_in: u64, min_amount_x_out: u64
    ) acquires Pool, PoolEvents {
        let metadata_y = get_token_metadata<Y>();
        let asset_y = primary_fungible_store::withdraw(account, metadata_y, amount_y_in);

        let asset_x =
            swap_y_to_x<X, Y>(
                account,
                asset_y,
                min_amount_x_out,
                signer::address_of(account)
            );

        primary_fungible_store::deposit(signer::address_of(account), asset_x);
    }

    #[test_only]
    struct TestCoinX has key {}

    #[test_only]
    struct TestCoinY has key {}

    #[test(account = @0xbeef)]
    fun test_create_pool(account: &signer) acquires Pool {
        let account_addr = signer::address_of(account);
        account::create_account_for_test(account_addr);
        timestamp::set_time_has_started_for_testing(&account::create_signer_for_test(@0x1));

        // Create pool with 0.5% fee (50 bps) to account
        create_pool<TestCoinX, TestCoinY>(account, account_addr, 50);
        assert!(exists_pool<TestCoinX, TestCoinY>(), 1);

        // Verify fee configuration
        let (fee_recipient, fee_bps) = get_fee_info<TestCoinX, TestCoinY>();
        assert!(fee_recipient == account_addr, 2);
        assert!(fee_bps == 50, 3);
    }

    #[test(account = @0xbeef)]
    fun test_create_pool_no_fee(account: &signer) acquires Pool {
        let account_addr = signer::address_of(account);
        account::create_account_for_test(account_addr);
        timestamp::set_time_has_started_for_testing(&account::create_signer_for_test(@0x1));

        // Create pool with no protocol fee
        create_pool<TestCoinX, TestCoinY>(account, ZERO_ADDRESS, 0);
        assert!(exists_pool<TestCoinX, TestCoinY>(), 1);

        // Verify no fee configuration
        let (fee_recipient, fee_bps) = get_fee_info<TestCoinX, TestCoinY>();
        assert!(fee_recipient == ZERO_ADDRESS, 2);
        assert!(fee_bps == 0, 3);
    }
}

