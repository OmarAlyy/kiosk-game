/* «مغامرة الكورة», part 1: the money model. Pure functions, no Phaser, so Node can check it (wallet.test.js).
   Brief: docs/specs/2026-11-20_linked-proof-brief.md (v2 + the founder's last fixes).

   Three pockets inside Kunafa's box, kept apart in the data:
   - pocket : my own money (the weekly allowance; profit I choose to take out)
   - project: the kiosk's cash. `capital` = what I put in this morning. Juice is bought from it; sales go into it.
   - goal   : savings for the street ball, with the source of every coin (from the allowance or from kiosk profit)
   Juice is stock: a jug is 4 cups for 4 and whatever is left at sunset is thrown away. The pitcher is shared, not bought.
   Ice is paid per iced cup out of that cup's sale (the customer pays 3, one goes to the ice box), so cash never dips below 0.
   Only today's profit may leave the project; the capital stays for tomorrow's juice. Nothing moves money from nothing. */
"use strict";
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Wallet = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const PRICES = { allowance: 12, jug: 4, cupsPerJug: 4, cup: 3, ice: 1, ball: 30 };
  const ITEMS = {
    notebook: { name: "كراسة", price: 3, need: true },
    choc: { name: "شيكولاتة", price: 2, need: false },
    sticker: { name: "استيكر كنافة", price: 1, need: false },
  };
  // today's customers, in order. The captain only buys a cold cup.
  const CUSTOMERS = [
    { id: "yahya", name: "يحيى", cups: 1 },
    { id: "soad", name: "طنط سعاد", cups: 2 },
    { id: "captain", name: "الكابتن", cups: 1, coldOnly: true },
    { id: "kids", name: "عيال الكورة", cups: 2 },
  ];

  function create() {
    return {
      pocket: 0,
      pocketFromProfit: 0, // the part of my pocket that came out of kiosk profit (so saving it is not "from the allowance")
      project: { cash: 0, capital: 0 },
      goal: { price: PRICES.ball, saved: 0, fromPocket: 0, fromProfit: 0 },
      bought: [],          // grocery items
      day: null,           // the kiosk day
      ledger: [],          // every movement, for the screens and the checks
      totals: { allowance: 0, grocery: 0, juice: 0, ice: 0, revenue: 0 },
      practice: false,
    };
  }
  const clone = s => JSON.parse(JSON.stringify(s));
  function log(s, e) { s.ledger.push(e); return e; }
  function trimProfitPart(s) { s.pocketFromProfit = Math.min(s.pocketFromProfit, s.pocket); }
  function fail(msg) { const e = new Error(msg); e.code = "rule"; throw e; }

  // ---------- the allowance and the grocery ----------
  function allowance(s) {
    s.pocket += PRICES.allowance; s.totals.allowance += PRICES.allowance;
    return log(s, { t: "income", to: "pocket", amt: PRICES.allowance, src: "allowance" });
  }
  function buy(s, ids) {
    const cost = ids.reduce((a, id) => a + ITEMS[id].price, 0);
    if (cost > s.pocket) fail("not enough pocket money");
    s.pocket -= cost; s.totals.grocery += cost; s.bought.push(...ids); trimProfitPart(s);
    return log(s, { t: "buy", from: "pocket", amt: cost, items: ids.slice() });
  }

  // ---------- the kiosk day ----------
  const maxJugs = s => Math.floor(s.pocket / PRICES.jug);
  // Put the morning's capital from my pocket into the project, then buy that much juice with it.
  function openKiosk(s, jugs) {
    if (s.day && !s.day.closed) fail("day already open");
    if (jugs < 1 || jugs > 2) fail("1 or 2 jugs");
    const cost = jugs * PRICES.jug;
    const fromPocket = Math.max(0, cost - s.project.cash);   // capital already in the project is used first
    if (fromPocket > s.pocket) fail("not enough pocket money for the juice");
    if (fromPocket) {
      s.pocket -= fromPocket; s.project.cash += fromPocket; s.project.capital += fromPocket; trimProfitPart(s);
      log(s, { t: "invest", from: "pocket", to: "project", amt: fromPocket });
    }
    s.project.cash -= cost; s.totals.juice += cost;
    log(s, { t: "stock", from: "project", amt: cost, jugs });
    s.day = { jugs, stock: jugs * PRICES.cupsPerJug, sold: 0, revenue: 0, juiceCost: cost, iceCost: 0, next: 0,
      served: [], closed: false, profit: null, wasted: null, profitLeft: 0, capitalMorning: s.project.capital };
    return s.day;
  }
  const cupsLeft = s => s.day.stock - s.day.sold;
  // Serve the next customer. iced[i] = whether cup i of the order got ice. Returns what happened, for the scene.
  function serve(s, iced) {
    const d = s.day; if (!d || d.closed) fail("no open day");
    const c = CUSTOMERS[d.next]; if (!c) fail("no customer left");
    iced = (iced || []).slice(0, c.cups);
    const r = { id: c.id, wanted: c.cups, got: 0, iced: 0, paid: 0, ice: 0, left: null };
    const avail = cupsLeft(s);
    if (avail === 0) r.left = "sold-out";
    else if (c.coldOnly && !iced[0]) r.left = "warm";
    else {
      r.got = Math.min(c.cups, avail);
      r.iced = iced.slice(0, r.got).filter(Boolean).length;
      if (r.got < c.cups) r.left = "partly-sold-out";
      r.paid = r.got * PRICES.cup; r.ice = r.iced * PRICES.ice;
      d.sold += r.got; d.revenue += r.paid; d.iceCost += r.ice;
      s.project.cash += r.paid; s.totals.revenue += r.paid;
      log(s, { t: "sale", to: "project", amt: r.paid, who: c.id, cups: r.got });
      if (r.ice) { s.project.cash -= r.ice; s.totals.ice += r.ice; log(s, { t: "cost", from: "project", amt: r.ice, item: "ice" }); }
    }
    d.served.push(r); d.next++;
    return r;
  }
  const dayOver = s => !!s.day && (s.day.next >= CUSTOMERS.length);
  // Sunset: what is left is thrown away; profit = revenue − juice − ice. The capital stays for tomorrow.
  function closeDay(s) {
    const d = s.day; if (!d || d.closed) fail("no open day");
    d.wasted = d.stock - d.sold;
    d.profit = d.revenue - d.juiceCost - d.iceCost;
    d.profitLeft = Math.max(0, d.profit);
    d.closed = true;
    log(s, { t: "close", revenue: d.revenue, juice: d.juiceCost, ice: d.iceCost, profit: d.profit, wasted: d.wasted });
    return d;
  }
  // Only today's profit can leave the project: to the ball, or to my pocket.
  function takeProfit(s, to, amt) {
    const d = s.day; if (!d || !d.closed) fail("close the day first");
    if (amt < 1 || amt > d.profitLeft) fail("more than today's profit");
    d.profitLeft -= amt; s.project.cash -= amt;
    if (to === "goal") { s.goal.saved += amt; s.goal.fromProfit += amt; }
    else if (to === "pocket") { s.pocket += amt; s.pocketFromProfit += amt; }
    else fail("unknown pocket");
    return log(s, { t: "withdraw", from: "project", to, amt });
  }
  // Save from my own pocket for the ball.
  function save(s, amt) {
    if (amt < 1 || amt > s.pocket) fail("not enough pocket money");
    // profit I took out earlier is still kiosk money: it is booked as from the kiosk, the rest as from the allowance
    const profitPart = Math.min(amt, s.pocketFromProfit);
    s.pocket -= amt; s.pocketFromProfit -= profitPart; s.goal.saved += amt;
    s.goal.fromProfit += profitPart; s.goal.fromPocket += amt - profitPart;
    return log(s, { t: "save", from: "pocket", to: "goal", amt, fromProfit: profitPart });
  }

  // ---------- what the goal screen tells the child ----------
  function forecast(s) {
    const left = Math.max(0, s.goal.price - s.goal.saved);
    const weekly = s.goal.fromPocket;                   // what I saved from this week's allowance
    const daily = s.day && s.day.closed ? Math.max(0, s.day.profit) : 0;
    return {
      left,
      pocketWeeks: left === 0 ? 0 : weekly > 0 ? Math.ceil(left / weekly) : null,   // null: never, at this rate
      kioskDays: left === 0 ? 0 : daily > 0 ? Math.ceil(left / daily) : null,
    };
  }

  // ---------- checks used by the tests and by the game in test mode ----------
  function check(s) {
    const t = s.totals, d = s.day;
    const own = s.pocket + s.project.cash + s.goal.saved;
    const expect = t.allowance - t.grocery - t.juice - t.ice + t.revenue;
    const errors = [];
    if (own !== expect) errors.push(`money from nothing: has ${own}, should be ${expect}`);
    if ([s.pocket, s.project.cash, s.goal.saved].some(v => v < 0)) errors.push("a pocket is below zero");
    if (s.goal.saved !== s.goal.fromPocket + s.goal.fromProfit) errors.push("goal sources do not add up");
    if (s.pocketFromProfit < 0 || s.pocketFromProfit > s.pocket) errors.push("pocket sources do not add up");
    if (d && d.closed && s.project.cash < s.project.capital - Math.max(0, -d.profit)) errors.push("capital left the project");
    if (d && d.closed && d.profit !== d.revenue - d.juiceCost - d.iceCost) errors.push("profit is not revenue − costs");
    return errors;
  }

  return { PRICES, ITEMS, CUSTOMERS, create, clone, allowance, buy, maxJugs, openKiosk, cupsLeft, serve, dayOver, closeDay, takeProfit, save, forecast, check };
});
