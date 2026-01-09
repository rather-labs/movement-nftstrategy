#[test_only]
module nft_strategy_addr::marketplace_test {
    use std::signer;
    use std::string;
    use aptos_framework::account;
    use aptos_framework::aptos_coin::{Self, AptosCoin};
    use aptos_framework::coin;
    use aptos_framework::object::{Self, Object};

    use nft_strategy_addr::marketplace;

    // ============ Test NFT Structure ============

    // Simple test NFT for marketplace testing
    #[resource_group_member(group = aptos_framework::object::ObjectGroup)]
    struct TestNFT has key {
        name: string::String
    }

    /// Create a test NFT and return the object
    fun create_test_nft(creator: &signer, name: vector<u8>): Object<TestNFT> {
        let constructor_ref = object::create_object(signer::address_of(creator));
        let nft_signer = object::generate_signer(&constructor_ref);

        move_to(&nft_signer, TestNFT { name: string::utf8(name) });

        object::object_from_constructor_ref<TestNFT>(&constructor_ref)
    }

    // ============ Test Setup Helpers ============
    fun setup_test_accounts(
        aptos_framework: &signer, admin: &signer, seller: &signer, buyer: &signer
    ) {
        // Initialize AptosCoin
        let (burn_cap, mint_cap) = aptos_coin::initialize_for_test(aptos_framework);

        // Create accounts
        account::create_account_for_test(signer::address_of(admin));
        account::create_account_for_test(signer::address_of(seller));
        account::create_account_for_test(signer::address_of(buyer));

        // Register coin stores
        coin::register<AptosCoin>(admin);
        coin::register<AptosCoin>(seller);
        coin::register<AptosCoin>(buyer);

        // Mint coins to buyer (1000 MOVE)
        let coins = coin::mint<AptosCoin>(100000000000, &mint_cap); // 1000 MOVE with 8 decimals
        coin::deposit(signer::address_of(buyer), coins);

        // Mint some coins to admin for fee recipient testing
        let admin_coins = coin::mint<AptosCoin>(10000000000, &mint_cap); // 100 MOVE
        coin::deposit(signer::address_of(admin), admin_coins);

        // Clean up capabilities
        coin::destroy_burn_cap(burn_cap);
        coin::destroy_mint_cap(mint_cap);
    }

    // ============ Initialization Tests ============
    #[test(aptos_framework = @aptos_framework, admin = @nft_strategy_addr)]
    fun test_initialize_marketplace(
        aptos_framework: &signer, admin: &signer
    ) {
        let seller = account::create_account_for_test(@0x123);
        let buyer = account::create_account_for_test(@0x456);
        setup_test_accounts(aptos_framework, admin, &seller, &buyer);

        // Initialize marketplace
        marketplace::initialize(admin, 250, signer::address_of(admin)); // 2.5% fee

        // Verify initialization
        assert!(marketplace::is_initialized(), 1);

        let (
            fee_bps, fee_recipient, admin_addr, total_sales
        ) = marketplace::get_marketplace_info();
        assert!(fee_bps == 250, 2);
        assert!(fee_recipient == signer::address_of(admin), 3);
        assert!(admin_addr == signer::address_of(admin), 4);
        assert!(total_sales == 0, 5);
    }

    #[test(aptos_framework = @aptos_framework, admin = @nft_strategy_addr)]
    #[expected_failure(abort_code = 31, location = nft_strategy_addr::marketplace)]
    fun test_initialize_twice_fails(
        aptos_framework: &signer, admin: &signer
    ) {
        let seller = account::create_account_for_test(@0x123);
        let buyer = account::create_account_for_test(@0x456);
        setup_test_accounts(aptos_framework, admin, &seller, &buyer);

        marketplace::initialize(admin, 250, signer::address_of(admin));
        // Should fail - already initialized
        marketplace::initialize(admin, 300, signer::address_of(admin));
    }

    #[test(aptos_framework = @aptos_framework, admin = @nft_strategy_addr)]
    #[expected_failure(abort_code = 22, location = nft_strategy_addr::marketplace)]
    fun test_initialize_invalid_fee_fails(
        aptos_framework: &signer, admin: &signer
    ) {
        let seller = account::create_account_for_test(@0x123);
        let buyer = account::create_account_for_test(@0x456);
        setup_test_accounts(aptos_framework, admin, &seller, &buyer);

        // Fee too high (>10%)
        marketplace::initialize(admin, 1500, signer::address_of(admin));
    }

