/* Prototype A: one authored day at the kiosk, built to test the FUN (placeholder customers).
   Spec: docs/specs/2026-11-20_prototype-a-design.md · economy: engine.js (KioskA) · art: art.js (ART)
   ?demo=1 plays itself at natural speed (for the gameplay video). */
"use strict";
const W = 720, H = 1280;
const QS = new URLSearchParams(location.search);
const DEMO = QS.get("demo") === "1";
const TEST = QS.get("test") === "1";   // test hooks for Playwright only (tests/); off in normal play
const FAST = TEST && QS.get("fast") === "1";
const INK = 0x3b2016, CREAM = 0xfff6e4, SUN = 0xf4b63c, SUN_D = 0xc98a1e, GREY = 0xb9ac94, ICE = 0x5bb6e6, ICE_D = 0x3b8fc0;
const FONT = '-apple-system, "Geeza Pro", "Noto Kufi Arabic", "Segoe UI", Tahoma, sans-serif';
const ar = x => String(x).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[d]);
const sgn = x => (x < 0 ? "−" : "") + ar(Math.abs(x));
const T = (s, x, y, str, size, color = "#3b2016", extra = {}) =>
  s.add.text(x, y, str, { fontFamily: FONT, fontSize: size + "px", color, fontStyle: "bold", rtl: true, align: "center", ...extra }).setOrigin(0.5);
const COUNTER = { x0: 105, x1: 372, top: 792 };
const SPOT = { x: 330, y: 1185 };          // where the customer stands, feet
const NAMES = { farida: "فريدة", omar: "عمر", sitto: "ستو صديقة", suad: "طنط سعاد", yahya: "يحيى", shawky: "عم شوقي", family: "العيلة", captain: "الكابتن" };

class Day extends Phaser.Scene {
  constructor() { super("day"); }

  preload() {
    const A = "assets/";
    this.load.image("bg", A + "bg.jpg");
    ["farida", "omar", "kunafa", "farida_face", "omar_face", "sitto_face"].forEach(k => this.load.image(k, A + k + ".png"));
    this.load.image("yahya", "assets/yahya.png");
    this.load.svg("cup", A + "cup.svg", { width: 60, height: 80 });
    this.load.svg("coin", A + "coin.svg", { width: 60, height: 60 });
    this.load.svg("sun", A + "sun.svg", { width: 160, height: 160 });
    for (const p of ART.PEOPLE) for (const e of ART.EXPR) this.load.svg(`${p}_${e}`, ART.url(ART.people[p](e)));
    for (const [k, s] of Object.entries(ART.props)) this.load.svg(k, ART.url(s));
    ["coin", "boing", "crash", "sparkle", "street"].forEach(k => this.load.audio(k, A + k + ".mp3"));
  }

