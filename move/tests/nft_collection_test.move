#[test_only]
module nft_strategy_addr::nft_collection_test {
    use std::signer;
    use std::string;
    use aptos_framework::account;
    use aptos_framework::object;

    use nft_strategy_addr::nft_collection;

    // ============ Collection Creation Tests ============
    #[test(creator = @nft_strategy_addr)]
    fun test_create_collection(creator: &signer) {
        let creator_addr = signer::address_of(creator);
        account::create_account_for_test(creator_addr);

        // Create collection
        nft_collection::create_collection(
            creator, string::utf8(b"A collection of unique robot avatars")
        );

        // Verify collection exists
        assert!(nft_collection::collection_exists(creator_addr), 1);

        // Verify collection info
        let collection_addr = nft_collection::get_collection_address(creator_addr);
        let (
            coll_creator, name, description, current_supply, max_supply
        ) = nft_collection::get_collection_info(collection_addr);

        assert!(coll_creator == creator_addr, 2);
        assert!(name == string::utf8(b"RatherRobots"), 3);
        assert!(description == string::utf8(b"A collection of unique robot avatars"), 4);
        assert!(current_supply == 0, 5);
        assert!(max_supply == 10000, 6);
    }

    #[test(creator = @nft_strategy_addr)]
    #[expected_failure(abort_code = 524289, location = aptos_framework::object)]
    fun test_create_collection_twice_fails(creator: &signer) {
        let creator_addr = signer::address_of(creator);
        account::create_account_for_test(creator_addr);

        nft_collection::create_collection(creator, string::utf8(b"First"));
        // Should fail - collection already exists (named object collision)
        nft_collection::create_collection(creator, string::utf8(b"Second"));
    }

    // ============ Minting Tests ============
    #[test(creator = @nft_strategy_addr, recipient = @0x123)]
    fun test_mint_nft(creator: &signer, recipient: &signer) {
        let creator_addr = signer::address_of(creator);
        let recipient_addr = signer::address_of(recipient);
        account::create_account_for_test(creator_addr);
        account::create_account_for_test(recipient_addr);

        nft_collection::create_collection(creator, string::utf8(b"Test collection"));

        // Mint NFT
        nft_collection::mint(creator, recipient_addr);

        // Verify supply increased
        let collection_addr = nft_collection::get_collection_address(creator_addr);
        assert!(nft_collection::get_current_supply(collection_addr) == 1, 1);

        // Get NFT address and verify info
        let nft_addr = nft_collection::get_nft_by_token_id(collection_addr, 1);
        let (coll, token_id) = nft_collection::get_nft_info(nft_addr);
        assert!(coll == collection_addr, 2);
        assert!(token_id == 1, 3);

        // Verify ownership
        let nft = object::address_to_object<nft_collection::NFT>(nft_addr);
        assert!(nft_collection::get_owner(nft) == recipient_addr, 4);
    }

    #[test(creator = @nft_strategy_addr, recipient = @0x123)]
    fun test_mint_multiple_nfts(creator: &signer, recipient: &signer) {
        let creator_addr = signer::address_of(creator);
        let recipient_addr = signer::address_of(recipient);
        account::create_account_for_test(creator_addr);
        account::create_account_for_test(recipient_addr);

        nft_collection::create_collection(creator, string::utf8(b"Test collection"));

        // Mint 5 NFTs
        nft_collection::mint_batch(creator, recipient_addr, 5);

        // Verify supply
        let collection_addr = nft_collection::get_collection_address(creator_addr);
        assert!(nft_collection::get_current_supply(collection_addr) == 5, 1);

        // Verify each token exists with correct ID
        let i = 1;
        while (i <= 5) {
            let nft_addr = nft_collection::get_nft_by_token_id(collection_addr, i);
            let (_, token_id) = nft_collection::get_nft_info(nft_addr);
            assert!(token_id == i, 2);
            i = i + 1;
        };
    }