    // ============ Listing Tests ============
    #[test(aptos_framework = @aptos_framework, admin = @nft_strategy_addr, seller = @0x123)]
    fun test_list_nft(
        aptos_framework: &signer, admin: &signer, seller: &signer
    ) {
        let buyer = account::create_account_for_test(@0x456);
        setup_test_accounts(aptos_framework, admin, seller, &buyer);

        marketplace::initialize(admin, 250, signer::address_of(admin));

        // Create and list NFT
        let nft = create_test_nft(seller, b"Test NFT #1");
        let nft_address = object::object_address(&nft);

        marketplace::list_nft(seller, nft, 10000000000); // 100 MOVE

        // Verify listing
        assert!(marketplace::is_listed(nft_address), 1);
        let (listed_seller, price) = marketplace::get_listing(nft_address);
        assert!(listed_seller == signer::address_of(seller), 2);
        assert!(price == 10000000000, 3);
    }

    #[test(aptos_framework = @aptos_framework, admin = @nft_strategy_addr, seller = @0x123)]
    #[expected_failure(abort_code = 26, location = nft_strategy_addr::marketplace)]
    fun test_list_zero_price_fails(
        aptos_framework: &signer, admin: &signer, seller: &signer
    ) {
        let buyer = account::create_account_for_test(@0x456);
        setup_test_accounts(aptos_framework, admin, seller, &buyer);

        marketplace::initialize(admin, 250, signer::address_of(admin));

        let nft = create_test_nft(seller, b"Test NFT #1");
        // Should fail - zero price
        marketplace::list_nft(seller, nft, 0);
    }

    #[test(aptos_framework = @aptos_framework, admin = @nft_strategy_addr, seller = @0x123)]
    #[expected_failure(abort_code = 27, location = nft_strategy_addr::marketplace)]
    fun test_list_already_listed_fails(
        aptos_framework: &signer, admin: &signer, seller: &signer
    ) {
        let buyer = account::create_account_for_test(@0x456);
        setup_test_accounts(aptos_framework, admin, seller, &buyer);

        marketplace::initialize(admin, 250, signer::address_of(admin));

        let nft = create_test_nft(seller, b"Test NFT #1");
        marketplace::list_nft(seller, nft, 10000000000);
        // Should fail - NFT no longer owned by seller (transferred to escrow)
        // This correctly triggers ENFT_NOT_OWNED (27) before ELISTING_ALREADY_EXISTS (25)
        marketplace::list_nft(seller, nft, 20000000000);
    }

    // ============ Cancel Listing Tests ============
    #[test(aptos_framework = @aptos_framework, admin = @nft_strategy_addr, seller = @0x123)]
    fun test_cancel_listing(
        aptos_framework: &signer, admin: &signer, seller: &signer
    ) {
        let buyer = account::create_account_for_test(@0x456);
        setup_test_accounts(aptos_framework, admin, seller, &buyer);

        marketplace::initialize(admin, 250, signer::address_of(admin));

        let nft = create_test_nft(seller, b"Test NFT #1");
        let nft_address = object::object_address(&nft);

        marketplace::list_nft(seller, nft, 10000000000);
        assert!(marketplace::is_listed(nft_address), 1);

        // Cancel listing
        marketplace::cancel_listing(seller, nft);

        // Verify NFT returned to seller and listing removed
        assert!(!marketplace::is_listed(nft_address), 2);
        assert!(object::is_owner(nft, signer::address_of(seller)), 3);
    }