  create() {
    this.add.image(W / 2, H / 2, "bg").setDisplaySize(W, 1290);
    this.heat = this.add.rectangle(W / 2, H / 2, W, H, 0xff8a2a, 0.08).setDepth(1);
    this.sunImg = this.add.image(610, 250, "sun").setDepth(1).setScale(0.8);
    this.tweens.add({ targets: this.sunImg, angle: { from: -8, to: 8 }, scale: 0.86, duration: 1800, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.add.text(238, 612, ar(KioskA.R.price), { fontFamily: FONT, fontSize: "52px", color: "#3b2016", fontStyle: "bold" }).setOrigin(0.5).setDepth(2);
    this.coinOnSign = this.add.image(290, 612, "coin").setScale(0.6).setDepth(2);
    this.iceBox = this.add.image(70, 905, "iceBox").setScale(0.55).setDepth(3).setVisible(false);
    this.omar = this.add.image(560, 975, "omar").setOrigin(0.5, 1).setScale(0.38).setDepth(3);
    this.farida = this.add.image(668, 965, "farida").setOrigin(0.5, 1).setScale(0.38).setDepth(3);
    [this.omar, this.farida].forEach((c, i) => this.tweens.add({ targets: c, scaleY: c.scaleY * 1.015, duration: 1400 + i * 300, yoyo: true, repeat: -1, ease: "Sine.inOut" }));
    this.cupLayer = this.add.layer().setDepth(4);
    this.custLayer = this.add.layer().setDepth(5);
    this.fx = this.add.layer().setDepth(9);
    this.ui = this.add.layer().setDepth(12);
    this.hud = this.makeHud();
    this.sound.pauseOnBlur = false;
    this.street = this.sound.add("street", { loop: true, volume: 0.22 });
    this.input.on("dragstart", (p, o) => { o.setScale(o.baseScale * 1.25); this.fx.add(o); });
    this.input.on("drag", (p, o, x, y) => o.setPosition(x, y));
    this.input.on("dragend", (p, o) => o.onDrop && o.onDrop(o));
    window.__a = this;
    Object.defineProperty(this, "phase", { configurable: true, get() { return this._phase; }, set(v) { this._phase = v; this._seq = (this._seq || 0) + 1; } });
    this.phase = { kind: "intro" };
    this.buttons = new Set();
    if (FAST) { this.time.timeScale = 3; this.tweens.timeScale = 3; }
    if (TEST) window.__test = this.testApi();
    this.run();
  }

  // ---------- helpers ----------
  wait(ms) { return new Promise(r => this.time.delayedCall(ms, r)); }
  play(k, cfg) { try { this.sound.play(k, cfg); } catch (e) {} }

  say(who, line, opts = {}) {
    if (this.bubble) this.bubble.destroy();
    const c = this.add.container(W / 2, 150).setDepth(13);
    const g = this.add.graphics().fillStyle(INK, 0.35).fillRoundedRect(-330, -70, 660, 160, 30)
      .fillStyle(CREAM).fillRoundedRect(-330, -78, 660, 156, 30).lineStyle(5, INK).strokeRoundedRect(-330, -78, 660, 156, 30);
    const faceKey = this.textures.exists(who + "_face") ? who + "_face" : (who === "yahya" ? "yahya" : `${who}_${opts.expr || "neutral"}`);
    const face = this.add.image(250, 0, faceKey);
    const fs = 118 / Math.max(face.width, face.height * (faceKey.endsWith("_face") ? 1 : 0.45));
    face.setScale(fs).setOrigin(0.5, faceKey.endsWith("_face") ? 0.5 : (who === "yahya" ? 0.22 : 0.26));
    const mask = this.make.graphics({}, false).fillCircle(W / 2 + 250, 150, 57);
    face.setMask(mask.createGeometryMask());
    const ring = this.add.graphics().lineStyle(5, INK).strokeCircle(250, 0, 60);
    const t1 = T(this, 170, -44, NAMES[who] || "", 26, "#c8553d").setOrigin(1, 0.5);
    const t2 = T(this, -60, 18, line, 34, "#3b2016", { wordWrap: { width: 440, useAdvancedWrap: true } });
    c.add([g, face, ring, t1, t2]);
    c.setScale(0.92).setAlpha(0);
    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 170, ease: "Back.out" });
    const body = who === "farida" ? this.farida : who === "omar" ? this.omar : (this.cust && this.cust.who === who ? this.cust.img : null);
    if (body) this.tweens.add({ targets: body, y: body.y - 10, duration: 130, yoyo: true, repeat: 3 });
    this.bubble = c;
    return this.wait(opts.ms || Math.max(1800, line.length * 75));
  }
  hush() { if (this.bubble) { this.bubble.destroy(); this.bubble = null; } }

  button(x, y, w, h, label, cb, color = SUN, dark = SUN_D, size = 36, sub) {
    const c = this.add.container(x, y);
    const base = this.add.graphics().fillStyle(dark).fillRoundedRect(-w / 2, -h / 2 + 8, w, h, 24);
    const face = this.add.graphics().fillStyle(color).fillRoundedRect(-w / 2, -h / 2, w, h, 24).lineStyle(4, INK).strokeRoundedRect(-w / 2, -h / 2, w, h, 24);
    const t = T(this, 0, sub ? -14 : 0, label, size);
    const top = this.add.container(0, 0, [face, t]);
    if (sub) top.add(T(this, 0, 26, sub, 22, "#6b4a3a"));
    c.add([base, top]).setSize(w, h + 8).setInteractive({ useHandCursor: true });
    c.on("pointerdown", () => { top.y = 7; });
    c.on("pointerout", () => { top.y = 0; });
    c.on("pointerup", () => { top.y = 0; this.play("boing", { volume: 0.22, rate: 1.7 }); cb(); });
    this.ui.add(c);
    c.labelText = label;
    this.buttons.add(c); c.once("destroy", () => this.buttons.delete(c));
    return c;
  }

