##################################
# Fund the local-dev account
##################################
movement account fund-with-faucet --profile local-dev --amount 100000000
movement account balance --account ${MY_ADDR} --profile local-dev

##################################
# MOVE WRAPPER OPERATIONS
##################################

# Compile and publish the WMOVE module
movement move compile --skip-fetch-latest-git-deps

movement move publish \
  --profile local-dev \
  --skip-fetch-latest-git-deps \
  --assume-yes \
  --bytecode-version 6


## Set the deployer and second address
export MY_ADDR=0x07e4961db940fb1aaeddd59e4b396bf36c96cf6db5b298f7d8cbeba918cd72d6
export RECIPIENT_ADDR=0x1ed06520719f004c44597b27ffd2f6034d2bffef050d2e2b41f8fecfa7cdeb0b

# Wrap Move coin
movement move run \
  --function-id "${MY_ADDR}::wmove::wrap" \
  --args u64:10000000 \
  --profile local-dev \
  --assume-yes

# Check balance
movement move view \
  --function-id "${MY_ADDR}::wmove::balance_of" \
  --args "address:${MY_ADDR}" \
  --profile local-dev

##################################
# NFT COLLECTION OPERATIONS
##################################

# Create the collection (only once)
movement move run \
  --function-id "${MY_ADDR}::nft_collection::create_collection" \
  --args 'string:Rather Robots' \
  --profile local-dev

# Mint NFTs
movement move run \
  --function-id "${MY_ADDR}::nft_collection::mint" \
  --args address:"${MY_ADDR}" \
  --profile local-dev

# Collection state checks
movement move view \
  --function-id "${MY_ADDR}::nft_collection::collection_exists" \
  --args "address:${MY_ADDR}" \
  --profile local-dev

# Get collection address and current supply
COLLECTION_ADDR=$(movement move view \
  --function-id "${MY_ADDR}::nft_collection::get_collection_address" \
  --args "address:${MY_ADDR}" \
  --profile local-dev | jq -r '.Result[0]')

movement move view \
  --function-id "${MY_ADDR}::nft_collection::get_collection_info" \
  --args "address:${COLLECTION_ADDR}" \
  --profile local-dev

movement move view \
  --function-id "${MY_ADDR}::nft_collection::get_current_supply" \
  --args "address:${COLLECTION_ADDR}" \
  --profile local-dev

# Mint a second NFT to another account (local-dev-2)

movement move run \
  --function-id "${MY_ADDR}::nft_collection::mint" \
  --args address:"${RECIPIENT_ADDR}" \
  --profile local-dev

# Look up NFT by token id (token 1)
NFT1_ADDR=$(movement move view \
  --function-id "${MY_ADDR}::nft_collection::get_nft_by_token_id" \
  --args "address:${COLLECTION_ADDR}" u64:1 \
  --profile local-dev | jq -r '.Result[0]')

# Inspect NFT 1 owner and token_uri
movement move view \
  --function-id "${MY_ADDR}::nft_collection::get_owner" \
  --args "address:${NFT1_ADDR}" \
  --profile local-dev

movement move view \
  --function-id "${MY_ADDR}::nft_collection::token_uri" \
  --args "address:${NFT1_ADDR}" \
  --profile local-dev

# Transfer NFT 1 from creator to recipient (use creator signer)
movement move run \
  --function-id "${MY_ADDR}::nft_collection::transfer" \
  --args "address:${NFT1_ADDR}" address:"${RECIPIENT_ADDR}" \
  --profile local-dev

# Verify ownership after transfer
movement move view \
  --function-id "${MY_ADDR}::nft_collection::get_owner" \
  --args "address:${NFT1_ADDR}" \
  --profile local-dev

# Recipient (local-dev-2) transfers NFT back to creator
movement move run \
  --function-id "${MY_ADDR}::nft_collection::transfer" \
  --args "address:${NFT1_ADDR}" address:"${MY_ADDR}" \
  --profile local-dev-2

