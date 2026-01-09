/// Wrapped MOVE (WMOVE) - A fungible asset wrapper for the native MOVE coin.
/// Enables native MOVE to be used in FA-based liquidity pools.
/// Fully trustless: anyone can wrap/unwrap at any time 1:1.
module nft_strategy_addr::wmove {
    use std::string;
    use std::option;
    use std::signer;
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::coin;
    use aptos_framework::fungible_asset::{Self, MintRef, TransferRef, BurnRef, Metadata};
    use aptos_framework::object::{Self, Object, ExtendRef};
    use aptos_framework::primary_fungible_store;

    /// WMOVE uses same decimals as native MOVE (8)
    const DECIMALS: u8 = 8;

    /// Error codes
    const E_ZERO_AMOUNT: u64 = 1;
    const E_INSUFFICIENT_RESERVE: u64 = 2;

    /// Marker struct for type identification in pools
    struct WMOVE {}

    // Stores minting/burning capabilities and extend_ref for reserve management
    #[resource_group_member(group = aptos_framework::object::ObjectGroup)]
    struct WMOVERef has key {
        mint_ref: MintRef,
        burn_ref: BurnRef,
        transfer_ref: TransferRef,
        extend_ref: ExtendRef
    }

    /// Initialize the WMOVE fungible asset on module publish
    fun init_module(deployer: &signer) {
        // Create a named object for deterministic addressing
        let constructor_ref = object::create_named_object(deployer, b"WMOVE");

        // Create the fungible asset with primary store support
        primary_fungible_store::create_primary_store_enabled_fungible_asset(
            &constructor_ref,
            option::none(), // No max supply - backed 1:1 by MOVE
            string::utf8(b"Wrapped MOVE"),
            string::utf8(b"WMOVE"),
            DECIMALS,
            string::utf8(b""), // icon_uri
            string::utf8(b"") // project_uri
        );

        // Generate all capability references
        let mint_ref = fungible_asset::generate_mint_ref(&constructor_ref);
        let burn_ref = fungible_asset::generate_burn_ref(&constructor_ref);
        let transfer_ref = fungible_asset::generate_transfer_ref(&constructor_ref);
        let extend_ref = object::generate_extend_ref(&constructor_ref);

        // Store refs on the metadata object itself
        move_to(
            &object::generate_signer(&constructor_ref),
            WMOVERef { mint_ref, burn_ref, transfer_ref, extend_ref }
        );
    }

    // ============ View Functions ============
    #[view]
    /// Returns the WMOVE metadata object
    public fun get_metadata(): Object<Metadata> {
        object::address_to_object<Metadata>(
            object::create_object_address(&@nft_strategy_addr, b"WMOVE")
        )
    }

    #[view]
    /// Returns the native MOVE reserve backing WMOVE
    public fun get_reserve(): u64 {
        let wmove_addr = object::object_address(&get_metadata());
        let move_metadata = get_native_move_metadata();
        primary_fungible_store::balance(wmove_addr, move_metadata)
    }

    #[view]
    /// Returns WMOVE total supply
    public fun get_total_supply(): u128 {
        let metadata = get_metadata();
        let supply_opt = fungible_asset::supply(metadata);
        if (option::is_some(&supply_opt)) {
            option::extract(&mut supply_opt)
        } else { 0 }
    }

    #[view]
    /// Returns the WMOVE balance for a given owner address
    public fun balance_of(owner: address): u64 {
        primary_fungible_store::balance(owner, get_metadata())
    }

    // ============ Core Functions ============

    /// Wrap native MOVE into WMOVE
    /// Withdraws MOVE from caller, deposits into reserve, mints equal WMOVE to caller
    public entry fun wrap(account: &signer, amount: u64) acquires WMOVERef {
        assert!(amount > 0, E_ZERO_AMOUNT);

        // Withdraw native MOVE coin from caller
        let move_coin = coin::withdraw<AptosCoin>(account, amount);

        // Convert native coin to fungible asset
        let move_fa = coin::coin_to_fungible_asset(move_coin);

        // Deposit native MOVE FA into the WMOVE object's reserve
        let wmove_addr = object::object_address(&get_metadata());
        primary_fungible_store::deposit(wmove_addr, move_fa);

        // Mint equal WMOVE to caller
        let wmove_ref = borrow_global<WMOVERef>(wmove_addr);
        let wmove_fa = fungible_asset::mint(&wmove_ref.mint_ref, amount);
        primary_fungible_store::deposit(signer::address_of(account), wmove_fa);
    }