  // two (or more) choices; resolves with the index
  choose(title, opts, demoPick) {
    this.phase = { kind: "choose", title, options: opts.map(o => o.label) };
    return new Promise(res => {
      const n = opts.length, w = n === 2 ? 300 : 210;
      const bg = this.add.graphics().fillStyle(0x2b1a12, 0.86).fillRoundedRect(20, H - 300, W - 40, 270, 34);
      const tt = T(this, W / 2, H - 252, title, 32, "#fff6e4");
      this.ui.add([bg, tt]);
      const bs = opts.map((o, i) => this.button(W / 2 + (n === 2 ? (i === 0 ? 160 : -160) : (1 - i) * 230), H - 135, w, 130, o.label, () => done(i), i === 0 ? SUN : CREAM, i === 0 ? SUN_D : GREY, 34, o.sub));
      const done = i => { this.phase = { kind: "busy" }; bg.destroy(); tt.destroy(); bs.forEach(b => b.destroy()); res(i); };
      if (DEMO) this.time.delayedCall(2300, () => { const b = bs[demoPick]; b.list[1].y = 7; this.time.delayedCall(180, () => { this.play("boing", { volume: 0.22, rate: 1.7 }); done(demoPick); }); });
    });
  }

  next(label = "◀") {
    this.phase = { kind: "next" };
    return new Promise(res => {
      if (DEMO) { this.time.delayedCall(1700, res); return; }
      const b = this.button(W / 2, H - 120, 300, 100, label, () => { this.phase = { kind: "busy" }; b.destroy(); res(); });
    });
  }

  makeHud() {
    const c = this.add.container(0, 0).setDepth(11);
    const pill = (x, w) => this.add.graphics().fillStyle(CREAM).fillRoundedRect(x - w / 2, 32, w, 64, 32).lineStyle(4, INK).strokeRoundedRect(x - w / 2, 32, w, 64, 32);
    const coin = this.add.image(128, 64, "coin").setScale(0.72), cup = this.add.image(568, 64, "cup").setScale(0.52);
    const money = T(this, 212, 64, "", 36), cups = T(this, 632, 64, "", 36);
    c.add([pill(190, 220), pill(605, 170), coin, cup, money, cups]);
    c.set = (m, k) => { money.setText(ar(m)); cups.setText(ar(k)); };
    c.coin = { x: 128, y: 64 };
    return c;
  }
  refresh() { this.hud.set(this.d.money, this.d.cupsLeft); }

  // ---------- cups on the counter ----------
  cupHome(i) { return { x: COUNTER.x1 - 20 - (i % 8) * 31, y: COUNTER.top - 22 - Math.floor(i / 8) * 40 }; }
  layCups(n, key = "cup") {
    this.cupLayer.removeAll(true); this.cups = [];
    for (let i = 0; i < n; i++) {
      const h = this.cupHome(i), c = this.add.image(h.x, h.y, key).setScale(0.55);
      c.baseScale = 0.55; c.home = h; this.cupLayer.add(c); this.cups.push(c);
    }
  }
  backHome(o) { this.cupLayer.add(o); this.tweens.add({ targets: o, x: o.home.x, y: o.home.y, scale: o.baseScale, duration: 220 }); }

  // ---------- customers ----------
  async enter(who) {
    this.phase = { kind: "busy", who };
    const isYahya = who === "yahya";
    const key = isYahya ? "yahya" : `${who}_neutral`;
    const img = this.add.image(0, 0, key).setOrigin(0.5, 1);
    img.setScale(isYahya ? 0.62 : (who === "family" ? 1.05 : who === "captain" ? 0.95 : 1.15));
    const c = this.add.container(W + 160, SPOT.y, [img]);
    this.custLayer.add(c);
    this.cust = { who, c, img, isYahya };
    const bob = this.tweens.add({ targets: img, y: -10, angle: { from: -3, to: 3 }, duration: 210, yoyo: true, repeat: -1 });
    await new Promise(r => this.tweens.add({ targets: c, x: SPOT.x + (who === "family" ? 40 : 0), duration: 1300, ease: "Sine.out", onComplete: r }));
    bob.stop(); img.y = 0; img.angle = 0;
    this.tweens.add({ targets: img, scaleY: img.scaleY * 0.92, scaleX: img.scaleX * 1.05, duration: 110, yoyo: true });
    return this.cust;
  }
  react(expr, fx) {
    const { who, img, isYahya, c } = this.cust;
    if (!isYahya) img.setTexture(`${who}_${expr}`);
    if (expr === "happy") {
      this.tweens.add({ targets: img, y: -40, duration: 180, yoyo: true, ease: "Quad.out" });
      this.burst(c.x, c.y - 300, fx || "heart", 7);
    } else if (expr === "sad") {
      this.tweens.add({ targets: c, x: c.x + 8, duration: 60, yoyo: true, repeat: 3 });
    } else if (expr === "surprised") {
      this.tweens.add({ targets: img, scaleY: img.scaleY * 1.1, duration: 120, yoyo: true });
    }
  }
  burst(x, y, key, n) {
    for (let i = 0; i < n; i++) {
      const p = this.add.image(x, y, key).setScale(0.8);
      this.fx.add(p);
      this.tweens.add({ targets: p, x: x + Phaser.Math.Between(-150, 150), y: y - Phaser.Math.Between(40, 200), alpha: 0, angle: Phaser.Math.Between(-90, 90), scale: 1.2, duration: 900, ease: "Quad.out", onComplete: () => p.destroy() });
    }
  }
  async leave() {
    const { c, img } = this.cust;
    img.setFlipX(true);
    this.tweens.add({ targets: img, y: -10, duration: 210, yoyo: true, repeat: 6 });
    await new Promise(r => this.tweens.add({ targets: c, x: -200, duration: 1300, ease: "Sine.in", onComplete: r }));
    c.destroy(); this.cust = null;
  }
  async pay(amount, key = "coin", from) {
    const sx = this.cust.c.x, sy = this.cust.c.y - 200;
    const items = key === "note5" ? 1 : amount;
    for (let i = 0; i < items; i++) {
      const o = this.add.image(sx, sy, key).setScale(key === "note5" ? 0.9 : 0.6);
      this.fx.add(o);
      this.tweens.add({ targets: o, x: this.hud.coin.x, y: this.hud.coin.y, duration: 560, delay: i * 110, ease: "Cubic.in",
        onComplete: () => { o.destroy(); this.play("coin", { volume: 0.5, rate: 0.95 + Math.random() * 0.2 }); } });
    }
    await this.wait(560 + items * 110);
  }

