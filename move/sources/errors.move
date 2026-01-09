module nft_strategy_addr::errors {

    // Pool errors
    const EPOOL_ALREADY_EXISTS: u64 = 1;
    const EPOOL_NOT_EXISTS: u64 = 2;
    const EINVALID_POOL_TYPE: u64 = 3;
    const EIDENTICAL_ADDRESSES: u64 = 4;

    // Liquidity errors
    const EINSUFFICIENT_LIQUIDITY_MINTED: u64 = 5;
    const EINSUFFICIENT_LIQUIDITY_BURNED: u64 = 6;
    const EINSUFFICIENT_OUTPUT_AMOUNT: u64 = 7;
    const EINSUFFICIENT_INPUT_AMOUNT: u64 = 8;
    const EINSUFFICIENT_LIQUIDITY: u64 = 9;

    // Swap errors
    const ESWAP_DEADLINE_EXCEEDED: u64 = 10;
    const EAMOUNT_OUT_TOO_SMALL: u64 = 11;
    const EAMOUNT_IN_TOO_LARGE: u64 = 12;
    const EINVALID_PATH: u64 = 13;
    const EZERO_AMOUNT: u64 = 14;

    // Math errors
    const EOVERFLOW: u64 = 15;
    const EDIVISION_BY_ZERO: u64 = 16;
    const ESQRT_OVERFLOW: u64 = 17;

    // Permission errors
    const ENOT_AUTHORIZED: u64 = 18;
    const ENOT_OWNER: u64 = 19;

    // Token errors
    const EINVALID_TOKEN_TYPE: u64 = 20;
    const ETOKEN_REGISTRATION_FAILED: u64 = 21;

    // Fee errors
    const EINVALID_FEE_PERCENTAGE: u64 = 22;
    const EINVALID_FEE_RECIPIENT: u64 = 23;
    const EINVALID_FEE_TOKEN: u64 = 24;

    // Marketplace errors
    const ELISTING_NOT_EXISTS: u64 = 25;
    const ELISTING_ALREADY_EXISTS: u64 = 26;
    const EINVALID_PRICE: u64 = 27;
    const ENFT_NOT_OWNED: u64 = 28;
    const ENOT_SELLER: u64 = 29;
    const ESELLER_CANNOT_BUY: u64 = 30;
    const EMARKETPLACE_NOT_INITIALIZED: u64 = 31;
    const EMARKETPLACE_ALREADY_INITIALIZED: u64 = 32;

    // NFT Collection errors
    const ECOLLECTION_NOT_EXISTS: u64 = 33;
    const ECOLLECTION_ALREADY_EXISTS: u64 = 34;
    const EMAX_SUPPLY_REACHED: u64 = 35;
    const ENOT_COLLECTION_CREATOR: u64 = 36;
    const EINVALID_TOKEN_ID: u64 = 37;

    public fun pool_already_exists(): u64 {
        EPOOL_ALREADY_EXISTS
    }

    public fun pool_not_exists(): u64 {
        EPOOL_NOT_EXISTS
    }

    public fun invalid_pool_type(): u64 {
        EINVALID_POOL_TYPE
    }

    public fun identical_addresses(): u64 {
        EIDENTICAL_ADDRESSES
    }

    public fun insufficient_liquidity_minted(): u64 {
        EINSUFFICIENT_LIQUIDITY_MINTED
    }

    public fun insufficient_liquidity_burned(): u64 {
        EINSUFFICIENT_LIQUIDITY_BURNED
    }

    public fun insufficient_output_amount(): u64 {
        EINSUFFICIENT_OUTPUT_AMOUNT
    }

    public fun insufficient_input_amount(): u64 {
        EINSUFFICIENT_INPUT_AMOUNT
    }

    public fun insufficient_liquidity(): u64 {
        EINSUFFICIENT_LIQUIDITY
    }

    public fun swap_deadline_exceeded(): u64 {
        ESWAP_DEADLINE_EXCEEDED
    }

    public fun amount_out_too_small(): u64 {
        EAMOUNT_OUT_TOO_SMALL
    }

    public fun amount_in_too_large(): u64 {
        EAMOUNT_IN_TOO_LARGE
    }

    public fun invalid_path(): u64 {
        EINVALID_PATH
    }

    public fun zero_amount(): u64 {
        EZERO_AMOUNT
    }

    public fun overflow(): u64 {
        EOVERFLOW
    }

    public fun division_by_zero(): u64 {
        EDIVISION_BY_ZERO
    }

    public fun sqrt_overflow(): u64 {
        ESQRT_OVERFLOW
    }

    public fun not_authorized(): u64 {
        ENOT_AUTHORIZED
    }

    public fun not_owner(): u64 {
        ENOT_OWNER
    }

    public fun invalid_token_type(): u64 {
        EINVALID_TOKEN_TYPE
    }

    public fun token_registration_failed(): u64 {
        ETOKEN_REGISTRATION_FAILED
    }

    public fun invalid_fee_percentage(): u64 {
        EINVALID_FEE_PERCENTAGE
    }

    public fun invalid_fee_recipient(): u64 {
        EINVALID_FEE_RECIPIENT
    }

    public fun invalid_fee_token(): u64 {
        EINVALID_FEE_TOKEN
    }

    public fun listing_not_exists(): u64 {
        ELISTING_NOT_EXISTS
    }

    public fun listing_already_exists(): u64 {
        ELISTING_ALREADY_EXISTS
    }

    public fun invalid_price(): u64 {
        EINVALID_PRICE
    }

    public fun nft_not_owned(): u64 {
        ENFT_NOT_OWNED
    }

    public fun not_seller(): u64 {
        ENOT_SELLER
    }

    public fun seller_cannot_buy(): u64 {
        ESELLER_CANNOT_BUY
    }

    public fun marketplace_not_initialized(): u64 {
        EMARKETPLACE_NOT_INITIALIZED
    }

    public fun marketplace_already_initialized(): u64 {
        EMARKETPLACE_ALREADY_INITIALIZED
    }

    public fun collection_not_exists(): u64 {
        ECOLLECTION_NOT_EXISTS
    }

    public fun collection_already_exists(): u64 {
        ECOLLECTION_ALREADY_EXISTS
    }

    public fun max_supply_reached(): u64 {
        EMAX_SUPPLY_REACHED
    }

    public fun not_collection_creator(): u64 {
        ENOT_COLLECTION_CREATOR
    }

    public fun invalid_token_id(): u64 {
        EINVALID_TOKEN_ID
    }
}