    #[test(creator = @nft_strategy_addr, other = @0x456, recipient = @0x123)]
    #[expected_failure(abort_code = 32, location = nft_strategy_addr::nft_collection)]
    fun test_mint_not_creator_fails(
        creator: &signer, other: &signer, recipient: &signer
    ) {
        let creator_addr = signer::address_of(creator);
        let other_addr = signer::address_of(other);
        let recipient_addr = signer::address_of(recipient);
        account::create_account_for_test(creator_addr);
        account::create_account_for_test(other_addr);
        account::create_account_for_test(recipient_addr);

        nft_collection::create_collection(creator, string::utf8(b"Test collection"));

        // Should fail - other's collection doesn't exist (mint looks up collection by signer address)
        // This correctly tests that only the collection creator can mint
        nft_collection::mint(other, recipient_addr);
    }

    // ============ Token URI Tests ============
    #[test(creator = @nft_strategy_addr, recipient = @0x123)]
    fun test_token_uri(creator: &signer, recipient: &signer) {
        let creator_addr = signer::address_of(creator);
        let recipient_addr = signer::address_of(recipient);
        account::create_account_for_test(creator_addr);
        account::create_account_for_test(recipient_addr);

        nft_collection::create_collection(creator, string::utf8(b"Test collection"));

        // Mint NFT #1
        nft_collection::mint(creator, recipient_addr);

        let collection_addr = nft_collection::get_collection_address(creator_addr);
        let nft_addr = nft_collection::get_nft_by_token_id(collection_addr, 1);
        let nft = object::address_to_object<nft_collection::NFT>(nft_addr);

        // Verify URI
        let uri = nft_collection::token_uri(nft);
        assert!(
            uri == string::utf8(b"https://robohash.org/user1"), 1
        );

        // Mint NFT #2 and verify
        nft_collection::mint(creator, recipient_addr);
        let nft_addr_2 = nft_collection::get_nft_by_token_id(collection_addr, 2);
        let nft_2 = object::address_to_object<nft_collection::NFT>(nft_addr_2);
        let uri_2 = nft_collection::token_uri(nft_2);
        assert!(
            uri_2 == string::utf8(b"https://robohash.org/user2"), 2
        );
    }

    // ============ Transfer Tests ============
    #[test(creator = @nft_strategy_addr, owner = @0x123, new_owner = @0x456)]
    fun test_transfer_nft(
        creator: &signer, owner: &signer, new_owner: &signer
    ) {
        let creator_addr = signer::address_of(creator);
        let owner_addr = signer::address_of(owner);
        let new_owner_addr = signer::address_of(new_owner);
        account::create_account_for_test(creator_addr);
        account::create_account_for_test(owner_addr);
        account::create_account_for_test(new_owner_addr);

        nft_collection::create_collection(creator, string::utf8(b"Test collection"));
        nft_collection::mint(creator, owner_addr);

        let collection_addr = nft_collection::get_collection_address(creator_addr);
        let nft_addr = nft_collection::get_nft_by_token_id(collection_addr, 1);
        let nft = object::address_to_object<nft_collection::NFT>(nft_addr);

        // Verify initial ownership
        assert!(nft_collection::get_owner(nft) == owner_addr, 1);

        // Transfer NFT
        nft_collection::transfer(owner, nft, new_owner_addr);

        // Verify new ownership
        assert!(nft_collection::get_owner(nft) == new_owner_addr, 2);
    }

    #[test(creator = @nft_strategy_addr, owner = @0x123, other = @0x456)]
    #[expected_failure(abort_code = 27, location = nft_strategy_addr::nft_collection)]
    fun test_transfer_not_owner_fails(
        creator: &signer, owner: &signer, other: &signer
    ) {
        let creator_addr = signer::address_of(creator);
        let owner_addr = signer::address_of(owner);
        let other_addr = signer::address_of(other);
        account::create_account_for_test(creator_addr);
        account::create_account_for_test(owner_addr);
        account::create_account_for_test(other_addr);

        nft_collection::create_collection(creator, string::utf8(b"Test collection"));
        nft_collection::mint(creator, owner_addr);

        let collection_addr = nft_collection::get_collection_address(creator_addr);
        let nft_addr = nft_collection::get_nft_by_token_id(collection_addr, 1);
        let nft = object::address_to_object<nft_collection::NFT>(nft_addr);

        // Should fail - other is not the owner
        nft_collection::transfer(other, nft, other_addr);
    }