# Burn NFT 1 as creator
movement move run \
  --function-id "${MY_ADDR}::nft_collection::burn" \
  --args "address:${NFT1_ADDR}" \
  --profile local-dev

# Check current supply after burn
movement move view \
  --function-id "${MY_ADDR}::nft_collection::get_current_supply" \
  --args "address:${COLLECTION_ADDR}" \
  --profile local-dev

##########################################
# NFT MARKETPLACE OPERATIONS
##########################################

# Initialize marketplace (only once)
movement move run \
  --function-id "${MY_ADDR}::marketplace::initialize" \
  --args u64:250 address:"${MY_ADDR}" \
  --profile local-dev

# View marketplace config
movement move view \
  --function-id "${MY_ADDR}::marketplace::get_marketplace_info" \
  --profile local-dev

# Update fee and fee recipient (admin only)
movement move run \
  --function-id "${MY_ADDR}::marketplace::set_fee_bps" \
  --args u64:100 \
  --profile local-dev

movement move run \
  --function-id "${MY_ADDR}::marketplace::set_fee_recipient" \
  --args address:"${RECIPIENT_ADDR}" \
  --profile local-dev \
  --assume-yes

# Transfer admin to local-dev-2 (and back) to test admin handoff
movement move run \
  --function-id "${MY_ADDR}::marketplace::set_admin" \
  --args address:"${RECIPIENT_ADDR}" \
  --profile local-dev \
  --assume-yes

movement move run \
  --function-id "${MY_ADDR}::marketplace::set_admin" \
  --args address:"${MY_ADDR}" \
  --profile local-dev-2 \
  --assume-yes

# Mint a fresh NFT to list
movement move run \
  --function-id "${MY_ADDR}::nft_collection::mint" \
  --args address:"${MY_ADDR}" \
  --profile local-dev \
  --assume-yes

# Capture latest token id and NFT address
CURRENT_SUPPLY=$(movement move view \
  --function-id "${MY_ADDR}::nft_collection::get_current_supply" \
  --args "address:${COLLECTION_ADDR}" \
  --profile local-dev | jq -r '.Result[0]')

NFT_MARKET_ADDR=$(movement move view \
  --function-id "${MY_ADDR}::nft_collection::get_nft_by_token_id" \
  --args "address:${COLLECTION_ADDR}" u64:${CURRENT_SUPPLY} \
  --profile local-dev | jq -r '.Result[0]')

# List NFT for sale (creator as seller)
movement move run \
  --function-id "${MY_ADDR}::marketplace::list_nft" \
  --type-args "${MY_ADDR}::nft_collection::NFT" \
  --args "address:${NFT_MARKET_ADDR}" u64:2000000 \
  --profile local-dev

# Check listing state
movement move view \
  --function-id "${MY_ADDR}::marketplace::is_listed" \
  --args "address:${NFT_MARKET_ADDR}" \
  --profile local-dev

movement move view \
  --function-id "${MY_ADDR}::marketplace::get_listing" \
  --args "address:${NFT_MARKET_ADDR}" \
  --profile local-dev

# Update price
movement move run \
  --function-id "${MY_ADDR}::marketplace::update_price" \
  --type-args "${MY_ADDR}::nft_collection::NFT" \
  --args "address:${NFT_MARKET_ADDR}" u64:2500000 \
  --profile local-dev

# Buyer (local-dev-2) purchases the NFT
movement move run \
  --function-id "${MY_ADDR}::marketplace::buy_nft" \
  --type-args "${MY_ADDR}::nft_collection::NFT" \
  --args "address:${NFT_MARKET_ADDR}" \
  --profile local-dev-2

# Verify post-sale: listing removed, ownership transferred
movement move view \
  --function-id "${MY_ADDR}::marketplace::is_listed" \
  --args "address:${NFT_MARKET_ADDR}" \
  --profile local-dev

