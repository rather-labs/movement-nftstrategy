/// NFT Collection Module - RatherRobots
/// A simple NFT collection with fixed 10,000 token supply.
/// All NFTs are transferable. Metadata URI is derived from token_id.
/// Only the collection creator can mint NFTs.
module nft_strategy_addr::nft_collection {
    use std::signer;
    use std::string::{Self, String};
    use aptos_std::smart_table::{Self, SmartTable};
    use aptos_std::string_utils;
    use aptos_framework::object::{Self, Object, ExtendRef};
    use aptos_framework::event;

    use nft_strategy_addr::errors;

    // ============ Constants ============

    /// Maximum supply of NFTs in the collection
    const MAX_SUPPLY: u64 = 10000;

    /// Base URI for token metadata
    const BASE_URI: vector<u8> = b"https://robohash.org/user";

    /// Collection name
    const COLLECTION_NAME: vector<u8> = b"RatherRobots";

    // ============ Data Structures ============

    // Collection resource stored at the collection object address
    #[resource_group_member(group = aptos_framework::object::ObjectGroup)]
    struct Collection has key {
        /// Collection creator (only one who can mint)
        creator: address,
        /// Collection name
        name: String,
        /// Collection description
        description: String,
        /// Current supply (number of minted tokens)
        current_supply: u64,
        /// Mapping from token_id to NFT object address
        tokens: SmartTable<u64, address>,
        /// ExtendRef to add resources to collection object
        extend_ref: ExtendRef
    }

    // NFT resource stored at individual NFT object addresses
    #[resource_group_member(group = aptos_framework::object::ObjectGroup)]
    struct NFT has key {
        /// Reference to parent collection address
        collection: address,
        /// Unique token ID within collection (1 to MAX_SUPPLY)
        token_id: u64
    }

    // ============ Events ============
    #[event]
    struct CollectionCreated has drop, store {
        collection: address,
        creator: address,
        name: String,
        max_supply: u64
    }

    #[event]
    struct NFTMinted has drop, store {
        collection: address,
        token_id: u64,
        nft_address: address,
        recipient: address
    }

    #[event]
    struct NFTBurned has drop, store {
        collection: address,
        token_id: u64,
        nft_address: address,
        owner: address
    }

    #[event]
    struct NFTTransferred has drop, store {
        nft_address: address,
        from: address,
        to: address
    }

    // ============ Collection Functions ============

    /// Create the RatherRobots collection
    /// Can only be called once per creator with this collection name
    public entry fun create_collection(
        creator: &signer, description: String
    ) {
        let creator_addr = signer::address_of(creator);
        let name = string::utf8(COLLECTION_NAME);

        // Create named object for deterministic collection address
        let constructor_ref = object::create_named_object(creator, COLLECTION_NAME);
        let collection_signer = object::generate_signer(&constructor_ref);
        let collection_addr = signer::address_of(&collection_signer);
        let extend_ref = object::generate_extend_ref(&constructor_ref);

        // Store collection data
        move_to(
            &collection_signer,
            Collection {
                creator: creator_addr,
                name,
                description,
                current_supply: 0,
                tokens: smart_table::new(),
                extend_ref
            }
        );

        event::emit(
            CollectionCreated {
                collection: collection_addr,
                creator: creator_addr,
                name,
                max_supply: MAX_SUPPLY
            }
        );
    }

    // ============ Minting Functions ============

    /// Mint a new NFT to a recipient
    /// Only the collection creator can mint
    public entry fun mint(creator: &signer, recipient: address) acquires Collection {
        let creator_addr = signer::address_of(creator);
        let collection_addr = get_collection_address(creator_addr);

        assert!(
            exists<Collection>(collection_addr),
            errors::collection_not_exists()
        );

        let collection = borrow_global_mut<Collection>(collection_addr);

        // Verify caller is the collection creator
        assert!(creator_addr == collection.creator, errors::not_collection_creator());

        // Check max supply
        assert!(collection.current_supply < MAX_SUPPLY, errors::max_supply_reached());

        // Generate token_id (1-indexed)
        let token_id = collection.current_supply + 1;

        // Create NFT object owned by recipient
        let constructor_ref = object::create_object(recipient);
        let nft_signer = object::generate_signer(&constructor_ref);
        let nft_addr = signer::address_of(&nft_signer);

        // Store NFT data
        move_to(&nft_signer, NFT { collection: collection_addr, token_id });

        // Update collection
        smart_table::add(&mut collection.tokens, token_id, nft_addr);
        collection.current_supply = token_id;

        event::emit(
            NFTMinted {
                collection: collection_addr,
                token_id,
                nft_address: nft_addr,
                recipient
            }
        );
    }

