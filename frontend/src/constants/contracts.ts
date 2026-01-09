// Movement Contract Module Address
// This is the address where the Move modules are deployed
export const MODULE_ADDRESS =
  process.env.NEXT_PUBLIC_MODULE_ADDRESS ||
  '0x9154cb2a67d450d566e5edfa1c8b711120b96f8ca3f9239f8c626be936dbb171';

// Module names
export const MODULES = {
  NFT_COLLECTION: 'nft_collection',
  MARKETPLACE: 'marketplace',
  POOL: 'pool',
  FACTORY: 'factory',
  LP_TOKEN: 'lp_token',
  RATHER_TOKEN: 'rather_token',
  WMOVE: 'wmove',
  VAULT: 'vault',
} as const;

// Helper to build function IDs
export const buildFunctionId = (
  moduleName: string,
  functionName: string
): `${string}::${string}::${string}` => {
  return `${MODULE_ADDRESS}::${moduleName}::${functionName}`;
};

// NFT Collection functions
export const NFT_FUNCTIONS = {
  CREATE_COLLECTION: buildFunctionId(MODULES.NFT_COLLECTION, 'create_collection'),
  MINT: buildFunctionId(MODULES.NFT_COLLECTION, 'mint'),
  MINT_BATCH: buildFunctionId(MODULES.NFT_COLLECTION, 'mint_batch'),
  TRANSFER: buildFunctionId(MODULES.NFT_COLLECTION, 'transfer'),
  BURN: buildFunctionId(MODULES.NFT_COLLECTION, 'burn'),
  // View functions
  GET_COLLECTION_ADDRESS: buildFunctionId(MODULES.NFT_COLLECTION, 'get_collection_address'),
  GET_COLLECTION_INFO: buildFunctionId(MODULES.NFT_COLLECTION, 'get_collection_info'),
  GET_NFT_INFO: buildFunctionId(MODULES.NFT_COLLECTION, 'get_nft_info'),
  TOKEN_URI: buildFunctionId(MODULES.NFT_COLLECTION, 'token_uri'),
  GET_OWNER: buildFunctionId(MODULES.NFT_COLLECTION, 'get_owner'),
  GET_NFT_BY_TOKEN_ID: buildFunctionId(MODULES.NFT_COLLECTION, 'get_nft_by_token_id'),
  COLLECTION_EXISTS: buildFunctionId(MODULES.NFT_COLLECTION, 'collection_exists'),
  GET_CURRENT_SUPPLY: buildFunctionId(MODULES.NFT_COLLECTION, 'get_current_supply'),
  GET_MAX_SUPPLY: buildFunctionId(MODULES.NFT_COLLECTION, 'get_max_supply'),
  NFT_EXISTS: buildFunctionId(MODULES.NFT_COLLECTION, 'nft_exists'),
} as const;

// Marketplace functions
export const MARKETPLACE_FUNCTIONS = {
  INITIALIZE: buildFunctionId(MODULES.MARKETPLACE, 'initialize'),
  SET_FEE_BPS: buildFunctionId(MODULES.MARKETPLACE, 'set_fee_bps'),
  SET_FEE_RECIPIENT: buildFunctionId(MODULES.MARKETPLACE, 'set_fee_recipient'),
  SET_ADMIN: buildFunctionId(MODULES.MARKETPLACE, 'set_admin'),
  LIST_NFT: buildFunctionId(MODULES.MARKETPLACE, 'list_nft'),
  CANCEL_LISTING: buildFunctionId(MODULES.MARKETPLACE, 'cancel_listing'),
  UPDATE_PRICE: buildFunctionId(MODULES.MARKETPLACE, 'update_price'),
  BUY_NFT: buildFunctionId(MODULES.MARKETPLACE, 'buy_nft'),
  // View functions
  GET_LISTING: buildFunctionId(MODULES.MARKETPLACE, 'get_listing'),
  IS_LISTED: buildFunctionId(MODULES.MARKETPLACE, 'is_listed'),
  GET_MARKETPLACE_INFO: buildFunctionId(MODULES.MARKETPLACE, 'get_marketplace_info'),
  CALCULATE_FEE: buildFunctionId(MODULES.MARKETPLACE, 'calculate_fee'),
  IS_INITIALIZED: buildFunctionId(MODULES.MARKETPLACE, 'is_initialized'),
} as const;

