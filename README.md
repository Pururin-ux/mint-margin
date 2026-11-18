# Mint Margin

Mint Margin checks whether a set of Cashu proofs can cover a Lightning melt quote. It separates the mint input fee from the routing reserve and finds a covering subset with the lowest unrounded input fee. It also shows the largest invoice the same proofs could cover at the entered reserve.

## Try it

Download this repository and open `index.html` in a browser. It works offline. The example starts with three proofs worth 64, 32 and 4 sats. Each proof has a 100 ppk fee. A 99 sat invoice plus a 1 sat routing reserve looks like it fits the 100 sat balance until Cashu rounds the combined input fee up to 1 sat. Change the invoice to 98 sat to see the exact-coverage result.

Use whole-sat values from one mint and group proofs by denomination and keyset fee. The tool takes only amounts, counts and public fee rates. It does not request invoices, tokens, keys or wallet access.

## Cashu accounting

- [NUT-02](https://github.com/cashubtc/nuts/blob/main/02.md) sums the `input_fee_ppk` values of selected proofs and rounds the total up once per transaction.
- [NUT-05](https://github.com/cashubtc/nuts/blob/main/05.md) requires selected proofs to cover the invoice amount plus the routing reserve and input fee.
- [NUT-08](https://github.com/cashubtc/nuts/blob/main/08.md) describes how compatible wallets and mints can settle unused reserve as change.

The subset search keeps the lowest raw fee for each reachable face value. Equal fees favor the smaller face value and then fewer proofs. The limit is 28 proofs and 100,000 sats per calculation. The result describes amount coverage only. Quote expiry, exchange rates, proof validity and routing are determined outside this planner. Get a fresh quote when changing the invoice amount.

## Verify it

Run `node --test planner.test.js`. The tests cover rounding and exact coverage, and compare the subset planner with direct enumeration on 180 deterministic cases.

Created by Runproof Studio in November 2026 for [Nut November](https://nutnovember.org/). MIT licensed.