    /// Mint multiple NFTs to a recipient (batch mint)
    /// Only the collection creator can mint
    public entry fun mint_batch(
        creator: &signer, recipient: address, count: u64
    ) acquires Collection {
        let i = 0;
        while (i < count) {
            mint(creator, recipient);
            i = i + 1;
        };
    }

    // ============ Transfer Functions ============

    /// Transfer an NFT to a new owner
    public entry fun transfer(owner: &signer, nft: Object<NFT>, to: address) {
        let from = signer::address_of(owner);
        let nft_address = object::object_address(&nft);

        // Verify ownership
        assert!(object::is_owner(nft, from), errors::nft_not_owned());

        // Transfer NFT
        object::transfer(owner, nft, to);

        event::emit(NFTTransferred { nft_address, from, to });
    }

    // ============ Burn Functions ============

    /// Burn an NFT (owner only)
    public entry fun burn(owner: &signer, nft: Object<NFT>) acquires NFT, Collection {
        let owner_addr = signer::address_of(owner);
        let nft_addr = object::object_address(&nft);

        // Verify ownership
        assert!(object::is_owner(nft, owner_addr), errors::nft_not_owned());

        // Get NFT data before destroying
        let NFT { collection, token_id } = move_from<NFT>(nft_addr);

        // Remove from collection tracking
        let collection_data = borrow_global_mut<Collection>(collection);
        smart_table::remove(&mut collection_data.tokens, token_id);

        event::emit(
            NFTBurned {
                collection,
                token_id,
                nft_address: nft_addr,
                owner: owner_addr
            }
        );
    }

    // ============ View Functions ============
    #[view]
    /// Get the collection address for a creator
    public fun get_collection_address(creator: address): address {
        object::create_object_address(&creator, COLLECTION_NAME)
    }

    #[view]
    /// Get collection information
    public fun get_collection_info(
        collection_addr: address
    ): (address, String, String, u64, u64) acquires Collection {
        assert!(
            exists<Collection>(collection_addr),
            errors::collection_not_exists()
        );

        let collection = borrow_global<Collection>(collection_addr);
        (
            collection.creator,
            collection.name,
            collection.description,
            collection.current_supply,
            MAX_SUPPLY
        )
    }

    #[view]
    /// Get NFT information
    public fun get_nft_info(nft_addr: address): (address, u64) acquires NFT {
        assert!(
            exists<NFT>(nft_addr),
            errors::invalid_token_id()
        );

        let nft = borrow_global<NFT>(nft_addr);
        (nft.collection, nft.token_id)
    }

    #[view]
    /// Get the token URI for an NFT
    /// Returns "https://robohash.org/user{token_id}"
    public fun token_uri(nft: Object<NFT>): String acquires NFT {
        let nft_addr = object::object_address(&nft);
        let nft_data = borrow_global<NFT>(nft_addr);

        // Construct URI: BASE_URI + token_id
        let uri = string::utf8(BASE_URI);
        string::append(&mut uri, string_utils::to_string(&nft_data.token_id));
        uri
    }

    #[view]
    /// Get the owner of an NFT
    public fun get_owner(nft: Object<NFT>): address {
        object::owner(nft)
    }

    #[view]
    /// Get the NFT address by token_id
    public fun get_nft_by_token_id(
        collection_addr: address, token_id: u64
    ): address acquires Collection {
        assert!(
            exists<Collection>(collection_addr),
            errors::collection_not_exists()
        );

        let collection = borrow_global<Collection>(collection_addr);

        assert!(
            smart_table::contains(&collection.tokens, token_id),
            errors::invalid_token_id()
        );

        *smart_table::borrow(&collection.tokens, token_id)
    }

    #[view]
    /// Check if collection exists
    public fun collection_exists(creator: address): bool {
        let collection_addr = get_collection_address(creator);
        exists<Collection>(collection_addr)
    }

    #[view]
    /// Get the current supply of the collection
    public fun get_current_supply(collection_addr: address): u64 acquires Collection {
        assert!(
            exists<Collection>(collection_addr),
            errors::collection_not_exists()
        );

        let collection = borrow_global<Collection>(collection_addr);
        collection.current_supply
    }

    #[view]
    /// Get the maximum supply constant
    public fun get_max_supply(): u64 {
        MAX_SUPPLY
    }

    #[view]
    /// Check if an NFT exists at the given address
    public fun nft_exists(nft_addr: address): bool {
        exists<NFT>(nft_addr)
    }
}