// Pool functions
export const POOL_FUNCTIONS = {
  CREATE_POOL: buildFunctionId(MODULES.POOL, 'create_pool'),
  CREATE_POOL_ENTRY: buildFunctionId(MODULES.POOL, 'create_pool_entry'),
  ADD_LIQUIDITY_ENTRY: buildFunctionId(MODULES.POOL, 'add_liquidity_entry'),
  REMOVE_LIQUIDITY_ENTRY: buildFunctionId(MODULES.POOL, 'remove_liquidity_entry'),
  SWAP_X_TO_Y_ENTRY: buildFunctionId(MODULES.POOL, 'swap_x_to_y_entry'),
  SWAP_Y_TO_X_ENTRY: buildFunctionId(MODULES.POOL, 'swap_y_to_x_entry'),
  // View functions
  GET_RESERVES: buildFunctionId(MODULES.POOL, 'get_reserves'),
  GET_FEE_INFO: buildFunctionId(MODULES.POOL, 'get_fee_info'),
  EXISTS_POOL: buildFunctionId(MODULES.POOL, 'exists_pool'),
  QUOTE_SWAP_X_TO_Y: buildFunctionId(MODULES.POOL, 'quote_swap_x_to_y'),
  QUOTE_SWAP_Y_TO_X: buildFunctionId(MODULES.POOL, 'quote_swap_y_to_x'),
} as const;

// Factory functions
export const FACTORY_FUNCTIONS = {
  INITIALIZE: buildFunctionId(MODULES.FACTORY, 'initialize'),
  CREATE_POOL: buildFunctionId(MODULES.FACTORY, 'create_pool'),
  GET_POOL: buildFunctionId(MODULES.FACTORY, 'get_pool'),
  ALL_POOLS_LENGTH: buildFunctionId(MODULES.FACTORY, 'all_pools_length'),
} as const;

// LP Token functions
export const LP_TOKEN_FUNCTIONS = {
  GET_BALANCE: buildFunctionId(MODULES.LP_TOKEN, 'get_balance'),
  GET_SUPPLY: buildFunctionId(MODULES.LP_TOKEN, 'get_supply'),
  GET_METADATA: buildFunctionId(MODULES.LP_TOKEN, 'get_metadata'),
} as const;

// Rather Token functions
export const RATHER_TOKEN_FUNCTIONS = {
  MINT_ENTRY: buildFunctionId(MODULES.RATHER_TOKEN, 'mint_entry'),
  BURN_ENTRY: buildFunctionId(MODULES.RATHER_TOKEN, 'burn_entry'),
  GET_BALANCE: buildFunctionId(MODULES.RATHER_TOKEN, 'get_balance'),
  BALANCE_OF: buildFunctionId(MODULES.RATHER_TOKEN, 'balance_of'),
  GET_TOTAL_SUPPLY: buildFunctionId(MODULES.RATHER_TOKEN, 'get_total_supply'),
  GET_METADATA: buildFunctionId(MODULES.RATHER_TOKEN, 'get_metadata'),
  GET_CURRENT_SUPPLY: buildFunctionId(MODULES.RATHER_TOKEN, 'get_current_supply'),
  GET_TOTAL_MINTED: buildFunctionId(MODULES.RATHER_TOKEN, 'get_total_minted'),
  GET_TOTAL_BURNED: buildFunctionId(MODULES.RATHER_TOKEN, 'get_total_burned'),
} as const;

// WMOVE functions
export const WMOVE_FUNCTIONS = {
  WRAP: buildFunctionId(MODULES.WMOVE, 'wrap'),
  UNWRAP: buildFunctionId(MODULES.WMOVE, 'unwrap'),
  GET_METADATA: buildFunctionId(MODULES.WMOVE, 'get_metadata'),
  GET_RESERVE: buildFunctionId(MODULES.WMOVE, 'get_reserve'),
  GET_TOTAL_SUPPLY: buildFunctionId(MODULES.WMOVE, 'get_total_supply'),
  BALANCE_OF: buildFunctionId(MODULES.WMOVE, 'balance_of'),
} as const;

// Type arguments for pool operations
export const TYPE_ARGUMENTS = {
  NFT: `${MODULE_ADDRESS}::${MODULES.NFT_COLLECTION}::NFT`,
  RATHER_TOKEN: `${MODULE_ADDRESS}::${MODULES.RATHER_TOKEN}::RatherToken`,
  WMOVE: `${MODULE_ADDRESS}::${MODULES.WMOVE}::WMOVE`,
} as const;

// Treasury address for strategy fees
export const TREASURY_ADDRESS =
  '0x1ed06520719f004c44597b27ffd2f6034d2bffef050d2e2b41f8fecfa7cdeb0b';