movement move view \
  --function-id "${MY_ADDR}::nft_collection::get_owner" \
  --args "address:${NFT_MARKET_ADDR}" \
  --profile local-dev

# Re-list path to test cancel
movement move run \
  --function-id "${MY_ADDR}::marketplace::list_nft" \
  --type-args "${MY_ADDR}::nft_collection::NFT" \
  --args "address:${NFT_MARKET_ADDR}" u64:1800000 \
  --profile local-dev-2

movement move run \
  --function-id "${MY_ADDR}::marketplace::cancel_listing" \
  --type-args "${MY_ADDR}::nft_collection::NFT" \
  --args "address:${NFT_MARKET_ADDR}" \
  --profile local-dev-2

# Final ownership check after cancel
movement move view \
  --function-id "${MY_ADDR}::nft_collection::get_owner" \
  --args "address:${NFT_MARKET_ADDR}" \
  --profile local-dev

##################################
# RATHER TOKEN OPERATIONS
##################################

# RATHER token metadata is auto-created on module publish via init_module.
# Mint RATHER tokens to creator (admin only)
movement move run \
  --function-id "${MY_ADDR}::rather_token::mint_entry" \
  --args address:"${MY_ADDR}" u64:100000000000 \
  --profile local-dev \
  --assume-yes

# Check RATHER balance of creator
movement move view \
  --function-id "${MY_ADDR}::rather_token::balance_of" \
  --args "address:${MY_ADDR}" \
  --profile local-dev

# Mint RATHER to second account for swap testing
movement move run \
  --function-id "${MY_ADDR}::rather_token::mint_entry" \
  --args address:"${RECIPIENT_ADDR}" u64:50000000000 \
  --profile local-dev \
  --assume-yes

# Check RATHER balance of recipient
movement move view \
  --function-id "${MY_ADDR}::rather_token::balance_of" \
  --args "address:${RECIPIENT_ADDR}" \
  --profile local-dev

# Check total minted RATHER
movement move view \
  --function-id "${MY_ADDR}::rather_token::get_total_minted" \
  --profile local-dev

# Burn RATHER
movement move run \
  --function-id "${MY_ADDR}::rather_token::burn_entry" \
  --args address:"${MY_ADDR}" u64:50000000000 \
  --profile local-dev \
  --assume-yes

# Check total burned RATHER
movement move view \
  --function-id "${MY_ADDR}::rather_token::get_total_burned" \
  --profile local-dev

##################################
# TOKEN TRANSFERS (local-dev -> local-dev-2)
##################################

# Get RATHER token metadata address
RATHER_METADATA=$(movement move view \
  --function-id "${MY_ADDR}::rather_token::get_metadata" \
  --profile local-dev | jq -r '.Result[0].inner')

echo "RATHER Metadata: ${RATHER_METADATA}"

# Transfer RATHER tokens from local-dev to local-dev-2 (10 RATHER = 10_00000000)
movement move run \
  --function-id "0x1::primary_fungible_store::transfer" \
  --type-args "0x1::fungible_asset::Metadata" \
  --args "address:${RATHER_METADATA}" address:"${RECIPIENT_ADDR}" u64:1000000000 \
  --profile local-dev \
  --assume-yes

# Verify RATHER transfer
echo "=== RATHER balances after transfer ==="
movement move view \
  --function-id "${MY_ADDR}::rather_token::balance_of" \
  --args "address:${MY_ADDR}" \
  --profile local-dev

movement move view \
  --function-id "${MY_ADDR}::rather_token::balance_of" \
  --args "address:${RECIPIENT_ADDR}" \
  --profile local-dev

# Get WMOVE token metadata address
WMOVE_METADATA=$(movement move view \
  --function-id "${MY_ADDR}::wmove::get_metadata" \
  --profile local-dev | jq -r '.Result[0].inner')

echo "WMOVE Metadata: ${WMOVE_METADATA}"