  // drag n cups (of `key`) to the customer; resolves when served
  serve(n, key = "cup") {
    this.phase = { kind: "serve", n, cold: key === "coldCup", who: this.cust && this.cust.who };
    return new Promise(res => {
      let got = 0;
      const target = () => ({ x: this.cust.c.x, y: this.cust.c.y - 170 });
      const counter = n > 1 ? T(this, SPOT.x, SPOT.y - 420, `${ar(0)} / ${ar(n)}`, 40, "#fff6e4", { backgroundColor: "#2b1a12", padding: { x: 18, y: 6 } }).setDepth(13) : null;
      const armed = this.cups.slice();
      const onDrop = o => {
        const t = target();
        if (Phaser.Math.Distance.Between(o.x, o.y, t.x, t.y) > 190) return this.backHome(o);
        o.disableInteractive(); this.cups.splice(this.cups.indexOf(o), 1);
        this.tweens.add({ targets: o, x: t.x - 20 + got * 14, y: t.y + 20, scale: 0.45, duration: 150, onComplete: () => this.time.delayedCall(250, () => o.destroy()) });
        this.play("boing", { volume: 0.3, rate: 1.3 + got * 0.1 });
        got++; if (counter) counter.setText(`${ar(got)} / ${ar(n)}`);
        if (got >= n) { this.phase = { kind: "busy" }; armed.forEach(a => a.active && a.disableInteractive()); if (counter) counter.destroy(); if (hand) hand.destroy(); res(); }
      };
      armed.forEach(o => { o.setTexture(key); o.onDrop = onDrop; o.setInteractive({ draggable: true, useHandCursor: true }); this.input.setDraggable(o); });
      let hand = null;
      if (!this.taught && !DEMO) {
        this.taught = true;
        const from = this.cups[this.cups.length - 1];
        hand = T(this, from.x, from.y, "👆", 70).setDepth(14);
        this.tweens.add({ targets: hand, x: target().x, y: target().y, duration: 1100, repeat: -1, repeatDelay: 400 });
      }
      if (DEMO) {
        let k = 0;
        const go = () => {
          const o = this.cups[this.cups.length - 1]; if (!o) return;
          this.fx.add(o); o.setScale(o.baseScale * 1.25);
          this.tweens.add({ targets: o, x: target().x, y: target().y, duration: 620, ease: "Sine.inOut", onComplete: () => { onDrop(o); if (++k < n) this.time.delayedCall(250, go); } });
        };
        this.time.delayedCall(900, go);
      }
    });
  }

