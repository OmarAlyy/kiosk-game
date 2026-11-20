/* Kiosk economy for the vertical slice. Deterministic. Spec: docs/specs/2026-11-20_kiosk-slice-gdd.md */
(function (root) {
  const RULES = {
    startMoney: 40, cupCost: 2, umbrellaCost: 15, minPrice: 1, maxPrice: 5, minCups: 3,
    normal: [5, 5, 4, 4, 4, 3, 3, 3, 2, 2, 2, 1],   // the most each passer-by will pay
    heat: [5, 4, 4, 3, 3],
    umbrellaExtra: [5, 4, 4],                        // only on a hot day, only with the parasol
    kunafaAfter: 6, kunafaTakes: 2,
  };

  const maxCups = money => Math.floor(money / RULES.cupCost);

  // The day's script: who walks past, in order, and when the events happen.
  function script(umbrella) {
    const s = RULES.normal.map((w, i) => ({ kind: "customer", wtp: w, phase: "normal", id: "n" + i }));
    s.splice(RULES.kunafaAfter, 0, { kind: "kunafa" });
    s.push({ kind: "heat" });
    const hot = RULES.heat.map((w, i) => ({ kind: "customer", wtp: w, phase: "heat", id: "h" + i }));
    if (umbrella) RULES.umbrellaExtra.forEach((w, i) => hot.splice(1 + i * 2, 0, { kind: "customer", wtp: w, phase: "shade", id: "u" + i }));
    return s.concat(hot);
  }

  // A live day: the screen calls these as things happen; the engine keeps the books.
  function newDay({ money, cups, price, umbrella }) {
    if (cups < RULES.minCups || cups * RULES.cupCost > money) throw new Error("cups out of range");
    if (price < RULES.minPrice || price > RULES.maxPrice) throw new Error("price out of range");
    return { money, cups, price, umbrella: !!umbrella, left: cups, sold: 0, revenue: 0, fell: 0, missed: 0, tooDear: 0, walkedOff: 0, raised: false };
  }
  // what this customer will do if served in time
  function intent(day, wtp) {
    if (wtp < day.price) return "price";
    if (day.left <= 0) return "out";
    return "buy";
  }
  function serve(day) { if (day.left <= 0) return false; day.left--; day.sold++; day.revenue += day.price; return true; }
  function kunafa(day, shooed) { if (shooed) return 0; const n = Math.min(RULES.kunafaTakes, day.left); day.left -= n; day.fell += n; return n; }
  function raise(day) { if (day.price < RULES.maxPrice) { day.price++; day.raised = true; } }
  function close(day) {
    const cost = day.cups * RULES.cupCost;
    return { ...day, cost, spoiled: day.left, profit: day.revenue - cost, moneyAfter: day.money - cost + day.revenue };
  }

  // Plays a whole day with a perfect server (used by the tests and the demo).
  function simulate({ money = RULES.startMoney, cups, price, umbrella = false, raiseAtHeat = false, shooKunafa = true }) {
    const d = newDay({ money, cups, price, umbrella });
    for (const ev of script(umbrella)) {
      if (ev.kind === "kunafa") kunafa(d, shooKunafa);
      else if (ev.kind === "heat") { if (raiseAtHeat) raise(d); }
      else { const i = intent(d, ev.wtp); if (i === "buy") serve(d); else if (i === "price") d.tooDear++; else d.missed++; }
    }
    return close(d);
  }

  const api = { RULES, maxCups, script, newDay, intent, serve, kunafa, raise, close, simulate };
  if (typeof module !== "undefined") module.exports = api; else root.Kiosk = api;
})(this);