# Transfer WMOVE tokens from local-dev to local-dev-2 (1 WMOVE = 1_00000000)
movement move run \
  --function-id "0x1::primary_fungible_store::transfer" \
  --type-args "0x1::fungible_asset::Metadata" \
  --args "address:${WMOVE_METADATA}" address:"${RECIPIENT_ADDR}" u64:1000000 \
  --profile local-dev \
  --assume-yes

# Verify WMOVE transfer
echo "=== WMOVE balances after transfer ==="
movement move view \
  --function-id "${MY_ADDR}::wmove::balance_of" \
  --args "address:${MY_ADDR}" \
  --profile local-dev

movement move view \
  --function-id "${MY_ADDR}::wmove::balance_of" \
  --args "address:${RECIPIENT_ADDR}" \
  --profile local-dev

##################################
# LIQUIDITY POOL OPERATIONS
##################################

# Define treasury address for fees (using RECIPIENT_ADDR as treasury)
export TREASURY_ADDR=${RECIPIENT_ADDR}

# Create pool: RatherToken/WMOVE with 0.3% fee (30 bps) to treasury
# Args: admin, fee_recipient, fee_bps, fee_token
# Fee token: 1 = collect fees in Y (WMOVE) regardless of swap direction
# Note: Type args must be alphabetically ordered (RatherToken < WMOVE)
movement move run \
  --function-id "${MY_ADDR}::pool::create_pool_entry" \
  --type-args "${MY_ADDR}::rather_token::RatherToken" "${MY_ADDR}::wmove::WMOVE" \
  --args address:"${MY_ADDR}" address:"${TREASURY_ADDR}" u64:30 u8:1 \
  --profile local-dev \
  --assume-yes

# Check pool reserves (should be 0,0 initially)
movement move view \
  --function-id "${MY_ADDR}::pool::get_reserves" \
  --type-args "${MY_ADDR}::rather_token::RatherToken" "${MY_ADDR}::wmove::WMOVE" \
  --profile local-dev

# Check fee configuration (returns: fee_recipient, fee_bps, fee_token)
# fee_token: 0 = X (RatherToken), 1 = Y (WMOVE)
movement move view \
  --function-id "${MY_ADDR}::pool::get_fee_info" \
  --type-args "${MY_ADDR}::rather_token::RatherToken" "${MY_ADDR}::wmove::WMOVE" \
  --profile local-dev

# Update fee to 5% (500 bps) - must be called by admin (local-dev)
movement move run \
  --function-id "${MY_ADDR}::pool::set_fee_bps" \
  --type-args "${MY_ADDR}::rather_token::RatherToken" "${MY_ADDR}::wmove::WMOVE" \
  --args u64:500 \
  --profile local-dev \
  --assume-yes

# Change fee token to collect in X instead (RatherToken) - admin only
# 0 = X token, 1 = Y token
movement move run \
  --function-id "${MY_ADDR}::pool::set_fee_token" \
  --type-args "${MY_ADDR}::rather_token::RatherToken" "${MY_ADDR}::wmove::WMOVE" \
  --args u8:0 \
  --profile local-dev \
  --assume-yes

# Change fee token back to Y (WMOVE)
movement move run \
  --function-id "${MY_ADDR}::pool::set_fee_token" \
  --type-args "${MY_ADDR}::rather_token::RatherToken" "${MY_ADDR}::wmove::WMOVE" \
  --args u8:1 \
  --profile local-dev \
  --assume-yes

# Verify fee was updated
movement move view \
  --function-id "${MY_ADDR}::pool::get_fee_info" \
  --type-args "${MY_ADDR}::rather_token::RatherToken" "${MY_ADDR}::wmove::WMOVE" \
  --profile local-dev

