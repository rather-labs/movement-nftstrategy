/// NFT Strategy Module
/// Allows anyone to trigger automated strategy actions on behalf of the treasury.
/// Key features:
/// - Buy floor NFT from marketplace using treasury WMOVE
/// - Relist purchased NFT with 10% premium
/// - All actions are permissionless but operate on treasury funds
module nft_strategy_addr::strategy {
    use std::signer;
    use aptos_framework::object::{Self, Object, ExtendRef};
    use aptos_framework::primary_fungible_store;
    use aptos_framework::event;

    use nft_strategy_addr::wmove;
    use nft_strategy_addr::marketplace;

    // ============ Constants ============

    /// Relist premium in basis points (1000 = 10%)
    const RELIST_PREMIUM_BPS: u64 = 1000;

    /// Basis points denominator (10000 = 100%)
    const BPS_DENOMINATOR: u64 = 10000;

    // ============ Error Codes ============

    const ESTRATEGY_NOT_INITIALIZED: u64 = 100;
    const ESTRATEGY_ALREADY_INITIALIZED: u64 = 101;
    const EINSUFFICIENT_TREASURY_BALANCE: u64 = 102;
    const ENFT_NOT_LISTED: u64 = 103;
    const EINVALID_TREASURY_ADDRESS: u64 = 104;
    const ETREASURY_CANNOT_BUY_OWN_LISTING: u64 = 105;

    // ============ Data Structures ============

    /// Strategy configuration stored at module address
    struct Strategy has key {
        /// ExtendRef for the treasury signer (allows signing on behalf of treasury)
        treasury_extend_ref: ExtendRef,
        /// Treasury object address
        treasury_address: address,
        /// Total floor buys executed
        total_floor_buys: u64,
        /// Total WMOVE spent on floor buys
        total_wmove_spent: u64,
        /// Admin address that can update settings
        admin: address
    }

    // ============ Events ============
    #[event]
    struct FloorBuyExecuted has drop, store {
        nft_address: address,
        purchase_price: u64,
        relist_price: u64,
        executor: address
    }

    #[event]
    struct StrategyInitialized has drop, store {
        treasury_address: address,
        admin: address
    }

    // ============ Initialization ============

    /// Initialize the strategy with a treasury object
    /// Creates a named object with seed "TREASURY" for deterministic addressing
    /// The treasury address can be computed using get_treasury_address_preview()
    public entry fun initialize(admin: &signer) {
        let admin_addr = signer::address_of(admin);

        // Ensure strategy is not already initialized
        assert!(!exists<Strategy>(@nft_strategy_addr), ESTRATEGY_ALREADY_INITIALIZED);

        // Create a named treasury object at the module address for deterministic addressing
        // The treasury address will be: object::create_object_address(&@nft_strategy_addr, b"TREASURY")
        let constructor_ref = object::create_named_object(admin, b"TREASURY");
        let extend_ref = object::generate_extend_ref(&constructor_ref);
        let treasury_signer = object::generate_signer(&constructor_ref);
        let treasury_address = signer::address_of(&treasury_signer);

        // Store strategy configuration at module address
        move_to(
            admin,
            Strategy {
                treasury_extend_ref: extend_ref,
                treasury_address,
                total_floor_buys: 0,
                total_wmove_spent: 0,
                admin: admin_addr
            }
        );

        event::emit(StrategyInitialized { treasury_address, admin: admin_addr });
    }

    #[view]
    /// Preview the treasury address before initialization
    /// This allows you to know the treasury address ahead of time
    /// The address is deterministic based on the admin address and "TREASURY" seed
    public fun get_treasury_address_preview(admin_addr: address): address {
        object::create_object_address(&admin_addr, b"TREASURY")
    }

    // ============ Strategy Actions ============

