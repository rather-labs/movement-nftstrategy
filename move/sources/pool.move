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
        vault_addr: address
    }

    struct PoolEvents<phantom X, phantom Y> has key {
        mint_events: EventHandle<MintEvent>,
        burn_events: EventHandle<BurnEvent>,
        swap_events: EventHandle<SwapEvent>,
        sync_events: EventHandle<SyncEvent>
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

    public fun create_pool<X, Y>(account: &signer) {
        let account_addr = signer::address_of(account);

        assert!(
            !exists<Pool<X, Y>>(account_addr),
            errors::pool_already_exists()
        );
        assert!(
            !is_same_coin<X, Y>(),
            errors::identical_addresses()
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
                vault_addr
            }
        );

        move_to(
            account,
            PoolEvents<X, Y> {
                mint_events: account::new_event_handle<MintEvent>(account),
                burn_events: account::new_event_handle<BurnEvent>(account),
                swap_events: account::new_event_handle<SwapEvent>(account),
                sync_events: account::new_event_handle<SyncEvent>(account)
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

        let amount_x_in = fungible_asset::amount(&asset_x);
        assert!(amount_x_in > 0, errors::zero_amount());

        let pool = borrow_global_mut<Pool<X, Y>>(pool_addr);
        let amount_y_out =
            math::get_amount_out(amount_x_in, pool.reserve_x, pool.reserve_y);
        assert!(amount_y_out >= min_amount_out, errors::insufficient_output_amount());

        // Store input asset in vault and withdraw output asset
        vault::deposit(pool.vault_addr, asset_x);

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

        let amount_y_in = fungible_asset::amount(&asset_y);
        assert!(amount_y_in > 0, errors::zero_amount());

        let pool = borrow_global_mut<Pool<X, Y>>(pool_addr);
        let amount_x_out =
            math::get_amount_out(amount_y_in, pool.reserve_y, pool.reserve_x);
        assert!(amount_x_out >= min_amount_out, errors::insufficient_output_amount());

        // Store input asset in vault and withdraw output asset
        vault::deposit(pool.vault_addr, asset_y);

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
        if (type_name == b"TokenA") {
            object::address_to_object<Metadata>(
                object::create_object_address(&@nft_strategy_addr, b"TokenA")
            )
        } else if (type_name == b"TokenB") {
            object::address_to_object<Metadata>(
                object::create_object_address(&@nft_strategy_addr, b"TokenB")
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
    fun test_create_pool(account: &signer) {
        let account_addr = signer::address_of(account);
        account::create_account_for_test(account_addr);
        timestamp::set_time_has_started_for_testing(&account::create_signer_for_test(@0x1));

        create_pool<TestCoinX, TestCoinY>(account);
        assert!(exists_pool<TestCoinX, TestCoinY>(), 1);
    }
}