# Change fee recipient (admin only)
movement move run \
  --function-id "${MY_ADDR}::pool::set_fee_recipient" \
  --type-args "${MY_ADDR}::rather_token::RatherToken" "${MY_ADDR}::wmove::WMOVE" \
  --args address:"${RECIPIENT_ADDR}" \
  --profile local-dev \
  --assume-yes

# Transfer admin to local-dev-2 (and back) to test admin handoff
movement move run \
  --function-id "${MY_ADDR}::pool::set_admin" \
  --type-args "${MY_ADDR}::rather_token::RatherToken" "${MY_ADDR}::wmove::WMOVE" \
  --args address:"${RECIPIENT_ADDR}" \
  --profile local-dev \
  --assume-yes

movement move run \
  --function-id "${MY_ADDR}::pool::set_admin" \
  --type-args "${MY_ADDR}::rather_token::RatherToken" "${MY_ADDR}::wmove::WMOVE" \
  --args address:"${MY_ADDR}" \
  --profile local-dev-2 \
  --assume-yes

##################################
# Add liquidity first
##################################
movement move run \
  --function-id "${MY_ADDR}::pool::add_liquidity_entry" \
  --type-args "${MY_ADDR}::rather_token::RatherToken" "${MY_ADDR}::wmove::WMOVE" \
  --args u64:10000000000 u64:10000000 \
  --profile local-dev \
  --assume-yes

##################################
# SWAP OPERATIONS
##################################

# Quote RATHER → WMOVE swap (100 RATHER input)
# Returns: (net_amount_out, protocol_fee, fee_token, lp_fee)
# With fee_token=1 (WMOVE), the protocol_fee is deducted from the output
movement move view \
  --function-id "${MY_ADDR}::pool::quote_swap_x_to_y" \
  --type-args "${MY_ADDR}::rather_token::RatherToken" "${MY_ADDR}::wmove::WMOVE" \
  --args u64:10000000000 \
  --profile local-dev

# Quote WMOVE → RATHER swap
# With fee_token=1 (WMOVE), the protocol_fee is deducted from the input
movement move view \
  --function-id "${MY_ADDR}::pool::quote_swap_y_to_x" \
  --type-args "${MY_ADDR}::rather_token::RatherToken" "${MY_ADDR}::wmove::WMOVE" \
  --args u64:500000 \
  --profile local-dev

# Wrap some MOVE to get WMOVE for liquidity (creator already has some from earlier)
movement move run \
  --function-id "${MY_ADDR}::wmove::wrap" \
  --args u64:50000000000 \
  --profile local-dev

# Check WMOVE balance before adding liquidity
movement move view \
  --function-id "${MY_ADDR}::wmove::balance_of" \
  --args "address:${MY_ADDR}" \
  --profile local-dev

# Preview optimal amounts (off-chain)
movement move view \
  --function-id "${MY_ADDR}::pool::quote_add_liquidity" \
  --type-args "${MY_ADDR}::rather_token::RatherToken" "${MY_ADDR}::wmove::WMOVE" \
  --args u64:10000000000 u64:50000000 \
  --profile local-dev

# Add liquidity (on-chain) - will auto-calculate and only take what's needed
movement move run \
  --function-id "${MY_ADDR}::pool::add_liquidity_entry" \
  --type-args "${MY_ADDR}::rather_token::RatherToken" "${MY_ADDR}::wmove::WMOVE" \
  --args u64:10000000000 u64:25500000 \
  --profile local-dev \
  --assume-yes

# Check reserves after adding liquidity
movement move view \
  --function-id "${MY_ADDR}::pool::get_reserves" \
  --type-args "${MY_ADDR}::rather_token::RatherToken" "${MY_ADDR}::wmove::WMOVE" \
  --profile local-dev

# Check LP token balance of creator
movement move view \
  --function-id "${MY_ADDR}::lp_token::get_balance" \
  --type-args "${MY_ADDR}::rather_token::RatherToken" "${MY_ADDR}::wmove::WMOVE" \
  --args "address:${MY_ADDR}" \
  --profile local-dev

