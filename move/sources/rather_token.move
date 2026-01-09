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
        move_to(
            &object::generate_signer(&constructor_ref),
            RatherTokenRef {
                admin: admin_addr,
                mint_ref,
                transfer_ref,
                burn_ref
            }
        );
    }

    #[view]
    public fun get_metadata(): Object<Metadata> {
        object::address_to_object<Metadata>(
            object::create_object_address(&@nft_strategy_addr, b"RatherToken")
        )
    }

    public fun mint(admin: &signer, to: address, amount: u64) acquires RatherTokenRef {
        let asset = get_metadata();
        let token_ref = borrow_global<RatherTokenRef>(object::object_address(&asset));
        assert!(std::signer::address_of(admin) == token_ref.admin, 1); // E_NOT_ADMIN
        let fa = fungible_asset::mint(&token_ref.mint_ref, amount);
        primary_fungible_store::deposit(to, fa);
    }

    public fun burn(admin: &signer, _from: address, amount: u64) acquires RatherTokenRef {
        let asset = get_metadata();
        let token_ref = borrow_global<RatherTokenRef>(object::object_address(&asset));
        let fa = primary_fungible_store::withdraw(admin, get_metadata(), amount);
        fungible_asset::burn(&token_ref.burn_ref, fa);
    }

    #[view]
    public fun balance_of(owner: address): u64 {
        primary_fungible_store::balance(owner, get_metadata())
    }

    // Entry functions for CLI access
    public entry fun mint_entry(admin: &signer, to: address, amount: u64) acquires RatherTokenRef {
        mint(admin, to, amount);
    }

    public entry fun burn_entry(admin: &signer, from: address, amount: u64) acquires RatherTokenRef {
        burn(admin, from, amount);
    }
}