    // ============ Burn Tests ============
    #[test(creator = @nft_strategy_addr, owner = @0x123)]
    fun test_burn_nft(creator: &signer, owner: &signer) {
        let creator_addr = signer::address_of(creator);
        let owner_addr = signer::address_of(owner);
        account::create_account_for_test(creator_addr);
        account::create_account_for_test(owner_addr);

        nft_collection::create_collection(creator, string::utf8(b"Test collection"));
        nft_collection::mint(creator, owner_addr);

        let collection_addr = nft_collection::get_collection_address(creator_addr);
        let nft_addr = nft_collection::get_nft_by_token_id(collection_addr, 1);
        let nft = object::address_to_object<nft_collection::NFT>(nft_addr);

        // Verify NFT exists
        assert!(nft_collection::nft_exists(nft_addr), 1);

        // Burn NFT
        nft_collection::burn(owner, nft);

        // Verify NFT no longer exists
        assert!(!nft_collection::nft_exists(nft_addr), 2);
    }

    #[test(creator = @nft_strategy_addr, owner = @0x123, other = @0x456)]
    #[expected_failure(abort_code = 27, location = nft_strategy_addr::nft_collection)]
    fun test_burn_not_owner_fails(
        creator: &signer, owner: &signer, other: &signer
    ) {
        let creator_addr = signer::address_of(creator);
        let owner_addr = signer::address_of(owner);
        let other_addr = signer::address_of(other);
        account::create_account_for_test(creator_addr);
        account::create_account_for_test(owner_addr);
        account::create_account_for_test(other_addr);

        nft_collection::create_collection(creator, string::utf8(b"Test collection"));
        nft_collection::mint(creator, owner_addr);

        let collection_addr = nft_collection::get_collection_address(creator_addr);
        let nft_addr = nft_collection::get_nft_by_token_id(collection_addr, 1);
        let nft = object::address_to_object<nft_collection::NFT>(nft_addr);

        // Should fail - other is not the owner
        nft_collection::burn(other, nft);
    }

    // ============ View Function Tests ============
    #[test]
    fun test_get_max_supply() {
        assert!(nft_collection::get_max_supply() == 10000, 1);
    }

    #[test(creator = @nft_strategy_addr)]
    fun test_collection_exists_before_creation(creator: &signer) {
        let creator_addr = signer::address_of(creator);
        account::create_account_for_test(creator_addr);

        // Should not exist before creation
        assert!(!nft_collection::collection_exists(creator_addr), 1);
    }

    // ============ Marketplace Compatibility Test ============
    #[test(creator = @nft_strategy_addr, owner = @0x123, buyer = @0x456)]
    fun test_nft_is_marketplace_compatible(
        creator: &signer, owner: &signer, buyer: &signer
    ) {
        let creator_addr = signer::address_of(creator);
        let owner_addr = signer::address_of(owner);
        let buyer_addr = signer::address_of(buyer);
        account::create_account_for_test(creator_addr);
        account::create_account_for_test(owner_addr);
        account::create_account_for_test(buyer_addr);

        nft_collection::create_collection(creator, string::utf8(b"Test collection"));
        nft_collection::mint(creator, owner_addr);

        let collection_addr = nft_collection::get_collection_address(creator_addr);
        let nft_addr = nft_collection::get_nft_by_token_id(collection_addr, 1);

        // Get NFT as Object<NFT> - this is what marketplace expects
        let nft = object::address_to_object<nft_collection::NFT>(nft_addr);

        // Verify object operations work (same as marketplace uses)
        assert!(object::is_owner(nft, owner_addr), 1);
        assert!(object::object_address(&nft) == nft_addr, 2);

        // Verify standard object::transfer works
        object::transfer(owner, nft, buyer_addr);
        assert!(object::is_owner(nft, buyer_addr), 3);
    }
}