  // give change from the drawer; resolves when the right change was given
  change(price, paid) {
    this.phase = { kind: "change", price, paid, due: paid - price };
    return new Promise(res => {
      const bg = this.add.graphics().fillStyle(0x2b1a12, 0.9).fillRoundedRect(14, H - 175, W - 28, 160, 30);
      const head = T(this, W / 2, 330, `اداك ${ar(paid)} · السعر ${ar(price)} · الباقي؟`, 34, "#fff6e4", { backgroundColor: "#2b1a12", padding: { x: 20, y: 8 } });
      const tray = this.add.graphics().fillStyle(0x8a5a3a).fillRoundedRect(190, H - 160, W - 214, 100, 22).lineStyle(4, INK).strokeRoundedRect(190, H - 160, W - 214, 100, 22);
      const given = T(this, 100, H - 135, `اديته: ${ar(0)}`, 26, "#ffe2a8");
      this.ui.add([bg, head, tray, given]);
      const coins = [];
      let g = 0;
      const t = () => ({ x: this.cust.c.x, y: this.cust.c.y - 170 });
      const drop = o => {
        if (Phaser.Math.Distance.Between(o.x, o.y, t().x, t().y) > 200) { this.ui.add(o); this.tweens.add({ targets: o, x: o.home.x, y: o.home.y, scale: o.baseScale, duration: 200 }); return; }
        o.disableInteractive(); g++; given.setText(`اديته: ${ar(g)}`);
        this.d.money -= 1; this.refresh();
        this.play("coin", { volume: 0.5 });
        this.tweens.add({ targets: o, x: t().x, y: t().y + 30, scale: 0.4, alpha: 0, duration: 250 });
      };
      for (let i = 0; i < 6; i++) {
        const o = this.add.image(W - 70 - i * 78, H - 110, "coin").setScale(0.85);
        o.baseScale = 0.85; o.home = { x: o.x, y: o.y }; o.onDrop = drop;
        o.setInteractive({ draggable: true, useHandCursor: true }); this.input.setDraggable(o);
        this.ui.add(o); coins.push(o);
      }
      const ok = this.button(100, H - 78, 176, 92, "خلاص", async () => {
        const r = KioskA.change(price, paid, g);
        if (r.ok) { cleanup(); res(r); return; }
        if (r.short) { this.react("surprised"); await this.say(this.cust.who, `لسه ناقص ${ar(r.short)}!`, { ms: 1500 }); }
        else { this.react("surprised"); this.d.money += r.extra; this.refresh(); await this.say(this.cust.who, `ده كتير! خد ${ar(r.extra)} تاني… أنا أمين 😄`, { ms: 2200 }); cleanup(); res({ ok: true, honest: true }); }
      }, CREAM, GREY, 30);
      const cleanup = () => { this.phase = { kind: "busy" }; [bg, head, tray, given, ok, ...coins].forEach(o => o.destroy()); };
      if (DEMO) {
        const give = i => { const o = coins[i]; this.tweens.add({ targets: o, x: t().x, y: t().y, duration: 600, delay: 300, onComplete: () => drop(o) }); };
        this.time.delayedCall(1400, () => give(0)); this.time.delayedCall(2600, () => give(1));
        this.time.delayedCall(4000, () => ok.emit("pointerup"));
      }
    });
  }

  // ---------- test hooks (only with ?test=1): read-only state + positions in page pixels ----------
  testApi() {
    const scene = this;
    const toPage = (x, y) => {
      const r = scene.game.canvas.getBoundingClientRect();
      return { x: r.left + x * r.width / W, y: r.top + y * r.height / H };
    };
    const box = o => { const b = o.getBounds(); const a = toPage(b.x, b.y), z = toPage(b.right, b.bottom); return { x: (a.x + z.x) / 2, y: (a.y + z.y) / 2, w: z.x - a.x, h: z.y - a.y }; };
    return {
      phase: () => ({ ...JSON.parse(JSON.stringify(scene.phase)), seq: scene._seq }),
      money: () => scene.d ? scene.d.money : null,
      cupsLeft: () => scene.d ? scene.d.cupsLeft : null,
      day: () => scene.d ? JSON.parse(JSON.stringify(KioskA.close(scene.d))) : null,
      cups: () => (scene.cups || []).filter(c => c.active && c.input && c.input.enabled).map(c => toPage(c.x, c.y)),
      customer: () => scene.cust ? toPage(scene.cust.c.x, scene.cust.c.y - 170) : null,
      drawerCoins: () => scene.ui.list.filter(o => o.texture && o.texture.key === "coin" && o.input && o.input.enabled).map(o => toPage(o.x, o.y)),
      buttons: () => [...scene.buttons].filter(b => b.active && b.visible).map(b => {   // the touch area, not the drawing
        const r = scene.game.canvas.getBoundingClientRect(), k = r.width / W, c = toPage(b.x, b.y);
        return { label: b.labelText, x: c.x, y: c.y, w: b.width * k, h: b.height * k };
      }),
      texts: () => scene.children.list.concat(scene.ui.list).flatMap(o => o.list ? o.list.concat(o.list.flatMap(x => x.list || [])) : [o])
        .filter(o => o.type === "Text" && o.visible && o.text).map(o => { const b = o.getBounds(); return { text: o.text, left: b.x, right: b.right, top: b.y, bottom: b.bottom }; }),
      fps: () => Math.round(scene.game.loop.actualFps),
    };
  }

