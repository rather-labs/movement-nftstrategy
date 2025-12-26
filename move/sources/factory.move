module nft_strategy_addr::factory {
    use std::signer;
    use std::vector;
    use aptos_framework::account;
    use aptos_framework::event::{Self, EventHandle};
    use aptos_std::simple_map::{Self, SimpleMap};
    use aptos_std::type_info::{Self, TypeInfo};
    use nft_strategy_addr::errors;
    use nft_strategy_addr::pool;

    struct Factory has key {
        fee_to: address,
        fee_to_setter: address,
        all_pools: vector<PoolInfo>,
        pool_map: SimpleMap<vector<u8>, u64> // key: sorted pair types, value: index in all_pools
    }

    struct FactoryEvents has key {
        pool_created_events: EventHandle<PoolCreatedEvent>
    }

    struct PoolInfo has store, drop, copy {
        token_x: TypeInfo,
        token_y: TypeInfo,
        pool_address: address
    }

    struct PoolCreatedEvent has drop, store {
        token_x: TypeInfo,
        token_y: TypeInfo,
        pool_address: address,
        pool_index: u64
    }

    const ZERO_ADDRESS: address = @0x0;

    public entry fun initialize(account: &signer, fee_to_setter: address) {
        let account_addr = signer::address_of(account);
        assert!(
            !exists<Factory>(account_addr),
            errors::pool_already_exists()
        );

        move_to(
            account,
            Factory {
                fee_to: ZERO_ADDRESS,
                fee_to_setter,
                all_pools: vector::empty<PoolInfo>(),
                pool_map: simple_map::create<vector<u8>, u64>()
            }
        );

        move_to(
            account,
            FactoryEvents {
                pool_created_events: account::new_event_handle<PoolCreatedEvent>(account)
            }
        );
    }

    public fun create_pool<X, Y>(
        account: &signer, fee_recipient: address, fee_bps: u64
    ): address acquires Factory, FactoryEvents {
        let factory_addr = signer::address_of(account);
        assert!(
            exists<Factory>(factory_addr),
            errors::pool_not_exists()
        );
        assert!(
            !is_same_type<X, Y>(),
            errors::identical_addresses()
        );

        let (token_x_info, token_y_info) = get_sorted_types<X, Y>();
        let pair_key = generate_pair_key(token_x_info, token_y_info);

        let factory = borrow_global_mut<Factory>(factory_addr);
        assert!(
            !simple_map::contains_key(&factory.pool_map, &pair_key),
            errors::pool_already_exists()
        );

        pool::create_pool<X, Y>(account, fee_recipient, fee_bps);
        let pool_address = signer::address_of(account);

        let pool_info = PoolInfo {
            token_x: token_x_info,
            token_y: token_y_info,
            pool_address
        };

        vector::push_back(&mut factory.all_pools, pool_info);
        let pool_index = vector::length(&factory.all_pools) - 1;
        simple_map::add(&mut factory.pool_map, pair_key, pool_index);

        let factory_events = borrow_global_mut<FactoryEvents>(factory_addr);
        event::emit_event(
            &mut factory_events.pool_created_events,
            PoolCreatedEvent {
                token_x: token_x_info,
                token_y: token_y_info,
                pool_address,
                pool_index
            }
        );

        pool_address
    }

    public fun get_pool<X, Y>(): address acquires Factory {
        let (token_x_info, token_y_info) = get_sorted_types<X, Y>();
        get_pool_by_types(token_x_info, token_y_info)
    }

    public fun get_pool_by_types(token_x: TypeInfo, token_y: TypeInfo): address acquires Factory {
        let pair_key = generate_pair_key(token_x, token_y);

        // Try to find factory at different addresses
        let factory_candidates = vector[@nft_strategy_addr, @0x42, @0x1];
        let i = 0;
        let len = vector::length(&factory_candidates);

        while (i < len) {
            let factory_addr = *vector::borrow(&factory_candidates, i);
            if (exists<Factory>(factory_addr)) {
                let factory = borrow_global<Factory>(factory_addr);
                if (simple_map::contains_key(&factory.pool_map, &pair_key)) {
                    let pool_index = *simple_map::borrow(&factory.pool_map, &pair_key);
                    let pool_info = vector::borrow(&factory.all_pools, pool_index);
                    return pool_info.pool_address
                }
            };
            i = i + 1;
        };

        ZERO_ADDRESS
    }

    #[view]
    public fun all_pools_length(): u64 acquires Factory {
        let factory_candidates = vector[@nft_strategy_addr, @0x42, @0x1];
        let i = 0;
        let len = vector::length(&factory_candidates);

        while (i < len) {
            let factory_addr = *vector::borrow(&factory_candidates, i);
            if (exists<Factory>(factory_addr)) {
                let factory = borrow_global<Factory>(factory_addr);
                return vector::length(&factory.all_pools)
            };
            i = i + 1;
        };

        0
    }

    public fun all_pools(start: u64, limit: u64): vector<PoolInfo> acquires Factory {
        let factory_candidates = vector[@nft_strategy_addr, @0x42, @0x1];
        let i = 0;
        let len = vector::length(&factory_candidates);

        while (i < len) {
            let factory_addr = *vector::borrow(&factory_candidates, i);
            if (exists<Factory>(factory_addr)) {
                let factory = borrow_global<Factory>(factory_addr);
                let all_pools_vec = &factory.all_pools;
                let total_length = vector::length(all_pools_vec);

                if (start >= total_length) {
                    return vector::empty<PoolInfo>()
                };

                let end =
                    if (start + limit > total_length) {
                        total_length
                    } else {
                        start + limit
                    };

                let result = vector::empty<PoolInfo>();
                let j = start;
                while (j < end) {
                    let pool_info = *vector::borrow(all_pools_vec, j);
                    vector::push_back(&mut result, pool_info);
                    j = j + 1;
                };

                return result
            };
            i = i + 1;
        };

        vector::empty<PoolInfo>()
    }

    public fun set_fee_to(account: &signer, new_fee_to: address) acquires Factory {
        let factory_addr = find_factory_address();
        assert!(factory_addr != ZERO_ADDRESS, errors::pool_not_exists());

        let factory = borrow_global_mut<Factory>(factory_addr);
        assert!(
            signer::address_of(account) == factory.fee_to_setter,
            errors::not_authorized()
        );

        factory.fee_to = new_fee_to;
    }

    public fun set_fee_to_setter(
        account: &signer, new_fee_to_setter: address
    ) acquires Factory {
        let factory_addr = find_factory_address();
        assert!(factory_addr != ZERO_ADDRESS, errors::pool_not_exists());

        let factory = borrow_global_mut<Factory>(factory_addr);
        assert!(
            signer::address_of(account) == factory.fee_to_setter,
            errors::not_authorized()
        );

        factory.fee_to_setter = new_fee_to_setter;
    }

    fun find_factory_address(): address {
        let factory_candidates = vector[@nft_strategy_addr, @0x42, @0x1, @0xbeef];
        let i = 0;
        let len = vector::length(&factory_candidates);

        while (i < len) {
            let factory_addr = *vector::borrow(&factory_candidates, i);
            if (exists<Factory>(factory_addr)) {
                return factory_addr
            };
            i = i + 1;
        };

        ZERO_ADDRESS
    }

    public fun fee_to(): address acquires Factory {
        let factory_candidates = vector[@nft_strategy_addr, @0x42, @0x1];
        let i = 0;
        let len = vector::length(&factory_candidates);

        while (i < len) {
            let factory_addr = *vector::borrow(&factory_candidates, i);
            if (exists<Factory>(factory_addr)) {
                let factory = borrow_global<Factory>(factory_addr);
                return factory.fee_to
            };
            i = i + 1;
        };

        ZERO_ADDRESS
    }

    public fun fee_to_setter(): address acquires Factory {
        let factory_candidates = vector[@nft_strategy_addr, @0x42, @0x1];
        let i = 0;
        let len = vector::length(&factory_candidates);

        while (i < len) {
            let factory_addr = *vector::borrow(&factory_candidates, i);
            if (exists<Factory>(factory_addr)) {
                let factory = borrow_global<Factory>(factory_addr);
                return factory.fee_to_setter
            };
            i = i + 1;
        };

        ZERO_ADDRESS
    }

    fun get_sorted_types<X, Y>(): (TypeInfo, TypeInfo) {
        let x_type_info = type_info::type_of<X>();
        let y_type_info = type_info::type_of<Y>();

        if (is_ordered_types(x_type_info, y_type_info)) {
            (x_type_info, y_type_info)
        } else {
            (y_type_info, x_type_info)
        }
    }

    fun is_ordered_types(type_x: TypeInfo, type_y: TypeInfo): bool {
        let x_name = type_info::struct_name(&type_x);
        let y_name = type_info::struct_name(&type_y);
        compare_vectors(&x_name, &y_name)
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

    fun generate_pair_key(token_x: TypeInfo, token_y: TypeInfo): vector<u8> {
        let key = vector::empty<u8>();
        let x_name = type_info::struct_name(&token_x);
        let y_name = type_info::struct_name(&token_y);

        vector::append(&mut key, x_name);
        vector::append(&mut key, b"::");
        vector::append(&mut key, y_name);

        key
    }

    fun is_same_type<X, Y>(): bool {
        let x_type_info = type_info::type_of<X>();
        let y_type_info = type_info::type_of<Y>();
        x_type_info == y_type_info
    }

    // Entry function
    public entry fun create_pool_entry<X, Y>(
        account: &signer, fee_recipient: address, fee_bps: u64
    ) acquires Factory, FactoryEvents {
        let _pool_address = create_pool<X, Y>(account, fee_recipient, fee_bps);
    }

    #[test_only]
    use aptos_framework::timestamp;

    #[test_only]
    struct TestTokenX has key {}

    #[test_only]
    struct TestTokenY has key {}

    #[test(account = @0xbeef)]
    fun test_initialize_factory(account: &signer) acquires Factory {
        let account_addr = signer::address_of(account);
        account::create_account_for_test(account_addr);

        initialize(account, account_addr);

        assert!(exists<Factory>(account_addr), 1);
        assert!(fee_to_setter() == account_addr, 2);
        assert!(all_pools_length() == 0, 3);
    }

    #[test(account = @0xbeef)]
    fun test_create_pool_through_factory(account: &signer) acquires Factory, FactoryEvents {
        let account_addr = signer::address_of(account);
        account::create_account_for_test(account_addr);
        timestamp::set_time_has_started_for_testing(&account::create_signer_for_test(@0x1));

        initialize(account, account_addr);
        // Create pool with 0.3% fee (30 bps) sent to the account
        let pool_addr = create_pool<TestTokenX, TestTokenY>(account, account_addr, 30);

        assert!(pool_addr != ZERO_ADDRESS, 1);
        assert!(all_pools_length() == 1, 2);
        assert!(get_pool<TestTokenX, TestTokenY>() == pool_addr, 3);
    }
}

