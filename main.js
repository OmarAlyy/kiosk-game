/* Kiosk vertical slice: two days at the juice kiosk on «شارع الفكرة», with the parasol in between.
   Spec: docs/specs/2026-11-20_kiosk-slice-gdd.md. Economy: engine.js (Kiosk). Phaser 3.90, no other libraries.
   ?demo=1 plays itself (for the gameplay video). */
"use strict";
const W = 720, H = 1280;
const Q = new URLSearchParams(location.search);
const DEMO = Q.get("demo") === "1";
const INK = 0x3b2016, CREAM = 0xfff6e4, SUN = 0xf4b63c, SUN_D = 0xc98a1e, TEAL = 0x3fa9a0, TEAL_D = 0x2c7b74, RED = 0xc8553d, GREEN = 0x4f9a43;
const FONT = '-apple-system, "Geeza Pro", "Noto Kufi Arabic", "Segoe UI", Tahoma, sans-serif';
const ar = x => String(x).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[d]);
const sgn = x => (x < 0 ? "−" : "") + ar(Math.abs(x));
const cupsW = k => ar(k) + " " + (k >= 3 && k <= 10 ? "كوبايات" : "كوباية");
const txt = (scene, x, y, s, size, color = "#3b2016", extra = {}) =>
  scene.add.text(x, y, s, { fontFamily: FONT, fontSize: size + "px", color, fontStyle: "bold", rtl: true, align: "center", ...extra }).setOrigin(0.5);

// layout of the street (background is 720×1290)
const COUNTER = { x0: 105, x1: 372, top: 792 };       // the counter top in bg.jpg
const QUEUE_Y = 1130, QUEUE_X = [300, 430, 560, 690]; // customers' feet, front of the queue first
const SERVE_ZONE = 150;

class KioskScene extends Phaser.Scene {
  constructor() { super("kiosk"); }

  preload() {
    const A = "assets/";
    this.load.image("bg", A + "bg.jpg");
    ["farida", "omar", "kunafa", "farida_face", "omar_face", "sitto_face"].forEach(k => this.load.image(k, A + k + ".png"));
    for (let i = 0; i < 6; i++) this.load.svg("cust" + i, A + `cust${i}.svg`, { width: 110, height: 200 });
    this.load.svg("cup", A + "cup.svg", { width: 60, height: 80 });
    this.load.svg("coin", A + "coin.svg", { width: 60, height: 60 });
    this.load.svg("umbrella", A + "umbrella.svg", { width: 300, height: 240 });
    this.load.svg("sun", A + "sun.svg", { width: 160, height: 160 });
    ["coin", "boing", "crash", "sparkle", "street"].forEach(k => this.load.audio(k, A + k + ".mp3"));
  }

  create() {
    this.state = { money: Kiosk.RULES.startMoney, dayNo: 0, umbrella: false, history: [] };
    this.add.image(W / 2, H / 2, "bg").setDisplaySize(W, 1290);
    this.heatTint = this.add.rectangle(W / 2, H / 2, W, H, 0xff8a2a, 0).setDepth(1);
    this.umbrellaSpr = this.add.image(238, 610, "umbrella").setScale(1.0).setVisible(false).setDepth(2);
    this.sun = this.add.image(600, -120, "sun").setDepth(2);
    // the team: Farida and Omar beside the kiosk
    this.omar = this.add.image(470, 1000, "omar").setOrigin(0.5, 1).setScale(0.42).setDepth(3);
    this.farida = this.add.image(610, 990, "farida").setOrigin(0.5, 1).setScale(0.42).setDepth(3);
    [this.omar, this.farida].forEach((c, i) => this.tweens.add({ targets: c, scaleY: c.scaleY * 1.012, duration: 1500 + i * 300, yoyo: true, repeat: -1, ease: "Sine.inOut" }));
    this.cupLayer = this.add.layer().setDepth(4);
    this.custLayer = this.add.layer().setDepth(5);
    this.fxLayer = this.add.layer().setDepth(8);
    this.uiLayer = this.add.layer().setDepth(10);
    this.hud = this.makeHud();
    this.bubble = null;
    this.sound.pauseOnBlur = false;
    this.street = this.sound.add("street", { loop: true, volume: 0.25 });
    this.input.on("dragstart", (p, cup) => { cup.setScale(cup.baseScale * 1.25).setDepth(9); this.fxLayer.add(cup); });
    this.input.on("drag", (p, cup, x, y) => cup.setPosition(x, y));
    this.input.on("dragend", (p, cup) => this.dropCup(cup));
    this.time.delayedCall(300, () => this.intro());
    window.__kiosk = this; // for the video recorder and FPS checks
  }

