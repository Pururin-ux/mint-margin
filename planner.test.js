"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { plan } = require("./planner.js");

const group = (amount, feeRate, count = 1) => ({ amount, count, feeRate });
const example = [group(64, 100), group(32, 100), group(4, 100)];

test("100 sat is short for a 99 sat invoice plus reserve and input fee", () => {
  assert.deepEqual(plan(example, 99, 1), {
    fits: false, balance: 100, selected: 100, selectedCounts: [1, 1, 1],
    invoice: 99, reserve: 1, fee: 1, required: 101, shortfall: 1, maximumInvoice: 98,
  });
  const exact = plan(example, 98, 1);
  assert.equal(exact.fits, true);
  assert.equal(exact.required, exact.selected);
});

test("fees from all selected inputs are summed before rounding", () => {
  assert.equal(plan([group(2, 100, 10)], 19, 0).fee, 1);
  assert.equal(plan([group(2, 100, 11)], 20, 0).fee, 2);
  assert.equal(plan([group(4, 250), group(8, 750)], 11, 0).fee, 1);
  assert.equal(plan([group(4, 251), group(8, 750)], 10, 0).fee, 2);
});

test("an expensive proof can reduce usable value and should be left out", () => {
  const result = plan([group(32, 0), group(1, 3600)], 31, 1);
  assert.equal(result.fits, true);
  assert.deepEqual(result.selectedCounts, [1, 0]);
  assert.equal(result.maximumInvoice, 31);
  assert.equal(plan([group(32, 0)], 5, 40).shortfall, 13);
});

test("equal fees favor lower face value and then fewer proofs", () => {
  assert.deepEqual(plan([group(8, 0, 2), group(16, 0), group(32, 0)], 15, 0).selectedCounts, [0, 1, 0]);
});

test("invalid numeric ranges never become an apparently valid quote", () => {
  assert.throws(() => plan(example, NaN, 1), RangeError);
  assert.throws(() => plan(example, 99, 0.5), RangeError);
  assert.throws(() => plan([group(1, -1)], 1, 0), RangeError);
  assert.throws(() => plan([group(1, 0, 28), group(1, 0)], 1, 0), RangeError);
  assert.throws(() => plan([group(65536, 0, 2)], 1, 0), RangeError);
  assert.deepEqual(plan([group(1, 0, 28)], 28, 0).selectedCounts, [28]);
});

test("bounded planner agrees with direct subset enumeration", () => {
  let state = 37;
  function random(max) {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state % max;
  }
  for (let trial = 0; trial < 180; trial += 1) {
    const groups = Array.from({ length: 3 + random(5) },
      () => group(1 + random(28), random(4200), 1 + random(2)));
    const proofs = groups.flatMap((item) => Array(item.count).fill(item));
    const invoice = 1 + random(85);
    const reserve = random(25);
    let maximumNet = 0;
    let best = null;
    for (let mask = 1; mask < 2 ** proofs.length; mask += 1) {
      const chosen = proofs.filter((_, index) => mask & (1 << index));
      const value = chosen.reduce((sum, proof) => sum + proof.amount, 0);
      const ppk = chosen.reduce((sum, proof) => sum + proof.feeRate, 0);
      const net = value - Math.floor((ppk + 999) / 1000);
      maximumNet = Math.max(maximumNet, net);
      if (net >= invoice + reserve &&
          (!best || ppk < best.ppk ||
          (ppk === best.ppk && (value < best.value ||
          (value === best.value && chosen.length < best.count))))) {
        best = { ppk, value, count: chosen.length };
      }
    }
    const actual = plan(groups, invoice, reserve);
    assert.equal(actual.maximumInvoice, Math.max(0, maximumNet - reserve));
    assert.equal(actual.shortfall, Math.max(0, invoice + reserve - maximumNet));
    assert.equal(actual.fits, best !== null);
    if (best) {
      const actualPPK = groups.reduce((sum, item, index) => sum + item.feeRate * actual.selectedCounts[index], 0);
      const actualCount = actual.selectedCounts.reduce((sum, count) => sum + count, 0);
      assert.deepEqual({ ppk: actualPPK, value: actual.selected, count: actualCount }, best);
    }
  }
});
