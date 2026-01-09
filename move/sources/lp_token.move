module nft_strategy_addr::lp_token {
    use std::string::{Self, String};
    use std::signer;
    use std::option;
    use std::vector;
    use aptos_framework::coin::{Self, Coin, MintCapability, BurnCapability};
    use aptos_framework::fungible_asset::{
        Self,
        FungibleAsset,
        MintRef,
        TransferRef,
        BurnRef,
        Metadata
    };
    use aptos_framework::object::{Self, Object};
    use aptos_framework::primary_fungible_store;
    use aptos_std::type_info;
    use nft_strategy_addr::errors;

    struct LPToken<phantom X, phantom Y> has key {}

    struct LPTokenCapabilities<phantom X, phantom Y> has key {
        mint_capability: MintCapability<LPToken<X, Y>>,
        burn_capability: BurnCapability<LPToken<X, Y>>
    }

    #[resource_group_member(group = aptos_framework::object::ObjectGroup)]
    struct LPTokenRef<phantom X, phantom Y> has key {
        mint_ref: MintRef,
        transfer_ref: TransferRef,
        burn_ref: BurnRef
    }

    public fun initialize<X, Y>(account: &signer) {
        let name = generate_lp_name<X, Y>();
        let symbol = generate_lp_symbol<X, Y>();

        // Initialize coin-based LP tokens
        let (burn_capability, freeze_capability, mint_capability) =
            coin::initialize<LPToken<X, Y>>(
                account,
                name,
                symbol,
                8, // decimals
                false // monitor_supply
            );

        coin::destroy_freeze_cap(freeze_capability);

        move_to(
            account,
            LPTokenCapabilities<X, Y> { mint_capability, burn_capability }
        );

        // Also initialize fungible asset version
        let lp_token_name = generate_lp_name<X, Y>();
        let unique_seed = generate_unique_seed<X, Y>();
        let constructor_ref = object::create_named_object(account, unique_seed);
        primary_fungible_store::create_primary_store_enabled_fungible_asset(
            &constructor_ref,
            option::none(),
            lp_token_name,
            generate_lp_symbol<X, Y>(),
            8,
            string::utf8(b""),
            string::utf8(b"")
        );

        let mint_ref = fungible_asset::generate_mint_ref(&constructor_ref);
        let burn_ref = fungible_asset::generate_burn_ref(&constructor_ref);
        let transfer_ref = fungible_asset::generate_transfer_ref(&constructor_ref);

        move_to(
            &object::generate_signer(&constructor_ref),
            LPTokenRef<X, Y> { mint_ref, transfer_ref, burn_ref }
        );
    }

    public fun mint<X, Y>(
        account: &signer, amount: u64
    ): Coin<LPToken<X, Y>> acquires LPTokenCapabilities {
        let account_addr = signer::address_of(account);
        assert!(
            exists<LPTokenCapabilities<X, Y>>(account_addr),
            errors::not_authorized()
        );

        let capabilities = borrow_global<LPTokenCapabilities<X, Y>>(account_addr);
        coin::mint<LPToken<X, Y>>(amount, &capabilities.mint_capability)
    }

    public fun mint_fa<X, Y>(_account: &signer, amount: u64): FungibleAsset acquires LPTokenRef {
        let asset = get_metadata<X, Y>();
        let token_ref = borrow_global<LPTokenRef<X, Y>>(object::object_address(&asset));
        fungible_asset::mint(&token_ref.mint_ref, amount)
    }

    public fun burn<X, Y>(account: &signer, tokens: Coin<LPToken<X, Y>>) acquires LPTokenCapabilities {
        let account_addr = signer::address_of(account);
        assert!(
            exists<LPTokenCapabilities<X, Y>>(account_addr),
            errors::not_authorized()
        );

        let capabilities = borrow_global<LPTokenCapabilities<X, Y>>(account_addr);
        coin::burn<LPToken<X, Y>>(tokens, &capabilities.burn_capability);
    }

    public fun burn_fa<X, Y>(_account: &signer, tokens: FungibleAsset) acquires LPTokenRef {
        let asset = get_metadata<X, Y>();
        let token_ref = borrow_global<LPTokenRef<X, Y>>(object::object_address(&asset));
        fungible_asset::burn(&token_ref.burn_ref, tokens);
    }

    public fun supply<X, Y>(): u128 {
        // First check fungible asset supply (primary system)
        let metadata = get_metadata<X, Y>();
        if (fungible_asset::supply(metadata) != option::none()) {
            *option::borrow(&fungible_asset::supply(metadata))
        } else if (coin::is_coin_initialized<LPToken<X, Y>>()) {
            // Fall back to coin supply if fungible asset supply not available
            let supply_option = coin::supply<LPToken<X, Y>>();
            if (std::option::is_some(&supply_option)) {
                *std::option::borrow(&supply_option)
            } else { 0 }
        } else { 0 }
    }

    fun generate_lp_name<X, Y>(): String {
        string::utf8(b"LP")
    }

    fun generate_lp_symbol<X, Y>(): String {
        string::utf8(b"LP")
    }

    public fun token_address<X, Y>(): address {
        let type_info = type_info::type_of<LPToken<X, Y>>();
        type_info::account_address(&type_info)
    }

    #[view]
    public fun get_metadata<X, Y>(): Object<Metadata> {
        let unique_seed = generate_unique_seed<X, Y>();
        object::address_to_object<Metadata>(
            object::create_object_address(&@nft_strategy_addr, unique_seed)
        )
    }

    #[view]
    public fun get_balance<X, Y>(account: address): u64 {
        let metadata = get_metadata<X, Y>();
        primary_fungible_store::balance(account, metadata)
    }

    #[view]
    public fun get_supply<X, Y>(): u128 {
        supply<X, Y>()
    }

    fun generate_unique_seed<X, Y>(): vector<u8> {
        let x_name = type_info::struct_name(&type_info::type_of<X>());
        let y_name = type_info::struct_name(&type_info::type_of<Y>());
        let seed = vector::empty<u8>();
        vector::append(&mut seed, b"LP_");
        vector::append(&mut seed, x_name);
        vector::append(&mut seed, b"_");
        vector::append(&mut seed, y_name);
        seed
    }

    #[test_only]
    use aptos_framework::account;

    #[test_only]
    struct TestTokenX has key {}

    #[test_only]
    struct TestTokenY has key {}

    #[test(account = @0xbeef)]
    fun test_initialize_lp_token(account: &signer) {
        let account_addr = signer::address_of(account);
        account::create_account_for_test(account_addr);

        initialize<TestTokenX, TestTokenY>(account);
        assert!(
            exists<LPTokenCapabilities<TestTokenX, TestTokenY>>(account_addr),
            1
        );
        assert!(
            coin::is_coin_initialized<LPToken<TestTokenX, TestTokenY>>(),
            2
        );
    }

    #[test(account = @0xbeef)]
    fun test_mint_burn_lp_tokens(account: &signer) acquires LPTokenCapabilities, LPTokenRef {
        let account_addr = signer::address_of(account);
        account::create_account_for_test(account_addr);

        initialize<TestTokenX, TestTokenY>(account);

        // Test coin version
        let lp_tokens = mint<TestTokenX, TestTokenY>(account, 1000);
        assert!(coin::value(&lp_tokens) == 1000, 1);
        burn<TestTokenX, TestTokenY>(account, lp_tokens);

        // Test fungible asset version
        let lp_fa = mint_fa<TestTokenX, TestTokenY>(account, 1000);
        assert!(fungible_asset::amount(&lp_fa) == 1000, 2);
        burn_fa<TestTokenX, TestTokenY>(account, lp_fa);
    }
}

