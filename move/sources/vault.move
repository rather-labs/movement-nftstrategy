module nft_strategy_addr::vault {
    use std::signer;
    use aptos_framework::fungible_asset::{FungibleAsset, Metadata};
    use aptos_framework::object::{Self, Object, ExtendRef};
    use aptos_framework::primary_fungible_store;

    /// Error codes
    const EVAULT_NOT_FOUND: u64 = 1;
    const EUNAUTHORIZED: u64 = 2;

    /// Vault that holds fungible assets for a trading pair
    struct Vault has key {
        extend_ref: ExtendRef
    }

    /// Creates a new vault for storing assets
    public fun create_vault(creator: &signer): (signer, address) {
        let constructor_ref = object::create_object(signer::address_of(creator));
        let extend_ref = object::generate_extend_ref(&constructor_ref);
        let vault_signer = object::generate_signer(&constructor_ref);
        let vault_addr = signer::address_of(&vault_signer);

        move_to(&vault_signer, Vault { extend_ref });

        (vault_signer, vault_addr)
    }

    /// Deposit assets into the vault
    public fun deposit(vault_addr: address, asset: FungibleAsset) {
        assert!(exists<Vault>(vault_addr), EVAULT_NOT_FOUND);
        primary_fungible_store::deposit(vault_addr, asset);
    }

    /// Withdraw assets from the vault
    public fun withdraw(
        vault_addr: address, metadata: Object<Metadata>, amount: u64
    ): FungibleAsset acquires Vault {
        assert!(exists<Vault>(vault_addr), EVAULT_NOT_FOUND);
        let vault = borrow_global<Vault>(vault_addr);
        let vault_signer = object::generate_signer_for_extending(&vault.extend_ref);
        primary_fungible_store::withdraw(&vault_signer, metadata, amount)
    }

    /// Get balance of a specific asset in the vault
    public fun balance(vault_addr: address, metadata: Object<Metadata>): u64 {
        if (!exists<Vault>(vault_addr)) { return 0 };
        primary_fungible_store::balance(vault_addr, metadata)
    }

    /// Check if vault exists
    public fun exists_vault(vault_addr: address): bool {
        exists<Vault>(vault_addr)
    }
}