  // ---------- the day, written like an episode ----------
  async run() {
    await this.wait(400);
    if (!this.street.isPlaying) this.street.play();
    this.d = KioskA.newDay();
    this.layCups(KioskA.R.cups); this.refresh();
    await this.say("farida", "عندي فكرة! الحر نار… نفتح الكشك!");
    await this.say("omar", `جهّزنا ${ar(8)} كوبايات، كل واحدة بـ${ar(2)}. والسعر ${ar(3)}.`);
    this.hush();

    // 1 · Suad: a plain sale (teaches the drag)
    await this.enter("suad");
    await this.say("suad", "صباح الفل! واحد عصير لو سمحت.");
    await this.serve(1);
    this.react("happy");
    KioskA.sell(this.d, 1, 3); await this.pay(3); this.refresh();
    await this.say("suad", "تسلم إيدك يا حبيبي!", { ms: 1400, expr: "happy" });
    this.hush(); await this.leave();

    // 2 · Yahya pays with a 5: give change
    await this.enter("yahya");
    await this.say("yahya", `عايز واحدة… ومعايا ${ar(5)}!`);
    this.hush();
    await this.serve(1);
    KioskA.sell(this.d, 1, 3);                 // the sale itself: +3
    await this.pay(5, "note5"); this.d.money += 2; this.refresh(); // he hands over 5, so 2 more sit in the drawer until change is given
    const ch = await this.change(3, 5);        // each coin handed back takes 1 out of the drawer
    this.refresh();
    this.react("happy", "star");
    await this.say("yahya", ch.honest ? "كده مظبوط! باي!" : "مظبوط! انت شاطر 👍", { ms: 1500 });
    this.hush(); await this.leave();

    // Kunafa: spend 1 to protect 4
    const cat = this.add.image(W + 80, COUNTER.top - 10, "kunafa").setOrigin(0.5, 1).setScale(0.5).setDepth(6);
    this.tweens.add({ targets: cat, x: COUNTER.x1 - 40, y: COUNTER.top - 10, duration: 1200, ease: "Sine.out" });
    this.tweens.add({ targets: cat, y: COUNTER.top - 60, duration: 300, yoyo: true, delay: 900 });
    await this.wait(1300);
    await this.say("omar", "كنافة طلعت على الترابيزة! عينها على الكوبايات…", { ms: 1600 });
    const feed = await this.choose("هتعمل إيه؟", [{ label: "أكل ليها", sub: `بـ${ar(1)} وتقعد هادية` }, { label: "سيبها", sub: "يمكن ماتعملش حاجة" }], 0);
    this.hush();
    if (feed === 0) {
      KioskA.feedCat(this.d); this.refresh();
      const fish = this.add.image(560, 900, "fish").setScale(1).setDepth(7);
      this.tweens.add({ targets: fish, x: cat.x - 30, y: cat.y - 60, duration: 600, ease: "Quad.out", onComplete: () => fish.destroy() });
      await this.wait(600);
      this.play("sparkle", { volume: 0.4 });
      this.burst(cat.x, cat.y - 120, "heart", 5);
      this.tweens.add({ targets: cat, angle: { from: -4, to: 4 }, duration: 200, yoyo: true, repeat: 3 });
      await this.say("omar", `دفعنا ${ar(1)} وحمينا الكوبايات. كل كوباية بـ${ar(2)}!`, { ms: 2200 });
    } else {
      this.tweens.add({ targets: cat, x: cat.x - 120, duration: 300 });
      await this.wait(300);
      this.play("crash", { volume: 0.7 }); this.cameras.main.shake(250, 0.01);
      const lost = KioskA.catKnocks(this.d);
      for (let k = 0; k < lost; k++) { const o = this.cups.pop(); if (o) this.tweens.add({ targets: o, y: o.y + 300, angle: 160, alpha: 0, duration: 700, delay: k * 120, onComplete: () => o.destroy() }); }
      this.refresh();
      await this.say("farida", `يا خبر! ${ar(lost)} كوبايات وقعوا… دول بـ${ar(lost * 2)}!`, { ms: 2200 });
    }
    this.tweens.add({ targets: cat, x: -150, duration: 1100, ease: "Sine.in", onComplete: () => cat.destroy() });
    this.hush();

    // 3 · Shawky haggles
    await this.enter("shawky");
    await this.say("shawky", `${ar(3)}؟! غالي… أديك ${ar(2)}!`, { expr: "surprised" });
    this.react("surprised");
    await this.say("omar", `في الكشكول: الكوباية مكلفانا ${ar(2)}…`, { ms: 1700 });
    const haggle = await this.choose("عم شوقي عايزها بـ" + ar(2), [{ label: "لأ، بـ" + ar(3), sub: "ده سعرنا" }, { label: "ماشي بـ" + ar(2), sub: "عشان يفرح" }], 0);
    let shawkyPrice = 3;
    if (haggle === 1) { shawkyPrice = 2; await this.say("shawky", "انت جدع! 😄", { ms: 1200, expr: "happy" }); this.react("happy"); }
    else { await this.say("shawky", "ماشي يا سيدي… هات تلاتة.", { ms: 1500 }); }
    this.hush();
    await this.serve(1);
    KioskA.sell(this.d, 1, shawkyPrice); await this.pay(shawkyPrice); this.refresh();
    if (haggle === 1) await this.say("omar", `بعناها بـ${ar(2)}… يعني ماكسبناش منها ولا مليم.`, { ms: 2200 });
    else { this.react("happy"); await this.say("shawky", "بس عصيرك حلو، أعترف!", { ms: 1500, expr: "happy" }); }
    this.hush(); await this.leave();

    // 4 · the family: four cups, then asks for something cold
    await this.enter("family");
    const want = Math.min(4, this.d.cupsLeft);
    await this.say("family", `${ar(want)} كوبايات لو سمحت!`);
    this.hush();
    await this.serve(want);
    KioskA.sell(this.d, want, 3); this.react("happy"); await this.pay(want * 3); this.refresh();
    await this.say("family", "حلو… بس مافيش حاجة ساقعة؟ الجو نار!", { ms: 2000, expr: "sad" });
    this.react("sad");
    this.hush(); await this.leave();

    // 5 · the captain wants it cold, now
    await this.enter("captain");
    await this.say("captain", "حاجة ساقعة بسرعة! لسه مخلّص ماتش!", { expr: "surprised" });
    this.react("sad");
    await this.say("farida", "مافيش ساقع… 😔", { ms: 1300 });
    await this.say("captain", "خلاص… هروح أدوّر في حتة تانية.", { ms: 1600, expr: "sad" });
    KioskA.miss(this.d);
    this.hush(); await this.leave();

    // end of the day
    const r = KioskA.close(this.d);
    await this.notebook(r);
    await this.say("omar", "ناس كتير طلبوا ساقع… لو كان عندنا تلاجة ثلج؟", { ms: 2200 });
    const buy = await this.shop(r.money);
    if (buy) await this.epilogue(); else await this.say("omar", `ماشي، حوّشنا. معانا ${ar(r.money)}.`, { ms: 2000 });
    await this.finale(buy);
  }

