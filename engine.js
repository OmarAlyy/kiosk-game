/* Prototype A economy: one authored day at the kiosk. Deterministic. Spec: docs/specs/2026-11-20_prototype-a-design.md */
(function (root) {
  const R = { startMoney: 40, cups: 8, cupCost: 2, price: 3, coldPrice: 4, catFood: 1, catTakes: 2, iceBox: 12 };
  function newDay() {
    const prep = R.cups * R.cupCost;
    return { money: R.startMoney - prep, cupsLeft: R.cups, revenue: 0, costs: prep, expenses: [], sold: 0, lostCups: 0, missed: 0, log: [] };
  }
  function sell(d, n, price) {
    if (n > d.cupsLeft) throw new Error("not enough cups");
    d.cupsLeft -= n; d.sold += n; d.revenue += n * price; d.money += n * price;
    d.log.push({ sold: n, price });
  }
  // change: customer hands `paid`, the child gives back `given`; returns what happens
  function change(price, paid, given) {
    const due = paid - price;
    if (given === due) return { ok: true, due };
    if (given < due) return { ok: false, short: due - given, due };
    return { ok: false, extra: given - due, due };
  }
  function feedCat(d) { d.money -= R.catFood; d.costs += R.catFood; d.expenses.push("cat"); }
  function catKnocks(d) { const n = Math.min(R.catTakes, d.cupsLeft); d.cupsLeft -= n; d.lostCups += n; return n; }
  function miss(d) { d.missed++; }
  function close(d) { return { ...d, profit: d.revenue - d.costs, spoiled: d.cupsLeft }; }
  function buyIceBox(money) { if (money < R.iceBox) return null; return money - R.iceBox; }
  const api = { R, newDay, sell, change, feedCat, catKnocks, miss, close, buyIceBox };
  if (typeof module !== "undefined") module.exports = api; else root.KioskA = api;
})(this);
