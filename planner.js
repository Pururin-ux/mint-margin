"use strict";

const MintMargin = (() => {
  const limits = Object.freeze({ proofs: 28, balance: 100_000, feeRate: 1_000_000 });

  function wholeNumber(value, min, max, label) {
    if (!Number.isSafeInteger(value) || value < min || value > max) {
      throw new RangeError(`${label} must be a whole number from ${min} to ${max}.`);
    }
    return value;
  }

  function chargedFee(ppk) {
    return Math.ceil(ppk / 1000);
  }

  function plan(groups, invoice, reserve) {
    wholeNumber(invoice, 1, limits.balance, "Invoice");
    wholeNumber(reserve, 0, limits.balance, "Routing reserve");

    const proofs = [];
    let balance = 0;
    for (const [row, group] of groups.entries()) {
      const label = `Group ${row + 1}`;
      const amount = wholeNumber(group.amount, 1, limits.balance, `${label} denomination`);
      const count = wholeNumber(group.count, 1, limits.proofs, `${label} count`);
      const feeRate = wholeNumber(group.feeRate, 0, limits.feeRate, `${label} fee`);
      balance += amount * count;
      if (proofs.length + count > limits.proofs || balance > limits.balance) {
        throw new RangeError("Enter at most 28 proofs totalling at most 100,000 sat.");
      }
      for (let index = 0; index < count; index += 1) {
        proofs.push({ row, amount, feeRate });
      }
    }

    // For each reachable face value keep the subset with the lowest raw fee.
    // Descending values prevent the same proof from being added twice.
    const rawFees = new Int32Array(balance + 1).fill(-1);
    const counts = new Uint8Array(balance + 1);
    const masks = new Uint32Array(balance + 1);
    rawFees[0] = 0;
    let seenBalance = 0;
    for (const [index, proof] of proofs.entries()) {
      for (let value = seenBalance; value >= 0; value -= 1) {
        if (rawFees[value] < 0) continue;
        const next = value + proof.amount;
        const fee = rawFees[value] + proof.feeRate;
        const count = counts[value] + 1;
        if (rawFees[next] < 0 || fee < rawFees[next] ||
            (fee === rawFees[next] && count < counts[next])) {
          rawFees[next] = fee;
          counts[next] = count;
          masks[next] = masks[value] | (1 << index);
        }
      }
      seenBalance += proof.amount;
    }

    let bestFit = null;
    let mostCapacity = { value: 0, ppk: 0, net: 0 };
    for (let value = 1; value <= balance; value += 1) {
      const ppk = rawFees[value];
      if (ppk < 0) continue;
      const net = value - chargedFee(ppk);
      if (net > mostCapacity.net || (net === mostCapacity.net && ppk < mostCapacity.ppk)) {
        mostCapacity = { value, ppk, net };
      }
      if (net >= invoice + reserve && (bestFit === null || ppk < bestFit.ppk)) {
        bestFit = { value, ppk, net };
      }
    }

    const selection = bestFit ?? mostCapacity;
    const selectedCounts = new Array(groups.length).fill(0);
    for (const [index, proof] of proofs.entries()) {
      if (masks[selection.value] & (1 << index)) selectedCounts[proof.row] += 1;
    }
    const fee = chargedFee(selection.ppk);
    const required = invoice + fee + reserve;

    return {
      fits: bestFit !== null,
      balance,
      selected: selection.value,
      selectedCounts,
      invoice,
      reserve,
      fee,
      required,
      shortfall: Math.max(0, required - selection.value),
      maximumInvoice: Math.max(0, mostCapacity.net - reserve),
    };
  }

  return Object.freeze({ limits, plan });
})();

if (typeof module !== "undefined") module.exports = MintMargin;