    /// Unwrap WMOVE back to native MOVE
    /// Burns WMOVE from caller, withdraws from reserve, deposits native MOVE to caller
    public entry fun unwrap(account: &signer, amount: u64) acquires WMOVERef {
        assert!(amount > 0, E_ZERO_AMOUNT);
        assert!(get_reserve() >= amount, E_INSUFFICIENT_RESERVE);

        let caller_addr = signer::address_of(account);
        let wmove_metadata = get_metadata();
        let wmove_addr = object::object_address(&wmove_metadata);

        // Withdraw and burn WMOVE from caller
        let wmove_fa = primary_fungible_store::withdraw(account, wmove_metadata, amount);
        let wmove_ref = borrow_global<WMOVERef>(wmove_addr);
        fungible_asset::burn(&wmove_ref.burn_ref, wmove_fa);

        // Withdraw native MOVE from reserve using extend_ref
        let reserve_signer = object::generate_signer_for_extending(&wmove_ref.extend_ref);
        let move_metadata = get_native_move_metadata();
        let move_fa =
            primary_fungible_store::withdraw(&reserve_signer, move_metadata, amount);

        // Deposit native MOVE to caller
        primary_fungible_store::deposit(caller_addr, move_fa);
    }

    /// Wrap native MOVE FA into WMOVE FA (internal function for module-to-module calls)
    /// Takes native MOVE as FungibleAsset, returns WMOVE as FungibleAsset
    /// Used by strategy module to wrap treasury proceeds
    public fun wrap_fa(
        move_fa: fungible_asset::FungibleAsset
    ): fungible_asset::FungibleAsset acquires WMOVERef {
        let amount = fungible_asset::amount(&move_fa);
        assert!(amount > 0, E_ZERO_AMOUNT);

        // Deposit native MOVE FA into the WMOVE object's reserve
        let wmove_addr = object::object_address(&get_metadata());
        primary_fungible_store::deposit(wmove_addr, move_fa);

        // Mint equal WMOVE
        let wmove_ref = borrow_global<WMOVERef>(wmove_addr);
        fungible_asset::mint(&wmove_ref.mint_ref, amount)
    }

    /// Unwrap WMOVE FA back to native MOVE FA (internal function for module-to-module calls)
    /// Takes WMOVE as FungibleAsset, returns native MOVE as FungibleAsset
    /// Used by strategy module for treasury operations
    public fun unwrap_fa(
        wmove_fa: fungible_asset::FungibleAsset
    ): fungible_asset::FungibleAsset acquires WMOVERef {
        let amount = fungible_asset::amount(&wmove_fa);
        assert!(amount > 0, E_ZERO_AMOUNT);
        assert!(get_reserve() >= amount, E_INSUFFICIENT_RESERVE);

        let wmove_addr = object::object_address(&get_metadata());

        // Burn the WMOVE
        let wmove_ref = borrow_global<WMOVERef>(wmove_addr);
        fungible_asset::burn(&wmove_ref.burn_ref, wmove_fa);

        // Withdraw native MOVE from reserve using extend_ref
        let reserve_signer = object::generate_signer_for_extending(&wmove_ref.extend_ref);
        let move_metadata = get_native_move_metadata();
        primary_fungible_store::withdraw(&reserve_signer, move_metadata, amount)
    }

    // ============ Internal Helpers ============

    /// Get the metadata for native MOVE (AptosCoin's paired FA)
    fun get_native_move_metadata(): Object<Metadata> {
        let metadata_opt = coin::paired_metadata<AptosCoin>();
        option::destroy_some(metadata_opt)
    }

    // ============ Test Helpers ============
    #[test_only]
    public fun init_for_test(deployer: &signer) {
        init_module(deployer);
    }
}