# Record treasury WMOVE balance before swap (for fee verification)
echo "=== Treasury WMOVE balance BEFORE swap ==="
movement move view \
  --function-id "${MY_ADDR}::wmove::balance_of" \
  --args "address:${TREASURY_ADDR}" \
  --profile local-dev

# Record treasury RATHER balance before swap
echo "=== Treasury RATHER balance BEFORE swap ==="
movement move view \
  --function-id "${MY_ADDR}::rather_token::balance_of" \
  --args "address:${TREASURY_ADDR}" \
  --profile local-dev

# SWAP 1: RATHER -> WMOVE (swap X to Y)
# With fee_token=1 (Y/WMOVE), fee is deducted from OUTPUT, sent to treasury in WMOVE
movement move run \
  --function-id "${MY_ADDR}::pool::swap_x_to_y_entry" \
  --type-args "${MY_ADDR}::rather_token::RatherToken" "${MY_ADDR}::wmove::WMOVE" \
  --args u64:1000000 u64:2400 \
  --profile local-dev \
  --assume-yes

# Check reserves after swap
movement move view \
  --function-id "${MY_ADDR}::pool::get_reserves" \
  --type-args "${MY_ADDR}::rather_token::RatherToken" "${MY_ADDR}::wmove::WMOVE" \
  --profile local-dev

# Check treasury WMOVE balance after swap (should have received fee from output)
echo "=== Treasury WMOVE balance AFTER RATHER->WMOVE swap ==="
movement move view \
  --function-id "${MY_ADDR}::wmove::balance_of" \
  --args "address:${TREASURY_ADDR}" \
  --profile local-dev

# SWAP 2: WMOVE -> RATHER (swap Y to X)
# First wrap more MOVE for swapping
movement move run \
  --function-id "${MY_ADDR}::wmove::wrap" \
  --args u64:10000000 \
  --profile local-dev

# With fee_token=1 (Y/WMOVE), fee is deducted from INPUT, sent to treasury in WMOVE
movement move run \
  --function-id "${MY_ADDR}::pool::swap_y_to_x_entry" \
  --type-args "${MY_ADDR}::rather_token::RatherToken" "${MY_ADDR}::wmove::WMOVE" \
  --args u64:500000 u64:184000000 \
  --profile local-dev \
  --assume-yes

# Check reserves after second swap
movement move view \
  --function-id "${MY_ADDR}::pool::get_reserves" \
  --type-args "${MY_ADDR}::rather_token::RatherToken" "${MY_ADDR}::wmove::WMOVE" \
  --profile local-dev

# Check treasury WMOVE balance after second swap (should have accumulated both fees)
echo "=== Treasury WMOVE balance AFTER WMOVE->RATHER swap ==="
movement move view \
  --function-id "${MY_ADDR}::wmove::balance_of" \
  --args "address:${TREASURY_ADDR}" \
  --profile local-dev

# Final balances summary
echo "=== FINAL BALANCES ==="
echo "Creator RATHER balance:"
movement move view \
  --function-id "${MY_ADDR}::rather_token::balance_of" \
  --args "address:${MY_ADDR}" \
  --profile local-dev

echo "Creator WMOVE balance:"
movement move view \
  --function-id "${MY_ADDR}::wmove::balance_of" \
  --args "address:${MY_ADDR}" \
  --profile local-dev

echo "Treasury WMOVE balance (all fees collected in WMOVE):"
movement move view \
  --function-id "${MY_ADDR}::wmove::balance_of" \
  --args "address:${TREASURY_ADDR}" \
  --profile local-dev

# Optional: Remove liquidity test
movement move run \
  --function-id "${MY_ADDR}::pool::remove_liquidity_entry" \
  --type-args "${MY_ADDR}::rather_token::RatherToken" "${MY_ADDR}::wmove::WMOVE" \
  --args u64:1000000000 \
  --profile local-dev