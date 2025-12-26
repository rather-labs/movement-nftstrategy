module nft_strategy_addr::math {
    use nft_strategy_addr::errors;

    const U64_MAX: u128 = 18446744073709551615;
    const MINIMUM_LIQUIDITY: u64 = 1000;

    public fun minimum_liquidity(): u64 {
        MINIMUM_LIQUIDITY
    }

    public fun sqrt(y: u128): u64 {
        if (y < 4) {
            if (y == 0) { 0 }
            else { 1 }
        } else {
            let z = y;
            let x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            };
            assert!(z <= U64_MAX, errors::sqrt_overflow());
            (z as u64)
        }
    }

    public fun safe_mul_div(a: u64, b: u64, c: u64): u64 {
        assert!(c != 0, errors::division_by_zero());
        let a_u128 = (a as u128);
        let b_u128 = (b as u128);
        let c_u128 = (c as u128);

        let product = a_u128 * b_u128;
        assert!(product / b_u128 == a_u128, errors::overflow());

        let result = product / c_u128;
        assert!(result <= U64_MAX, errors::overflow());
        (result as u64)
    }

    public fun min(a: u64, b: u64): u64 {
        if (a < b) a else b
    }

    public fun max(a: u64, b: u64): u64 {
        if (a > b) a else b
    }

    public fun get_amount_out(
        amount_in: u64, reserve_in: u64, reserve_out: u64
    ): u64 {
        assert!(amount_in > 0, errors::insufficient_input_amount());
        assert!(
            reserve_in > 0 && reserve_out > 0, errors::insufficient_liquidity()
        );

        let amount_in_with_fee = (amount_in as u128) * 997;
        let numerator = amount_in_with_fee * (reserve_out as u128);
        let denominator = (reserve_in as u128) * 1000 + amount_in_with_fee;

        let result = numerator / denominator;
        assert!(result > 0, errors::insufficient_output_amount());
        assert!(result <= U64_MAX, errors::overflow());
        (result as u64)
    }

    public fun get_amount_in(
        amount_out: u64, reserve_in: u64, reserve_out: u64
    ): u64 {
        assert!(amount_out > 0, errors::insufficient_output_amount());
        assert!(
            reserve_in > 0 && reserve_out > 0, errors::insufficient_liquidity()
        );
        assert!(amount_out < reserve_out, errors::insufficient_liquidity());

        let numerator = (reserve_in as u128) * (amount_out as u128) * 1000;
        let denominator = ((reserve_out - amount_out) as u128) * 997;

        let result = (numerator / denominator) + 1;
        assert!(result <= U64_MAX, errors::overflow());
        (result as u64)
    }

    public fun quote(amount_a: u64, reserve_a: u64, reserve_b: u64): u64 {
        assert!(amount_a > 0, errors::insufficient_input_amount());
        assert!(
            reserve_a > 0 && reserve_b > 0, errors::insufficient_liquidity()
        );

        safe_mul_div(amount_a, reserve_b, reserve_a)
    }

    #[test]
    fun test_sqrt() {
        assert!(sqrt(0) == 0, 1);
        assert!(sqrt(1) == 1, 2);
        assert!(sqrt(4) == 2, 3);
        assert!(sqrt(9) == 3, 4);
        assert!(sqrt(16) == 4, 5);
        assert!(sqrt(10000) == 100, 6);
    }

    #[test]
    fun test_safe_mul_div() {
        assert!(safe_mul_div(100, 200, 50) == 400, 1);
        assert!(safe_mul_div(1000, 500, 250) == 2000, 2);
    }

    #[test]
    #[expected_failure(abort_code = 16)]
    fun test_safe_mul_div_division_by_zero() {
        safe_mul_div(100, 200, 0);
    }

    #[test]
    fun test_get_amount_out() {
        let amount_out = get_amount_out(1000, 10000, 10000);
        assert!(amount_out == 906, 1);
    }

    #[test]
    fun test_get_amount_in() {
        let amount_in = get_amount_in(906, 10000, 10000);
        assert!(amount_in == 1000, 1);
    }
}