  async notebook(r) {
    const x0 = 50, x1 = W - 50, y0 = 250;
    const rows = [["دخل معانا", ar(r.revenue)], ["التكاليف", ar(r.costs) + (r.expenses.length ? " (فيها أكل كنافة)" : "")], ...(r.lostCups ? [["وقع", ar(r.lostCups) + " كوبايات"]] : []), ["المكسب", sgn(r.profit)], ["معانا دلوقتي", ar(r.money)]];
    const h = 130 + rows.length * 72;
    const c = this.add.container(0, 0);
    const g = this.add.graphics().fillStyle(INK, 0.4).fillRoundedRect(x0, y0 + 10, x1 - x0, h, 22).fillStyle(0xfffdf3).fillRoundedRect(x0, y0, x1 - x0, h, 22).lineStyle(5, INK).strokeRoundedRect(x0, y0, x1 - x0, h, 22);
    c.add([g, T(this, W / 2, y0 + 52, "📒 كشكول عمر", 38)]);
    this.ui.add(c);
    for (let i = 0; i < rows.length; i++) {
      const [k, v] = rows[i], y = y0 + 125 + i * 72, big = k === "المكسب";
      const a = T(this, x1 - 40, y, k, big ? 40 : 34).setOrigin(1, 0.5).setAlpha(0);
      const b = T(this, x0 + 40, y, v, big ? 42 : 32, big ? (r.profit > 0 ? "#3f8a3a" : "#c8553d") : "#3b2016").setOrigin(0, 0.5).setAlpha(0);
      c.add([a, b]);
      await this.wait(550); this.play("boing", { volume: 0.15, rate: 2 });
      this.tweens.add({ targets: [a, b], alpha: 1, duration: 220 });
    }
    await this.wait(900);
    await this.next();
    c.destroy();
  }