    #[
        test(
            aptos_framework = @aptos_framework,
            admin = @nft_strategy_addr,
            seller = @0x123,
            other = @0x789
        )
    ]
    #[expected_failure(abort_code = 28, location = nft_strategy_addr::marketplace)]
    fun test_cancel_listing_not_seller_fails(
        aptos_framework: &signer, admin: &signer, seller: &signer, other: &signer
    ) {
        let buyer = account::create_account_for_test(@0x456);
        setup_test_accounts(aptos_framework, admin, seller, &buyer);
        account::create_account_for_test(signer::address_of(other));

        marketplace::initialize(admin, 250, signer::address_of(admin));

        let nft = create_test_nft(seller, b"Test NFT #1");
        marketplace::list_nft(seller, nft, 10000000000);

        // Should fail - not the seller
        marketplace::cancel_listing(other, nft);
    }

    // ============ Update Price Tests ============
    #[test(aptos_framework = @aptos_framework, admin = @nft_strategy_addr, seller = @0x123)]
    fun test_update_price(
        aptos_framework: &signer, admin: &signer, seller: &signer
    ) {
        let buyer = account::create_account_for_test(@0x456);
        setup_test_accounts(aptos_framework, admin, seller, &buyer);

        marketplace::initialize(admin, 250, signer::address_of(admin));

        let nft = create_test_nft(seller, b"Test NFT #1");
        let nft_address = object::object_address(&nft);

        marketplace::list_nft(seller, nft, 10000000000);

        // Update price
        marketplace::update_price(seller, nft, 15000000000); // 150 MOVE

        let (_, price) = marketplace::get_listing(nft_address);
        assert!(price == 15000000000, 1);
    }

    #[test(aptos_framework = @aptos_framework, admin = @nft_strategy_addr, seller = @0x123)]
    #[expected_failure(abort_code = 26, location = nft_strategy_addr::marketplace)]
    fun test_update_price_zero_fails(
        aptos_framework: &signer, admin: &signer, seller: &signer
    ) {
        let buyer = account::create_account_for_test(@0x456);
        setup_test_accounts(aptos_framework, admin, seller, &buyer);

        marketplace::initialize(admin, 250, signer::address_of(admin));

        let nft = create_test_nft(seller, b"Test NFT #1");
        marketplace::list_nft(seller, nft, 10000000000);

        // Should fail - zero price
        marketplace::update_price(seller, nft, 0);
    }

    // ============ Purchase Tests ============
    #[
        test(
            aptos_framework = @aptos_framework,
            admin = @nft_strategy_addr,
            seller = @0x123,
            buyer = @0x456
        )
    ]
    fun test_buy_nft(
        aptos_framework: &signer, admin: &signer, seller: &signer, buyer: &signer
    ) {
        setup_test_accounts(aptos_framework, admin, seller, buyer);

        let admin_addr = signer::address_of(admin);
        let seller_addr = signer::address_of(seller);
        let buyer_addr = signer::address_of(buyer);

        marketplace::initialize(admin, 250, admin_addr); // 2.5% fee

        let nft = create_test_nft(seller, b"Test NFT #1");
        let nft_address = object::object_address(&nft);
        let price: u64 = 10000000000; // 100 MOVE

        marketplace::list_nft(seller, nft, price);

        // Record balances before purchase
        let buyer_balance_before = coin::balance<AptosCoin>(buyer_addr);
        let seller_balance_before = coin::balance<AptosCoin>(seller_addr);
        let admin_balance_before = coin::balance<AptosCoin>(admin_addr);

        // Buy NFT
        marketplace::buy_nft(buyer, nft);

        // Verify NFT transferred to buyer
        assert!(object::is_owner(nft, buyer_addr), 1);
        assert!(!marketplace::is_listed(nft_address), 2);

        // Verify payment: 100 MOVE price, 2.5% fee = 2.5 MOVE fee
        let expected_fee = 250000000; // 2.5 MOVE
        let expected_seller_payment = price - expected_fee; // 97.5 MOVE

        let buyer_balance_after = coin::balance<AptosCoin>(buyer_addr);
        let seller_balance_after = coin::balance<AptosCoin>(seller_addr);
        let admin_balance_after = coin::balance<AptosCoin>(admin_addr);

        assert!(
            buyer_balance_before - buyer_balance_after == price, 3
        );
        assert!(
            seller_balance_after - seller_balance_before == expected_seller_payment,
            4
        );
        assert!(
            admin_balance_after - admin_balance_before == expected_fee, 5
        );

        // Verify total sales incremented
        let (_, _, _, total_sales) = marketplace::get_marketplace_info();
        assert!(total_sales == 1, 6);
    }

    #[
        test(
            aptos_framework = @aptos_framework,
            admin = @nft_strategy_addr,
            seller = @0x123,
            buyer = @0x456
        )
    ]
    #[expected_failure(abort_code = 29, location = nft_strategy_addr::marketplace)]
    fun test_seller_cannot_buy_own_nft(
        aptos_framework: &signer, admin: &signer, seller: &signer, buyer: &signer
    ) {
        setup_test_accounts(aptos_framework, admin, seller, buyer);

        // Give seller some coins to attempt purchase (swap balances)
        // Seller needs coins for this test - we use buyer's setup

        marketplace::initialize(admin, 250, signer::address_of(admin));

        let nft = create_test_nft(seller, b"Test NFT #1");
        marketplace::list_nft(seller, nft, 10000000000);

        // Transfer coins from buyer to seller for this test
        let coins = coin::withdraw<AptosCoin>(buyer, 100000000000);
        coin::deposit(signer::address_of(seller), coins);

        // Should fail - seller cannot buy own NFT
        marketplace::buy_nft(seller, nft);
    }

    // ============ Admin Function Tests ============
    #[test(aptos_framework = @aptos_framework, admin = @nft_strategy_addr)]
    fun test_set_fee_bps(aptos_framework: &signer, admin: &signer) {
        let seller = account::create_account_for_test(@0x123);
        let buyer = account::create_account_for_test(@0x456);
        setup_test_accounts(aptos_framework, admin, &seller, &buyer);

        marketplace::initialize(admin, 250, signer::address_of(admin));

        // Update fee
        marketplace::set_fee_bps(admin, 500); // 5%

        let (fee_bps, _, _, _) = marketplace::get_marketplace_info();
        assert!(fee_bps == 500, 1);
    }

    #[test(aptos_framework = @aptos_framework, admin = @nft_strategy_addr, other = @0x789)]
    #[expected_failure(abort_code = 18, location = nft_strategy_addr::marketplace)]
    fun test_set_fee_bps_not_admin_fails(
        aptos_framework: &signer, admin: &signer, other: &signer
    ) {
        let seller = account::create_account_for_test(@0x123);
        let buyer = account::create_account_for_test(@0x456);
        setup_test_accounts(aptos_framework, admin, &seller, &buyer);
        account::create_account_for_test(signer::address_of(other));

        marketplace::initialize(admin, 250, signer::address_of(admin));

        // Should fail - not admin
        marketplace::set_fee_bps(other, 500);
    }

    #[test(aptos_framework = @aptos_framework, admin = @nft_strategy_addr)]
    fun test_set_fee_recipient(aptos_framework: &signer, admin: &signer) {
        let seller = account::create_account_for_test(@0x123);
        let buyer = account::create_account_for_test(@0x456);
        setup_test_accounts(aptos_framework, admin, &seller, &buyer);

        let new_recipient = @0xABC;
        account::create_account_for_test(new_recipient);

        marketplace::initialize(admin, 250, signer::address_of(admin));

        // Update fee recipient
        marketplace::set_fee_recipient(admin, new_recipient);

        let (_, fee_recipient, _, _) = marketplace::get_marketplace_info();
        assert!(fee_recipient == new_recipient, 1);
    }

    #[test(aptos_framework = @aptos_framework, admin = @nft_strategy_addr)]
    fun test_set_admin(aptos_framework: &signer, admin: &signer) {
        let seller = account::create_account_for_test(@0x123);
        let buyer = account::create_account_for_test(@0x456);
        setup_test_accounts(aptos_framework, admin, &seller, &buyer);

        let new_admin = @0xDEF;
        account::create_account_for_test(new_admin);

        marketplace::initialize(admin, 250, signer::address_of(admin));

        // Transfer admin role
        marketplace::set_admin(admin, new_admin);

        let (_, _, admin_addr, _) = marketplace::get_marketplace_info();
        assert!(admin_addr == new_admin, 1);
    }

    // ============ View Function Tests ============
    #[test(aptos_framework = @aptos_framework, admin = @nft_strategy_addr, seller = @0x123)]
    fun test_calculate_fee(
        aptos_framework: &signer, admin: &signer, seller: &signer
    ) {
        let buyer = account::create_account_for_test(@0x456);
        setup_test_accounts(aptos_framework, admin, seller, &buyer);

        marketplace::initialize(admin, 250, signer::address_of(admin)); // 2.5%

        // 100 MOVE * 2.5% = 2.5 MOVE
        let fee = marketplace::calculate_fee(10000000000);
        assert!(fee == 250000000, 1);

        // 1000 MOVE * 2.5% = 25 MOVE
        let fee2 = marketplace::calculate_fee(100000000000);
        assert!(fee2 == 2500000000, 2);
    }

    #[test]
    fun test_is_initialized_before_init() {
        assert!(!marketplace::is_initialized(), 1);
    }
}