    /// Buy the floor NFT and relist with 10% premium
    /// Can be called by anyone - uses treasury funds
    ///
    /// Steps:
    /// 1. Get treasury WMOVE balance
    /// 2. Unwrap required WMOVE to native MOVE
    /// 3. Buy the NFT from marketplace
    /// 4. Relist NFT at purchase_price * 1.10 (10% premium)
    public entry fun buy_floor_and_relist<T: key>(
        executor: &signer, nft: Object<T>
    ) acquires Strategy {
        assert!(exists<Strategy>(@nft_strategy_addr), ESTRATEGY_NOT_INITIALIZED);

        let strategy = borrow_global_mut<Strategy>(@nft_strategy_addr);
        let treasury_signer =
            object::generate_signer_for_extending(&strategy.treasury_extend_ref);
        let treasury_addr = strategy.treasury_address;

        // Get listing info (seller, price)
        let nft_address = object::object_address(&nft);
        let (seller, price) = marketplace::get_listing(nft_address);

        // Verify we're not buying our own listing
        assert!(seller != treasury_addr, ETREASURY_CANNOT_BUY_OWN_LISTING);

        // Get WMOVE metadata and check treasury balance
        let wmove_metadata = wmove::get_metadata();
        let treasury_wmove_balance =
            primary_fungible_store::balance(treasury_addr, wmove_metadata);
        assert!(treasury_wmove_balance >= price, EINSUFFICIENT_TREASURY_BALANCE);

        // Step 1: Unwrap WMOVE to native MOVE from treasury
        // First withdraw WMOVE from treasury to executor, then unwrap
        let wmove_fa =
            primary_fungible_store::withdraw(&treasury_signer, wmove_metadata, price);
        let executor_addr = signer::address_of(executor);
        primary_fungible_store::deposit(executor_addr, wmove_fa);

        // Unwrap WMOVE to MOVE (as executor who now has the WMOVE)
        wmove::unwrap(executor, price);

        // Step 2: Buy NFT from marketplace (executor pays with the MOVE they received)
        marketplace::buy_nft_internal<T>(executor, nft);

        // Step 3: Calculate relist price with 10% premium
        let relist_price = price + ((price * RELIST_PREMIUM_BPS) / BPS_DENOMINATOR);

        // Step 4: Transfer NFT from executor to treasury first
        object::transfer(executor, nft, treasury_addr);

        // Step 5: List NFT on marketplace from treasury at premium price
        marketplace::list_nft_internal<T>(&treasury_signer, nft, relist_price);

        // Update stats
        strategy.total_floor_buys = strategy.total_floor_buys + 1;
        strategy.total_wmove_spent = strategy.total_wmove_spent + price;

        // Emit event
        event::emit(
            FloorBuyExecuted {
                nft_address,
                purchase_price: price,
                relist_price,
                executor: executor_addr
            }
        );
    }

    // ============ View Functions ============
    #[view]
    /// Get strategy statistics
    public fun get_strategy_info(): (address, u64, u64) acquires Strategy {
        assert!(exists<Strategy>(@nft_strategy_addr), ESTRATEGY_NOT_INITIALIZED);

        let strategy = borrow_global<Strategy>(@nft_strategy_addr);
        (
            strategy.treasury_address,
            strategy.total_floor_buys,
            strategy.total_wmove_spent
        )
    }

    #[view]
    /// Get treasury address
    public fun get_treasury_address(): address acquires Strategy {
        assert!(exists<Strategy>(@nft_strategy_addr), ESTRATEGY_NOT_INITIALIZED);

        let strategy = borrow_global<Strategy>(@nft_strategy_addr);
        strategy.treasury_address
    }

    #[view]
    /// Get treasury WMOVE balance
    public fun get_treasury_wmove_balance(): u64 acquires Strategy {
        assert!(exists<Strategy>(@nft_strategy_addr), ESTRATEGY_NOT_INITIALIZED);

        let strategy = borrow_global<Strategy>(@nft_strategy_addr);
        let wmove_metadata = wmove::get_metadata();
        primary_fungible_store::balance(strategy.treasury_address, wmove_metadata)
    }

    #[view]
    /// Check if strategy is initialized
    public fun is_initialized(): bool {
        exists<Strategy>(@nft_strategy_addr)
    }

    // ============ Admin Functions ============

    /// Deposit WMOVE into treasury (anyone can deposit)
    public entry fun deposit_wmove(depositor: &signer, amount: u64) acquires Strategy {
        assert!(exists<Strategy>(@nft_strategy_addr), ESTRATEGY_NOT_INITIALIZED);

        let strategy = borrow_global<Strategy>(@nft_strategy_addr);
        let wmove_metadata = wmove::get_metadata();

        // Withdraw WMOVE from depositor and deposit to treasury
        let wmove_fa = primary_fungible_store::withdraw(
            depositor, wmove_metadata, amount
        );
        primary_fungible_store::deposit(strategy.treasury_address, wmove_fa);
    }

    /// Wrap native MOVE and deposit into treasury
    public entry fun wrap_and_deposit(depositor: &signer, amount: u64) acquires Strategy {
        assert!(exists<Strategy>(@nft_strategy_addr), ESTRATEGY_NOT_INITIALIZED);

        // First wrap MOVE to WMOVE
        wmove::wrap(depositor, amount);

        // Then deposit WMOVE to treasury
        deposit_wmove(depositor, amount);
    }
}