  shop(money) {
    this.phase = { kind: "shop", money };
    return new Promise(async res => {
      const c = this.add.container(0, 0);
      const g = this.add.graphics().fillStyle(0x2b1a12, 0.9).fillRoundedRect(20, 250, W - 40, 760, 34)
        .fillStyle(CREAM).fillRoundedRect(60, 300, W - 120, 470, 26).lineStyle(4, INK).strokeRoundedRect(60, 300, W - 120, 470, 26);
      const pic = this.add.image(W / 2, 450, "iceBox").setScale(0.9);
      const name = T(this, W / 2, 610, "تلاجة ثلج · " + ar(KioskA.R.iceBox), 40);
      const desc = T(this, W / 2, 690, `الساقع بيتباع بـ${ar(KioskA.R.coldPrice)} بدل ${ar(KioskA.R.price)}\nوالزباين اللي مشيوا هيرجعوا`, 28, "#6b4a3a");
      const m = T(this, W / 2, 830, "معاك: " + ar(money), 34, "#fff6e4");
      c.add([g, pic, name, desc, m]); this.ui.add(c);
      this.tweens.add({ targets: pic, y: 440, duration: 700, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      const can = KioskA.buyIceBox(money) !== null;
      const b1 = this.button(W / 2 + 150, 930, 260, 100, can ? "اشتري" : "مش كفاية", () => { if (!can) return; done(true); });
      const b2 = this.button(W / 2 - 150, 930, 260, 100, "أحوّش", () => done(false), CREAM, GREY);
      const done = v => { this.phase = { kind: "busy" }; [c, b1, b2].forEach(o => o.destroy()); res(v); };
      if (DEMO) this.time.delayedCall(3000, () => b1.emit("pointerup"));
    });
  }

  async epilogue() {
    this.d.money = KioskA.buyIceBox(this.d.money); this.refresh();
    this.iceBox.setVisible(true).setScale(0.05);
    this.play("sparkle", { volume: 0.6 });
    this.tweens.add({ targets: this.iceBox, scale: 0.55, duration: 700, ease: "Back.out" });
    this.burst(this.iceBox.x + 60, this.iceBox.y - 40, "star", 12);
    await this.say("farida", "تلاجة ثلج! بكرة هنبيع ساقع! ❄️", { ms: 2000 });
    // a peek at tomorrow
    this.hush();
    this.cameras.main.flash(300, 255, 255, 255);
    T(this, W / 2, 230, "بكرة…", 60, "#fff6e4", { backgroundColor: "#2b1a12", padding: { x: 30, y: 10 } }).setDepth(14).setName("tomorrow");
    this.layCups(6, "coldCup");
    await this.wait(900);
    this.children.getByName("tomorrow").destroy();
    await this.enter("captain");
    await this.say("captain", "سمعت إن عندكم ساقع؟!", { expr: "surprised" });
    this.hush();
    await this.serve(1, "coldCup");
    this.react("happy", "star");
    await this.pay(KioskA.R.coldPrice + 1);
    this.d.money += KioskA.R.coldPrice + 1; this.refresh();
    await this.say("captain", `ساقع ومظبوط! خد ${ar(KioskA.R.coldPrice)}… وواحد بقشيش! 🥇`, { ms: 2400, expr: "happy" });
    this.burst(W / 2, 500, "star", 16);
    this.hush(); await this.leave();
  }

  async finale(bought) {
    const c = this.add.container(0, 0);
    const g = this.add.graphics().fillStyle(0xfffdf3).fillRoundedRect(50, 300, W - 100, 420, 26).lineStyle(5, INK).strokeRoundedRect(50, 300, W - 100, 420, 26);
    c.add([g, T(this, W / 2, 360, bought ? "التلاجة رجّعت جزء من تمنها من أول زبون!" : "حوّشت فلوسك", 32),
      T(this, W / 2, 470, "الهدف الجاي 🍦", 40), T(this, W / 2, 545, "عربية آيس كريم · " + ar(50), 36, "#3f8a3a"),
      T(this, W / 2, 625, "معاك " + ar(this.d.money) + " من " + ar(50), 30, "#6b4a3a")]);
    this.ui.add(c);
    await this.say("sitto", bought ? "شاطر! صرفت عشان تكسب أكتر. ولو كنت عملت حاجة تانية مع عم شوقي؟" : "التحويش حلو… بس الزباين اللي مشيوا؟ جرّب تاني!", { ms: 3000 });
    window.__done = true;
    this.phase = { kind: "done" };
    this.button(W / 2, H - 130, 380, 104, "العب تاني 🔁", () => this.scene.restart());
  }
}

new Phaser.Game({
  type: Phaser.AUTO, parent: "game", width: W, height: H, backgroundColor: "#2b1a12",
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 2 }, scene: Day,
});