  // ---------- small UI kit: speech bubble, chunky buttons, panels ----------
  say(who, line, ms) {
    if (this.bubble) this.bubble.destroy();
    const c = this.add.container(W / 2, 150).setDepth(12);
    const g = this.add.graphics();
    g.fillStyle(INK, 0.35).fillRoundedRect(-330, -78 + 8, 660, 156, 30);
    g.fillStyle(CREAM, 1).fillRoundedRect(-330, -78, 660, 156, 30).lineStyle(5, INK).strokeRoundedRect(-330, -78, 660, 156, 30);
    const face = this.add.image(250, 0, who + "_face").setDisplaySize(118, 118);
    const ring = this.add.graphics().lineStyle(5, INK).strokeCircle(250, 0, 60);
    const mask = this.make.graphics({}, false).fillCircle(W / 2 + 250, 150, 57);
    face.setMask(mask.createGeometryMask());
    const name = { farida: "فريدة", omar: "عمر", sitto: "ستو صديقة" }[who];
    const t1 = txt(this, 0, -44, name, 26, "#c8553d").setOrigin(1, 0.5).setX(170);
    const t2 = txt(this, -60, 18, line, 34, "#3b2016", { wordWrap: { width: 440, useAdvancedWrap: true } }).setOrigin(0.5);
    c.add([g, face, ring, t1, t2]);
    c.setScale(0.9).setAlpha(0);
    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 180, ease: "Back.out" });
    const body = who === "farida" ? this.farida : who === "omar" ? this.omar : null;
    if (body) this.tweens.add({ targets: body, y: body.y - 10, duration: 140, yoyo: true, repeat: 3 });
    this.bubble = c;
    if (ms) this.time.delayedCall(ms, () => { if (this.bubble === c) { c.destroy(); this.bubble = null; } });
    return c;
  }
  hideSay() { if (this.bubble) { this.bubble.destroy(); this.bubble = null; } }

  button(x, y, w, h, label, onClick, color = SUN, dark = SUN_D, size = 38, textColor = "#3b2016") {
    const c = this.add.container(x, y);
    const base = this.add.graphics().fillStyle(dark).fillRoundedRect(-w / 2, -h / 2 + 7, w, h, 22);
    const face = this.add.graphics();
    const draw = () => face.clear().fillStyle(color).fillRoundedRect(-w / 2, -h / 2, w, h, 22).lineStyle(4, INK).strokeRoundedRect(-w / 2, -h / 2, w, h, 22);
    draw();
    const t = txt(this, 0, 0, label, size, textColor);
    const top = this.add.container(0, 0, [face, t]);
    c.add([base, top]);
    c.setSize(w, h + 7).setInteractive({ useHandCursor: true });
    c.on("pointerdown", () => { top.y = 6; });
    c.on("pointerout", () => { top.y = 0; });
    c.on("pointerup", () => { top.y = 0; this.sound.play("boing", { volume: 0.25, rate: 1.6 }); onClick(); });
    c.label = t;
    return c;
  }

  panel(h = 470) {
    const c = this.add.container(0, 0).setDepth(11);
    const g = this.add.graphics();
    g.fillStyle(0x2b1a12, 0.88).fillRoundedRect(20, H - h - 30, W - 40, h, 34);
    c.add(g); c.top = H - h - 30;
    c.setAlpha(0); this.tweens.add({ targets: c, alpha: 1, duration: 200 });
    return c;
  }

  makeHud() {
    const c = this.add.container(0, 0).setDepth(9).setVisible(false);
    const pill = (x, w) => this.add.graphics().fillStyle(CREAM).fillRoundedRect(x - w / 2, 34, w, 64, 32).lineStyle(4, INK).strokeRoundedRect(x - w / 2, 34, w, 64, 32);
    const coin = this.add.image(140, 66, "coin").setScale(0.75);
    const cup = this.add.image(560, 66, "cup").setScale(0.55);
    const money = txt(this, 225, 66, "", 36);
    const cups = txt(this, 630, 66, "", 36);
    const dayBg = this.add.graphics().fillStyle(0x2b1a12, 0.75).fillRoundedRect(W / 2 - 150, 112, 300, 48, 24);
    const day = txt(this, W / 2, 136, "", 28, "#fff6e4");
    c.add([pill(200, 210), pill(600, 180), coin, cup, money, cups, dayBg, day]);
    c.set = (m, k, d) => { money.setText(ar(m)); cups.setText(ar(k)); day.setText(d); };
    c.coinPos = { x: 140, y: 66 };
    return c;
  }

  // ---------- story beats ----------
  intro() {
    if (!this.street.isPlaying) this.street.play();
    this.say("farida", "عندي فكرة! نفتح كشك عصير في شارع الفكرة!");
    this.next(DEMO ? 1500 : null, () => {
      this.say("omar", `معانا ${ar(this.state.money)}، والكوباية خاماتها بـ${ar(Kiosk.RULES.cupCost)}. هنعمل كام؟`);
      this.setup();
    }, "يلا!");
  }

  // one big "next" button (or an automatic step in demo mode)
  next(autoMs, fn, label = "◀") {
    if (DEMO && autoMs) { this.time.delayedCall(autoMs, fn); return; }
    const b = this.button(W / 2, H - 120, 300, 100, label, () => { b.destroy(); fn(); });
    this.uiLayer.add(b);
  }

  setup() {
    const st = this.state;
    const maxC = Kiosk.maxCups(st.money);
    let cups = Math.min(10, maxC), price = 3;
    const p = this.panel(520);
    const y0 = p.top;
    const title = txt(this, W / 2, y0 + 56, "هتجهّز كام كوباية؟", 38, "#fff6e4");
    const count = txt(this, W / 2, y0 + 150, "", 64, "#fff6e4");
    const cost = txt(this, W / 2, y0 + 212, "", 28, "#ffe2a8");
    const minus = this.button(W / 2 + 190, y0 + 150, 110, 96, "−", () => { if (cups > Kiosk.RULES.minCups) { cups--; refresh(); } }, CREAM, 0xb9ac94, 56);
    const plus = this.button(W / 2 - 190, y0 + 150, 110, 96, "+", () => { if (cups < maxC) { cups++; refresh(); } }, CREAM, 0xb9ac94, 56);
    const ptitle = txt(this, W / 2, y0 + 285, "وهتبيع الكوباية بكام؟", 34, "#fff6e4");
    const prices = [1, 2, 3, 4, 5].map((v, i) => this.button(W / 2 + 240 - i * 120, y0 + 370, 100, 96, ar(v), () => { price = v; refresh(); }, CREAM, 0xb9ac94, 48));
    const go = this.button(W / 2, y0 + 470, 360, 92, "افتح الكشك", () => { p.destroy(); this.startDay(cups, price); }, SUN, SUN_D, 40);
    p.add([title, count, cost, minus, plus, ptitle, ...prices, go]);
    this.uiLayer.add(p);
    const refresh = () => {
      count.setText(cupsW(cups));
      cost.setText(`التكلفة ${ar(cups * 2)} من ${ar(st.money)}`);
      prices.forEach((b, i) => b.setAlpha(i + 1 === price ? 1 : 0.55).setScale(i + 1 === price ? 1.08 : 1));
      this.showCups(cups);
    };
    refresh();
    if (DEMO) {
      const plan = st.dayNo === 0 ? { c: 9, p: 4 } : { c: 11, p: 4 };
      this.time.delayedCall(1200, () => { cups = Math.min(plan.c, maxC); price = plan.p; refresh(); });
      this.time.delayedCall(2600, () => { p.destroy(); this.startDay(cups, price); });
    }
  }

  // ---------- the cups on the counter ----------
  cupHome(i) { const per = 10, row = Math.floor(i / per), col = i % per; return { x: COUNTER.x1 - 14 - col * 26, y: COUNTER.top - 18 - row * 34 }; }
  showCups(n) {
    this.cupLayer.removeAll(true);
    this.cups = [];
    for (let i = 0; i < n; i++) {
      const h = this.cupHome(i);
      const c = this.add.image(h.x, h.y, "cup").setScale(0.48);
      c.baseScale = 0.48; c.home = h;
      this.cupLayer.add(c); this.cups.push(c);
    }
  }
  armCups(on) { this.cups.forEach(c => { if (on) { c.setInteractive({ draggable: true, useHandCursor: true }); this.input.setDraggable(c); } else c.disableInteractive(); }); }

  // ---------- a day ----------
  startDay(cups, price) {
    const st = this.state;
    st.dayNo++;
    this.day = Kiosk.newDay({ money: st.money, cups, price, umbrella: st.umbrella });
    this.script = Kiosk.script(st.umbrella);
    this.ptr = 0; this.queue = []; this.busy = false; this.ended = false; this.kunafaOn = false;
    this.cash = st.money - cups * Kiosk.RULES.cupCost;
    this.umbrellaSpr.setVisible(st.umbrella);
    this.hideSay();
    this.hud.setVisible(true); this.refreshHud();
    this.armCups(true);
    this.say("omar", st.dayNo === 1 ? "اسحب الكوباية للزبون!" : "يوم جديد… يلا!", 2200);
    this.dayStart = this.time.now;
    this.spawnTimer = this.time.addEvent({ delay: 2100, loop: true, callback: () => this.tick() });
    this.time.delayedCall(400, () => this.tick());
    if (DEMO) this.demoServer = this.time.addEvent({ delay: 400, loop: true, callback: () => this.demoServe() });
  }
  refreshHud() { this.hud.set(this.cash, this.day.left, "اليوم " + ar(this.state.dayNo) + (this.day.price ? " · السعر " + ar(this.day.price) : "")); }

  tick() {
    if (this.busy || this.ended) return;
    if (this.ptr >= this.script.length) { if (this.queue.length === 0 && !this.kunafaOn) this.endDay(); return; }
    const ev = this.script[this.ptr];
    if (ev.kind === "heat") { if (this.queue.length) return; this.ptr++; this.heat(); return; }
    if (ev.kind === "kunafa") { this.ptr++; this.kunafa(); return; }
    if (this.queue.length >= 3) return;
    this.ptr++; this.spawn(ev);
  }

  spawn(ev) {
    const idx = Math.floor(Math.random() * 6);
    const c = this.add.container(W + 80, QUEUE_Y);
    const body = this.add.image(0, 0, "cust" + idx).setOrigin(0.5, 1).setScale(0.95);
    c.add(body); c.ev = ev; c.body = body; c.state = "walking";
    this.custLayer.add(c);
    this.queue.push(c);
    c.walk = this.tweens.add({ targets: body, y: -8, angle: { from: -3, to: 3 }, duration: 220, yoyo: true, repeat: -1 });
    this.layoutQueue();
  }

  layoutQueue() {
    this.queue.forEach((c, i) => {
      const x = QUEUE_X[i];
      if (c.targetX === x) return;
      c.targetX = x;
      this.tweens.add({ targets: c, x, duration: Math.abs(c.x - x) * 3.2 + 150, ease: "Linear", onComplete: () => { if (i === 0 && this.queue[0] === c) this.arrive(c); else if (c.walk && this.queue.indexOf(c) > 0) { c.walk.pause(); c.body.y = 0; c.body.angle = 0; } } });
      if (c.walk && c.walk.isPaused()) c.walk.resume();
    });
  }

  arrive(c) {
    if (c.state !== "walking") return;
    c.walk.pause(); c.body.y = 0; c.body.angle = 0;
    const want = Kiosk.intent(this.day, c.ev.wtp);
    if (want === "buy") {
      c.state = "waiting";
      c.bub = this.thought(c, "cup");
      c.patience = this.time.delayedCall(10000, () => { if (c.state === "waiting") { c.bub.destroy(); this.thought(c, "مستعجل…"); this.day.walkedOff++; this.leave(c, 900); } });
      if (this.state.dayNo === 1 && !this.hinted) { this.hinted = true; this.hint(c); }
    } else {
      c.state = "leaving";
      if (want === "price") this.day.tooDear++; else this.day.missed++;
      this.thought(c, want === "price" ? "غالي!" : "خلص؟!");
      this.leave(c, 1100);
    }
  }

  thought(c, what) {
    const b = this.add.container(0, -215);
    const g = this.add.graphics().fillStyle(0xffffff).fillRoundedRect(-62, -44, 124, 80, 26).lineStyle(4, INK).strokeRoundedRect(-62, -44, 124, 80, 26)
      .fillStyle(0xffffff).fillTriangle(-12, 34, 12, 34, 0, 52).lineStyle(4, INK).lineBetween(-12, 37, 0, 52).lineBetween(0, 52, 12, 37);
    b.add(g);
    if (what === "cup") b.add(this.add.image(0, -4, "cup").setScale(0.62));
    else b.add(txt(this, 0, -4, what, 30));
    b.setScale(0); this.tweens.add({ targets: b, scale: 1, duration: 220, ease: "Back.out" });
    c.add(b);
    return b;
  }

  hint(c) {
    const cup = this.cups[this.cups.length - 1]; if (!cup) return;
    const hand = txt(this, cup.x, cup.y, "👆", 64).setDepth(9);
    this.fxLayer.add(hand);
    this.tweens.add({ targets: hand, x: c.x, y: c.y - 120, duration: 1100, repeat: 2, repeatDelay: 300, onComplete: () => hand.destroy() });
  }

  dropCup(cup) {
    const front = this.queue[0];
    const ok = front && front.state === "waiting" && Phaser.Math.Distance.Between(cup.x, cup.y, front.x, front.y - 100) < SERVE_ZONE;
    if (!ok) { // back to the counter
      this.cupLayer.add(cup);
      this.tweens.add({ targets: cup, x: cup.home.x, y: cup.home.y, scale: cup.baseScale, duration: 220 });
      return;
    }
    this.serve(front, cup);
  }

  serve(c, cup) {
    if (!Kiosk.serve(this.day)) return;
    c.state = "leaving";
    if (c.patience) c.patience.remove();
    this.cups.splice(this.cups.indexOf(cup), 1);
    cup.disableInteractive();
    this.tweens.add({ targets: cup, x: c.x - 30, y: c.y - 110, scale: 0.5, duration: 160 });
    c.bub.destroy();
    this.thought(c, "شكرًا!");
    const paid = this.day.price;
    // coins fly to the money pill
    for (let i = 0; i < paid; i++) {
      const coin = this.add.image(c.x, c.y - 120, "coin").setScale(0.55);
      this.fxLayer.add(coin);
      this.tweens.add({ targets: coin, x: this.hud.coinPos.x, y: this.hud.coinPos.y, duration: 520, delay: i * 90, ease: "Cubic.in",
        onComplete: () => { coin.destroy(); this.cash++; this.refreshHud(); this.sound.play("coin", { volume: 0.5, rate: 1 + Math.random() * 0.2 }); } });
    }
    this.time.delayedCall(250, () => { cup.destroy(); this.relayoutCups(); this.refreshHud(); });
    this.leave(c, 700);
  }

  relayoutCups() { this.cups.forEach((c, i) => { c.home = this.cupHome(i); this.tweens.add({ targets: c, x: c.home.x, y: c.home.y, duration: 200 }); }); }

  leave(c, delay) {
    c.state = "leaving";
    this.time.delayedCall(delay, () => {
      const i = this.queue.indexOf(c); if (i >= 0) this.queue.splice(i, 1);
      c.walk.resume();
      c.body.setFlipX(true);
      this.tweens.add({ targets: c, x: -120, duration: 1500, onComplete: () => c.destroy() });
      this.layoutQueue();
    });
  }

  // ---------- events ----------
  kunafa() {
    if (this.day.left <= 0) return;
    this.kunafaOn = true;
    this.say("omar", "خلي بالك! كنافة جاية… دوس عليها!", 3500);
    const cat = this.add.image(W + 60, COUNTER.top + 40, "kunafa").setOrigin(0.5, 1).setScale(0.55).setInteractive({ useHandCursor: true });
    this.fxLayer.add(cat);
    this.tweens.add({ targets: cat, y: cat.y - 6, duration: 160, yoyo: true, repeat: -1 });
    const run = this.tweens.add({ targets: cat, x: COUNTER.x1 + 40, duration: 4000, ease: "Linear" });
    let done = false;
    const finish = shooed => {
      if (done) return; done = true; run.stop(); cat.disableInteractive();
      const lost = Kiosk.kunafa(this.day, shooed);
      if (shooed) {
        this.sound.play("boing", { volume: 0.6 });
        this.say("omar", "برافو! الكوبايات سليمة.", 1800);
      } else {
        this.sound.play("crash", { volume: 0.7 });
        for (let k = 0; k < lost; k++) {
          const cup = this.cups.pop(); if (!cup) break;
          cup.disableInteractive();
          this.tweens.add({ targets: cup, y: cup.y + 260, angle: 140, alpha: 0, duration: 700, delay: k * 120, onComplete: () => cup.destroy() });
        }
        this.say("omar", `كنافة وقّعت ${cupsW(lost)}…`, 2200);
        this.refreshHud();
      }
      cat.setFlipX(true);
      this.tweens.add({ targets: cat, x: W + 120, duration: 900, delay: 200, onComplete: () => { cat.destroy(); this.kunafaOn = false; } });
    };
    cat.on("pointerdown", () => finish(true));
    this.time.delayedCall(4000, () => finish(false));
    if (DEMO) this.time.delayedCall(1800, () => finish(true));
  }

  heat() {
    this.busy = true;
    this.sound.play("sparkle", { volume: 0.4 });
    this.tweens.add({ targets: this.sun, y: 260, duration: 900, ease: "Back.out" });
    this.tweens.add({ targets: this.heatTint, alpha: 0.13, duration: 900 });
    this.time.delayedCall(700, () => {
      this.say("farida", this.state.umbrella ? "الحر زاد… والشمسية جايبة ناس كتير! نعلّي السعر جنيه؟" : "الحر زاد! الناس عطشانة… نعلّي السعر جنيه؟");
      if (this.day.price >= Kiosk.RULES.maxPrice) { this.time.delayedCall(1500, () => this.afterHeat()); return; }
      const p = this.panel(170);
      const yes = this.button(W / 2 + 150, p.top + 85, 260, 96, "علّي لـ" + ar(this.day.price + 1), () => { Kiosk.raise(this.day); p.destroy(); this.afterHeat(); });
      const no = this.button(W / 2 - 150, p.top + 85, 260, 96, "خليه " + ar(this.day.price), () => { p.destroy(); this.afterHeat(); }, CREAM, 0xb9ac94);
      p.add([yes, no]); this.uiLayer.add(p);
      if (DEMO) this.time.delayedCall(1600, () => { p.destroy(); this.afterHeat(); });
    });
  }
  afterHeat() { this.hideSay(); this.refreshHud(); this.busy = false; this.spawnTimer.delay = 1700; }

  // ---------- end of day: Omar's notebook, then the shop or the comparison ----------
  endDay() {
    this.ended = true;
    this.spawnTimer.remove(); if (this.demoServer) this.demoServer.remove();
    this.armCups(false);
    this.tweens.add({ targets: this.sun, y: -160, duration: 700 });
    this.tweens.add({ targets: this.heatTint, alpha: 0, duration: 700 });
    const r = Kiosk.close(this.day);
    this.state.money = r.moneyAfter;
    this.state.history.push(r);
    this.time.delayedCall(800, () => this.notebook(r));
  }

  notebook(r) {
    this.hud.setVisible(false);
    const c = this.add.container(0, 0).setDepth(11);
    const x0 = 50, x1 = W - 50, y0 = 250;
    const lines = [
      ["بعنا", cupsW(r.sold)],
      ["دخل معانا", ar(r.revenue)],
      ["الخامات", `${ar(r.cups)} × ${ar(2)} = ${ar(r.cost)}`],
      ...(r.fell ? [["وقع من كنافة", cupsW(r.fell)]] : []),
      ...(r.spoiled ? [["باظ آخر اليوم", cupsW(r.spoiled)]] : []),
      ["المكسب", sgn(r.profit)],
      ["فلوسك دلوقتي", ar(r.moneyAfter)],
    ];
    const h = 120 + lines.length * 70;
    const g = this.add.graphics().fillStyle(INK, 0.4).fillRoundedRect(x0, y0 + 10, x1 - x0, h, 22)
      .fillStyle(0xfffdf3).fillRoundedRect(x0, y0, x1 - x0, h, 22).lineStyle(5, INK).strokeRoundedRect(x0, y0, x1 - x0, h, 22);
    for (let i = 0; i < lines.length; i++) g.lineStyle(2, 0xcfe3f2).lineBetween(x0 + 20, y0 + 150 + i * 70, x1 - 20, y0 + 150 + i * 70);
    c.add([g, txt(this, W / 2, y0 + 50, "📒 كشكول عمر · اليوم " + ar(this.state.dayNo), 36)]);
    this.uiLayer.add(c);
    lines.forEach(([k, v], i) => {
      const y = y0 + 115 + i * 70;
      const big = k === "المكسب";
      const a = txt(this, x1 - 40, y, k, big ? 40 : 34).setOrigin(1, 0.5).setAlpha(0);
      const b = txt(this, x0 + 40, y, v, big ? 42 : 34, big ? (r.profit > 0 ? "#3f8a3a" : "#c8553d") : "#3b2016").setOrigin(0, 0.5).setAlpha(0);
      c.add([a, b]);
      this.tweens.add({ targets: [a, b], alpha: 1, x: "-=0", duration: 250, delay: 500 + i * 550, onStart: () => this.sound.play("boing", { volume: 0.15, rate: 2 }) });
    });
    const after = 600 + lines.length * 550;
    this.time.delayedCall(after, () => {
      if (r.left === 0 && r.fell === 0 && r.profit <= 0) this.say("farida", "بعنا كله… إزاي ماكسبناش؟!");
      else if (r.fell) this.say("omar", "كنافة كلّفتنا كوبايتين… المرة الجاية ناخد بالنا.");
      else if (r.spoiled > 2) this.say("omar", `${cupsW(r.spoiled)} باظت… كان ممكن نعمل أقل.`);
      else if (r.profit > 0) { this.say("farida", "كسبنا! 🎉"); this.sound.play("sparkle", { volume: 0.5 }); }
      else this.say("omar", "الزباين مشيوا عشان غالي…");
      this.next(DEMO ? 2600 : null, () => { c.destroy(); this.state.dayNo === 1 ? this.shop() : this.compare(); }, "◀");
    });
  }

  shop() {
    const st = this.state;
    this.say("sitto", "الراديو بيقول: بكرة حر جدًا! ☀️");
    const p = this.panel(600);
    const y0 = p.top;
    const card = this.add.graphics().fillStyle(CREAM).fillRoundedRect(60, y0 + 40, W - 120, 380, 26).lineStyle(4, INK).strokeRoundedRect(60, y0 + 40, W - 120, 380, 26);
    const pic = this.add.image(W / 2, y0 + 160, "umbrella").setScale(0.62);
    const name = txt(this, W / 2, y0 + 270, "شمسية للكشك · " + ar(Kiosk.RULES.umbrellaCost), 38);
    const desc = txt(this, W / 2, y0 + 340, "في الحر بتجيب زباين أكتر.\nفي الجو العادي مابتفيدش.", 28, "#6b4a3a");
    const money = txt(this, W / 2, y0 + 455, "فلوسك: " + ar(st.money), 32, "#fff6e4");
    const can = st.money - Kiosk.RULES.umbrellaCost >= Kiosk.RULES.cupCost * Kiosk.RULES.minCups;
    const buy = this.button(W / 2 + 150, y0 + 540, 260, 92, can ? "اشتري" : "مش كفاية", () => {
      if (!can) return;
      st.money -= Kiosk.RULES.umbrellaCost; st.umbrella = true; p.destroy();
      this.sound.play("sparkle", { volume: 0.6 });
      this.umbrellaSpr.setVisible(true).setScale(0.2);
      this.tweens.add({ targets: this.umbrellaSpr, scale: 1, duration: 600, ease: "Back.out" });
      this.say("omar", `اشترينا الشمسية. فلوسنا بقت ${ar(st.money)}… نشوف هترجّع تمنها؟`);
      this.next(DEMO ? 2200 : null, () => this.nextDay(), "اليوم التاني ◀");
    });
    const skip = this.button(W / 2 - 150, y0 + 540, 260, 92, "لأ، شكرًا", () => {
      p.destroy(); this.say("omar", `ماشي، هنحوّش. فلوسنا ${ar(st.money)}.`);
      this.next(DEMO ? 1800 : null, () => this.nextDay(), "اليوم التاني ◀");
    }, CREAM, 0xb9ac94);
    if (!can) buy.setAlpha(0.5);
    p.add([card, pic, name, desc, money, buy, skip]);
    this.uiLayer.add(p);
    if (DEMO) this.time.delayedCall(2600, () => buy.emit("pointerup"));
  }

  nextDay() {
    this.say("omar", `معانا ${ar(this.state.money)}. هنعمل كام كوباية النهارده؟`);
    this.setup();
  }

  compare() {
    const h = this.state.history;
    const c = this.add.container(0, 0).setDepth(11);
    const g = this.add.graphics().fillStyle(0xfffdf3).fillRoundedRect(40, 260, W - 80, 470, 22).lineStyle(5, INK).strokeRoundedRect(40, 260, W - 80, 470, 22);
    c.add([g, txt(this, W / 2, 310, "اليومين جنب بعض", 36)]);
    const cols = ["اليوم", "كوبايات", "السعر", "دخل", "المكسب"];
    const xs = [600, 480, 370, 260, 130];
    cols.forEach((t, i) => c.add(txt(this, xs[i], 380, t, 26, "#6b4a3a")));
    h.forEach((r, row) => {
      const y = 450 + row * 80;
      const vals = [ar(row + 1) + (row === 1 && this.state.umbrella ? " ⛱" : ""), ar(r.cups), ar(r.price), ar(r.revenue), sgn(r.profit)];
      vals.forEach((v, i) => c.add(txt(this, xs[i], y, v, 34, i === 4 ? (r.profit > 0 ? "#3f8a3a" : "#c8553d") : "#3b2016")));
    });
    c.add(txt(this, W / 2, 640, "فلوسك في الآخر: " + ar(this.state.money) + (this.state.umbrella ? " + شمسية" : ""), 32));
    this.uiLayer.add(c);
    this.say("sitto", this.state.umbrella ? "الشمسية رجّعت تمنها؟ بصّوا على المكسب." : "إيه اللي ممكن يتغيّر لو اشترينا الشمسية؟");
    const again = this.button(W / 2, H - 130, 360, 100, "العب تاني 🔁", () => this.scene.restart());
    this.uiLayer.add(again);
    window.__done = true;
  }

  // demo: serve the front customer like a child would (drag a cup over)
  demoServe() {
    const front = this.queue[0];
    if (!front || front.state !== "waiting" || this.demoBusy) return;
    const cup = this.cups[this.cups.length - 1]; if (!cup) return;
    this.demoBusy = true;
    this.fxLayer.add(cup); cup.setScale(cup.baseScale * 1.25);
    this.tweens.add({ targets: cup, x: front.x, y: front.y - 100, duration: 650, delay: 500, ease: "Sine.inOut", onComplete: () => { this.demoBusy = false; this.serve(front, cup); } });
  }
}
new Phaser.Game({
  type: Phaser.AUTO, parent: "game", width: W, height: H, backgroundColor: "#2b1a12",
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 2 }, render: { antialias: true },
  scene: KioskScene,
});
