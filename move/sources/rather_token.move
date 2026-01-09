module nft_strategy_addr::rather_token {
    use std::string;
    use std::option;
    use aptos_framework::fungible_asset::{Self, MintRef, TransferRef, BurnRef, Metadata};
    use aptos_framework::object::{Self, Object};
    use aptos_framework::primary_fungible_store;

    const DECIMALS: u8 = 8;

    struct RatherToken {}

    #[resource_group_member(group = aptos_framework::object::ObjectGroup)]
    struct RatherTokenRef has key {
        admin: address,
        mint_ref: MintRef,
        transfer_ref: TransferRef,
        burn_ref: BurnRef
    }

    // Tracks total minted and burned amounts for analytics
    #[resource_group_member(group = aptos_framework::object::ObjectGroup)]
    struct RatherTokenStats has key {
        total_minted: u64,
        total_burned: u64
    }

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

        let admin_addr = std::signer::address_of(admin);
        let object_signer = object::generate_signer(&constructor_ref);

        move_to(
            &object_signer,
            RatherTokenRef {
                admin: admin_addr,
                mint_ref,
                transfer_ref,
                burn_ref
            }
        );

        move_to(&object_signer, RatherTokenStats { total_minted: 0, total_burned: 0 });
    }

    #[view]
    public fun get_metadata(): Object<Metadata> {
        object::address_to_object<Metadata>(
            object::create_object_address(&@nft_strategy_addr, b"RatherToken")
        )
    }

    public fun mint(admin: &signer, to: address, amount: u64) acquires RatherTokenRef, RatherTokenStats {
        let asset = get_metadata();
        let object_addr = object::object_address(&asset);
        let token_ref = borrow_global<RatherTokenRef>(object_addr);
        assert!(std::signer::address_of(admin) == token_ref.admin, 1); // E_NOT_ADMIN
        let fa = fungible_asset::mint(&token_ref.mint_ref, amount);
        primary_fungible_store::deposit(to, fa);

        // Update stats
        let stats = borrow_global_mut<RatherTokenStats>(object_addr);
        stats.total_minted = stats.total_minted + amount;
    }

    public fun burn(
        admin: &signer, _from: address, amount: u64
    ) acquires RatherTokenRef, RatherTokenStats {
        let asset = get_metadata();
        let object_addr = object::object_address(&asset);
        let token_ref = borrow_global<RatherTokenRef>(object_addr);
        let fa = primary_fungible_store::withdraw(admin, get_metadata(), amount);
        fungible_asset::burn(&token_ref.burn_ref, fa);

        // Update stats
        let stats = borrow_global_mut<RatherTokenStats>(object_addr);
        stats.total_burned = stats.total_burned + amount;
    }

    #[view]
    public fun balance_of(owner: address): u64 {
        primary_fungible_store::balance(owner, get_metadata())
    }

    #[view]
    /// Returns the current circulating supply (total_minted - total_burned)
    public fun get_current_supply(): u64 acquires RatherTokenStats {
        let asset = get_metadata();
        let object_addr = object::object_address(&asset);
        let stats = borrow_global<RatherTokenStats>(object_addr);
        stats.total_minted - stats.total_burned
    }

    #[view]
    /// Returns the total amount of tokens ever minted
    public fun get_total_minted(): u64 acquires RatherTokenStats {
        let asset = get_metadata();
        let object_addr = object::object_address(&asset);
        let stats = borrow_global<RatherTokenStats>(object_addr);
        stats.total_minted
    }

    #[view]
    /// Returns the total amount of tokens ever burned
    public fun get_total_burned(): u64 acquires RatherTokenStats {
        let asset = get_metadata();
        let object_addr = object::object_address(&asset);
        let stats = borrow_global<RatherTokenStats>(object_addr);
        stats.total_burned
    }

    // Entry functions for CLI access
    public entry fun mint_entry(
        admin: &signer, to: address, amount: u64
    ) acquires RatherTokenRef, RatherTokenStats {
        mint(admin, to, amount);
    }

    public entry fun burn_entry(
        admin: &signer, from: address, amount: u64
    ) acquires RatherTokenRef, RatherTokenStats {
        burn(admin, from, amount);
    }
}

