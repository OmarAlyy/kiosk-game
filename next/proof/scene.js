/* Art and game-feel proof, step 1: Yahya's cold-juice moment (one customer, one order, sale, change, reaction).
   Brief: docs/specs/2026-11-21_yahya-scene-brief.md. All in-scene: no pop-up panels.
   ?test=1 exposes read-only hooks and logs every sound with its time (for the video's audio track). */
"use strict";
const W = 720, H = 1280;
const QS = new URLSearchParams(location.search);
const TEST = QS.get("test") === "1";
const INK = 0x3b2016, CREAM = 0xfff6e4;
const FONT = '"Baloo Bhaijaan 2", "Geeza Pro", sans-serif';
const ar = x => String(x).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[d]);
const PRICE = 3, PAID = 5, DUE = PAID - PRICE;
const TOP = 900;                         // counter top line
const Y = { x: 340, feet: 1237, scale: 1.53 };   // Yahya: the counter hides him from the waist down

class Scene extends Phaser.Scene {
  constructor() { super("yahya"); }

  preload() {
    ["open", "closed", "open_blink", "closed_blink"].forEach(k => this.load.image("y_" + k, `art/yahya_${k}.png`));
    this.load.image("street", "art/street_blur.jpg");
    for (const [k, svg] of Object.entries(PROPS.p)) this.load.svg(k, PROPS.url(svg));
    ["pour", "ice", "ice2", "coin", "coin1", "pop", "tap", "good", "deny", "step", "talk", "sparkle", "whoosh", "street"].forEach(k => this.load.audio(k, `sfx/${k}.mp3`));
  }

  create() {
    this.sfxLog = [];
    this.money = 20; this.cupsLeft = 6; this.ice = 8;
    this.phase = "start";
    this.add.image(W / 2, H / 2, "street");
    this.add.rectangle(W / 2, H / 2, W, H, 0xffd08a, 0.10);
    // Yahya (behind the counter)
    this.yahya = this.add.container(W + 260, Y.feet);
    this.yImg = this.add.image(0, 0, "y_closed").setOrigin(0.5, 1).setScale(Y.scale);
    this.yahya.add(this.yImg);
    this.mouthOpen = false; this.blinking = false;
    // the counter
    this.add.image(W / 2, TOP + 200, "counterFront").setDisplaySize(W + 20, 380);
    this.add.image(W / 2, TOP + 8, "counterTop").setDisplaySize(W + 30, 80);
    // props on the counter
    this.jug = this.add.image(108, TOP - 62, "jug").setScale(0.9).setInteractive({ useHandCursor: true });
    this.iceBox = this.add.container(612, TOP - 40);
    this.iceBody = this.add.image(0, 0, "iceBox").setScale(0.8);
    this.iceLid = this.add.image(-74, -44, "iceLid").setOrigin(0.05, 0.6).setScale(0.8);
    this.iceBox.add([this.iceBody, this.iceLid]).setSize(170, 130).setInteractive({ useHandCursor: true });
    this.piggy = this.add.image(470, TOP - 42, "piggy").setScale(0.62);
    this.piggyFill = 0;
    // the cup (built from layers so the juice can rise inside it)
    this.cup = this.makeCup(250, TOP - 52);
    // under the counter: the change dish and the drawer
    this.dish = this.add.image(250, 1110, "dish").setScale(1.05);
    this.dishLabel = this.add.text(250, 1180, "الباقي ليحيى", { fontFamily: FONT, fontSize: "30px", color: "#fff6e4", fontStyle: "800", rtl: true }).setOrigin(0.5);
    this.drawer = this.add.container(560, 1110);
    this.drawer.add(this.add.image(0, 0, "tray").setScale(0.9));
    this.drawerLabel = this.add.text(560, 1180, "الدرج", { fontFamily: FONT, fontSize: "30px", color: "#fff6e4", fontStyle: "800", rtl: true }).setOrigin(0.5);
    this.drawerCoins = [];
    for (let i = 0; i < 6; i++) this.addDrawerCoin(i);
    // HUD
    this.makeHud();
    this.fx = this.add.layer().setDepth(20);
    this.input.on("dragstart", (p, o) => { o.onDragStart && o.onDragStart(); });
    this.input.on("drag", (p, o, x, y) => { o.x = x; o.y = y; });
    this.input.on("dragend", (p, o) => o.onDrop && o.onDrop());
    this.idle();
    if (TEST) window.__proof = this.hooks();
    this.startScreen();
  }

  update() { if (this.cup && !this.cupCarried) this.cup.setLevel(this.cup.level); else if (this.cup) { const m = this.cup.getWorldTransformMatrix(); this.cup.maskG.clear().fillStyle(0xffffff).fillRect(m.tx - 60, m.ty + 52 - 100 * this.cup.level, 120, 100 * this.cup.level + 4); } }   // keep the juice mask on the cup while it moves

  // ---------- sound with a log (the video's audio track is rebuilt from it) ----------
  sfx(k, cfg = {}) {
    try { this.sound.play(k, cfg); } catch (e) {}
    this.sfxLog.push({ k, t: this.time.now, vol: cfg.volume ?? 1, rate: cfg.rate ?? 1 });
  }

  makeHud() {
    const pill = (x, w) => this.add.graphics().fillStyle(INK).fillRoundedRect(x - w / 2, 38, w, 70, 35).fillStyle(CREAM).fillRoundedRect(x - w / 2, 30, w, 70, 35).lineStyle(5, INK).strokeRoundedRect(x - w / 2, 30, w, 70, 35);
    pill(600, 200); pill(330, 150); pill(150, 150);
    this.add.image(530, 65, "coin").setScale(0.72);
    this.hudMoney = this.add.text(612, 65, "", { fontFamily: FONT, fontSize: "40px", color: "#3b2016", fontStyle: "800" }).setOrigin(0.5);
    const c = this.add.image(286, 66, "cupBack").setScale(0.36); this.add.image(286, 66, "juice").setScale(0.36); this.add.image(286, 66, "cupFront").setScale(0.36);
    this.hudCups = this.add.text(350, 65, "", { fontFamily: FONT, fontSize: "40px", color: "#3b2016", fontStyle: "800" }).setOrigin(0.5);
    this.add.image(106, 66, "cube").setScale(1.05);
    this.hudIce = this.add.text(168, 65, "", { fontFamily: FONT, fontSize: "40px", color: "#3b2016", fontStyle: "800" }).setOrigin(0.5);
    this.refresh();
  }
  refresh() { this.hudMoney.setText(ar(this.money)); this.hudCups.setText(ar(this.cupsLeft)); this.hudIce.setText(ar(this.ice)); }
  bump(t) { this.tweens.add({ targets: t, scale: 1.25, duration: 90, yoyo: true }); }

  makeCup(x, y) {
    const c = this.add.container(x, y);
    const back = this.add.image(0, 0, "cupBack").setScale(0.95);
    const juice = this.add.image(0, 0, "juice").setScale(0.95);
    const m = this.make.graphics({}, false);
    juice.setMask(m.createGeometryMask());
    const front = this.add.image(0, 0, "cupFront").setScale(0.95);
    const cubes = this.add.container(0, 0);
    c.add([back, juice, cubes, front]);
    c.level = 0; c.cubes = 0; c.maskG = m; c.cubeLayer = cubes; c.home = { x, y };
    c.setLevel = v => { c.level = v; m.clear().fillStyle(0xffffff).fillRect(c.x - 60, c.y + 52 - 100 * v, 120, 100 * v + 4); };
    c.setLevel(0);
    c.setSize(90, 120).setInteractive({ useHandCursor: true, draggable: true });
    this.input.setDraggable(c);
    c.onDragStart = () => { c.dragging = true; this.sfx("tap", { volume: 0.4 }); };
    c.onDrop = () => this.dropCup();
    return c;
  }

  addDrawerCoin(i) {
    const x = 560 - 75 + (i % 3) * 75, y = 1085 + Math.floor(i / 3) * 52;
    const coin = this.add.image(x, y, "coin").setScale(0.95).setInteractive({ useHandCursor: true, draggable: true });
    coin.home = { x, y }; this.input.setDraggable(coin);
    coin.onDragStart = () => { this.sfx("coin1", { volume: 0.35 }); coin.setScale(1.1); };
    coin.onDrop = () => this.dropCoin(coin);
    this.drawerCoins.push(coin);
  }

  // ---------- Yahya's life ----------
  idle() {
    // breathing, a small sway, blinks and the talking mouth are frame swaps of the same drawing
    this.tweens.add({ targets: this.yImg, scaleY: Y.scale * 1.012, duration: 1300, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.time.addEvent({ delay: 2600, loop: true, callback: () => { if (Math.random() < 0.85) this.blink(); } });
    this.time.addEvent({ delay: 110, loop: true, callback: () => { if (this.talking) { this.mouthOpen = !this.mouthOpen; this.frame(); } } });
  }
  frame() { this.yImg.setTexture("y_" + (this.mouthOpen ? "open" : "closed") + (this.blinking ? "_blink" : "")); }
  blink() { this.blinking = true; this.frame(); this.time.delayedCall(110, () => { this.blinking = false; this.frame(); }); }
  say(text, ms = 1300, tone = 1) {
    if (this.bub) this.bub.destroy();
    const b = this.add.container(W / 2, 158).setDepth(15);
    const t = this.add.text(0, 0, text, { fontFamily: FONT, fontSize: "40px", color: "#3b2016", fontStyle: "800", rtl: true }).setOrigin(0.5);
    const w = Math.max(160, t.width + 60), h = 96;
    const g = this.add.graphics().fillStyle(INK, 0.3).fillRoundedRect(-w / 2, -h / 2 + 8, w, h, 40).fillStyle(0xffffff).fillRoundedRect(-w / 2, -h / 2, w, h, 40).lineStyle(6, INK).strokeRoundedRect(-w / 2, -h / 2, w, h, 40)
      .fillStyle(0xffffff).fillTriangle(-w / 2 + 40, h / 2 - 4, -w / 2 + 74, h / 2 - 4, -w / 2 + 34, h / 2 + 30).lineStyle(6, INK).lineBetween(-w / 2 + 40, h / 2, -w / 2 + 34, h / 2 + 30).lineBetween(-w / 2 + 34, h / 2 + 30, -w / 2 + 74, h / 2);
    b.add([g, t]); b.setScale(0.6); this.tweens.add({ targets: b, scale: 1, duration: 220, ease: "Back.out" });
    this.bub = b;
    this.talking = true; this.sfx("talk", { volume: 0.35, rate: 1.25 * tone });
    this.time.delayedCall(Math.min(ms, 900), () => { this.talking = false; this.mouthOpen = false; this.frame(); });
    return new Promise(r => this.time.delayedCall(ms, r));
  }
  hush() { if (this.bub) { this.bub.destroy(); this.bub = null; } }

  walkIn() {
    this.yImg.setFlipX(true);
    return new Promise(res => {
      const bob = this.tweens.add({ targets: this.yImg, y: -16, angle: { from: -2.2, to: 2.2 }, duration: 230, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      const steps = this.time.addEvent({ delay: 300, repeat: 4, callback: () => this.sfx("step", { volume: 0.2, rate: 1.3 }) });
      this.tweens.add({ targets: this.yahya, x: Y.x, duration: 1500, ease: "Sine.out", onComplete: () => {
        bob.stop(); steps.remove(); this.yImg.y = 0; this.yImg.angle = 0; this.yImg.setFlipX(false);
        // settle: a small squash and recover
        this.tweens.add({ targets: this.yImg, scaleY: Y.scale * 0.96, scaleX: Y.scale * 1.02, duration: 110, yoyo: true, onComplete: res });
      } });
    });
  }
  walkOut() {
    this.hush();
    this.yImg.setFlipX(true);
    const bob = this.tweens.add({ targets: this.yImg, y: -16, angle: { from: -2.2, to: 2.2 }, duration: 230, yoyo: true, repeat: -1 });
    this.time.addEvent({ delay: 300, repeat: 4, callback: () => this.sfx("step", { volume: 0.2, rate: 1.3 }) });
    return new Promise(r => this.tweens.add({ targets: this.yahya, x: -300, duration: 1500, ease: "Sine.in", onComplete: () => { bob.stop(); r(); } }));
  }
  hop() {
    // anticipation, jump, landing
    return new Promise(r => {
      this.tweens.chain({ targets: this.yImg, tweens: [
        { scaleY: Y.scale * 0.93, scaleX: Y.scale * 1.04, duration: 120, ease: "Quad.out" },
        { y: -70, scaleY: Y.scale * 1.04, scaleX: Y.scale * 0.98, duration: 200, ease: "Quad.out" },
        { y: 0, scaleY: Y.scale, scaleX: Y.scale, duration: 220, ease: "Bounce.out" },
      ], onComplete: r });
    });
  }
  shake() { this.tweens.add({ targets: this.yahya, x: Y.x + 10, duration: 60, yoyo: true, repeat: 3 }); }

  // ---------- the order ----------
  orderBubble() {
    const b = this.add.container(604, 420).setDepth(14);
    const g = this.add.graphics().fillStyle(INK, 0.3).fillRoundedRect(-110, -92, 220, 190, 48).fillStyle(0xffffff).fillRoundedRect(-110, -100, 220, 190, 48).lineStyle(6, INK).strokeRoundedRect(-110, -100, 220, 190, 48)
      .fillStyle(0xffffff).fillTriangle(-90, 70, -40, 84, -126, 132).lineStyle(6, INK).lineBetween(-90, 84, -126, 132).lineBetween(-126, 132, -50, 88);
    const cupIcon = [this.add.image(-24, -2, "cupBack").setScale(0.62), this.add.image(-24, -2, "juice").setScale(0.62), this.add.image(-24, -2, "cupFront").setScale(0.62)];
    const c1 = this.add.image(-38, -12, "cube").setScale(0.6), c2 = this.add.image(-14, 4, "cube").setScale(0.6);
    const tag = this.add.text(40, -6, "×١", { fontFamily: FONT, fontSize: "44px", color: "#3b2016", fontStyle: "800" }).setOrigin(0.5);
    const cold = this.add.container(0, -104, [this.add.graphics().fillStyle(0x5bb6e6).fillRoundedRect(-62, -24, 124, 48, 22).lineStyle(5, INK).strokeRoundedRect(-62, -24, 124, 48, 22),
      this.add.text(0, 0, "ساقع", { fontFamily: FONT, fontSize: "30px", color: "#fff", fontStyle: "800", rtl: true }).setOrigin(0.5)]);
    b.add([g, ...cupIcon, c1, c2, tag, cold]);
    b.setScale(0); this.tweens.add({ targets: b, scale: 1, duration: 260, ease: "Back.out" });
    this.sfx("pop", { volume: 0.5 });
    this.order = b;
  }

  // a soft pulsing ring shows what to touch next (no arrows, no text panels)
  guide(target, r = 90) {
    if (this.ring) this.ring.destroy();
    if (!target) return;
    const ring = this.add.circle(target.x, target.y, r).setStrokeStyle(8, 0xffffff, 0.9).setDepth(13);
    this.tweens.add({ targets: ring, scale: 1.18, alpha: 0.25, duration: 700, yoyo: true, repeat: -1 });
    this.ring = ring;
  }

  // ---------- actions ----------
  nope(target) { this.sfx("deny", { volume: 0.35 }); this.tweens.add({ targets: target, angle: { from: -6, to: 6 }, duration: 60, yoyo: true, repeat: 2, onComplete: () => { target.angle = 0; } }); }
  pour() {
    if (this.phase !== "make" || this.busy) return;
    if (this.cup.level > 0) return this.nope(this.jug);
    this.busy = true;
    this.sfx("pour", { volume: 0.6 });
    this.tweens.chain({ targets: this.jug, tweens: [
      { x: 168, y: TOP - 150, angle: -48, duration: 300, ease: "Quad.out" },
      { angle: -58, duration: 900, onStart: () => this.stream(true) },
      { x: 108, y: TOP - 62, angle: 0, duration: 260, ease: "Quad.in", onStart: () => this.stream(false) },
    ], onComplete: () => { this.busy = false; this.cupsLeft--; this.refresh(); this.bump(this.hudCups); this.next(); } });
    this.tweens.addCounter({ from: 0, to: 0.86, duration: 900, delay: 320, onUpdate: tw => this.cup.setLevel(tw.getValue()) });
  }
  stream(on) {
    if (!on) { if (this.streamG) { this.streamG.destroy(); this.streamG = null; } return; }
    const g = this.add.graphics().setDepth(6);
    this.streamG = g;
    const draw = () => { if (!this.streamG) return; g.clear().fillStyle(0xf6c93c).fillRoundedRect(232, TOP - 150, 14, 120, 7);
      if (Math.random() < 0.6) { const d = this.add.image(240 + Phaser.Math.Between(-18, 18), TOP - 92, "drop").setScale(0.7).setDepth(7);
        this.tweens.add({ targets: d, y: d.y - Phaser.Math.Between(20, 50), x: d.x + Phaser.Math.Between(-30, 30), alpha: 0, duration: 380, onComplete: () => d.destroy() }); } };
    this.time.addEvent({ delay: 60, repeat: 15, callback: draw });
  }
  addIce() {
    if (this.phase !== "make" || this.busy) return;
    if (this.cup.level === 0 || this.cup.cubes >= 2) return this.nope(this.iceBox);
    this.busy = true;
    this.tweens.add({ targets: this.iceLid, angle: -70, duration: 160, yoyo: true, hold: 520 });
    for (let i = 0; i < 2; i++) {
      const cube = this.add.image(612, TOP - 70, "cube").setScale(0.9).setDepth(8);
      this.tweens.add({ targets: cube, x: this.cup.x - 12 + i * 22, y: this.cup.y - 30 + i * 6, angle: 220, duration: 520, delay: 160 + i * 170, ease: "Quad.in",
        onComplete: () => { cube.destroy(); this.sfx(i ? "ice2" : "ice", { volume: 0.7 });
          const inCup = this.add.image(-14 + i * 22, -20 + i * 8, "cube").setScale(0.62).setAngle(i ? 18 : -12); this.cup.cubeLayer.add(inCup);
          for (let k = 0; k < 5; k++) { const d = this.add.image(this.cup.x, this.cup.y - 40, "drop").setScale(0.6).setDepth(8);
            this.tweens.add({ targets: d, x: d.x + Phaser.Math.Between(-50, 50), y: d.y - Phaser.Math.Between(20, 70), alpha: 0, duration: 420, onComplete: () => d.destroy() }); }
          this.cup.cubes++; this.ice--; this.refresh(); this.bump(this.hudIce);
          if (this.cup.cubes === 2) { this.frost(); this.busy = false; this.next(); } } });
    }
  }
  frost() {
    this.sfx("sparkle", { volume: 0.35, rate: 1.4 });
    for (let k = 0; k < 6; k++) { const s = this.add.image(this.cup.x + Phaser.Math.Between(-46, 46), this.cup.y + Phaser.Math.Between(-60, 40), "snow").setScale(0).setDepth(9);
      this.tweens.add({ targets: s, scale: 0.6, alpha: 0, angle: 90, duration: 700, delay: k * 60, onComplete: () => s.destroy() }); }
  }
  dropCup() {
    const near = Phaser.Math.Distance.Between(this.cup.x, this.cup.y, this.yahya.x, 640) < 160;
    if (!near || this.phase !== "make") return this.cupHome();
    if (this.cup.level === 0) { this.cupHome(); this.sfx("deny", { volume: 0.5 }); this.shake(); return this.say("فاضية!", 1000, 0.9); }
    if (this.cup.cubes < 2) { this.cupHome(); this.sfx("deny", { volume: 0.5 }); this.shake(); return this.say("ده مش ساقع! 🧊", 1300, 0.9); }
    this.phase = "pay";
    this.cup.disableInteractive(); this.guide(null);
    this.tweens.add({ targets: this.cup, x: this.yahya.x - 40, y: TOP - 70, duration: 180, ease: "Quad.out" });
    this.order.destroy(); this.sfx("good", { volume: 0.55 });
    this.blinkThen(() => this.payAndChange());
  }
  cupHome() { this.tweens.add({ targets: this.cup, x: this.cup.home.x, y: this.cup.home.y, duration: 240, ease: "Back.out", onUpdate: () => this.cup.setLevel(this.cup.level) }); }
  blinkThen(f) { this.blink(); this.time.delayedCall(250, f); }

  async payAndChange() {
    await this.say("الله! ساقع! خد ٥", 1300);
    // the note lands on the counter in front of him
    this.note = this.add.image(this.yahya.x + 40, 600, "note5").setScale(0.2).setDepth(12);
    this.noteNum = this.add.text(this.yahya.x + 40, 600, "٥", { fontFamily: FONT, fontSize: "40px", color: "#3b2016", fontStyle: "800" }).setOrigin(0.5).setDepth(13).setAlpha(0);
    this.sfx("whoosh", { volume: 0.4 });
    this.tweens.add({ targets: this.note, x: 560, y: TOP + 50, scale: 1, angle: -6, duration: 420, ease: "Back.out" });
    this.tweens.add({ targets: this.noteNum, x: 560, y: TOP + 52, alpha: 1, duration: 420 });
    this.money += PAID; this.refresh(); this.bump(this.hudMoney);
    // the sum, shown as things on the counter
    this.sum = this.add.text(470, TOP + 52, `− ${ar(PRICE)} = ؟`, { fontFamily: FONT, fontSize: "38px", color: "#3b2016", fontStyle: "800", backgroundColor: "#fff6e4", padding: { x: 10, y: 0 }, rtl: true }).setOrigin(1, 0.5).setDepth(13);
    this.given = 0; this.dishCoins = [];
    this.phase = "change"; this.hush();
    this.guide({ x: 560, y: 1110 }, 120);
  }
  dropCoin(coin) {
    const inDish = Phaser.Math.Distance.Between(coin.x, coin.y, 250, 1110) < 130;
    if (this.phase !== "change" || !inDish) { this.tweens.add({ targets: coin, x: coin.home.x, y: coin.home.y, scale: 0.95, duration: 200 }); return; }
    coin.disableInteractive(); this.drawerCoins.splice(this.drawerCoins.indexOf(coin), 1);
    const slot = this.dishCoins.length;
    this.tweens.add({ targets: coin, x: 215 + slot * 36, y: 1102 - slot * 4, scale: 0.8, duration: 160, ease: "Quad.out" });
    this.sfx("coin1", { volume: 0.6, rate: 1 + slot * 0.08 });
    this.dishCoins.push(coin); this.given++;
    this.money--; this.refresh();
    this.guide({ x: 250, y: 1110 }, 110);
    if (this.checkTimer) this.checkTimer.remove();
    this.checkTimer = this.time.delayedCall(1900, () => this.checkChange());   // give a slow child time to add the next coin
  }
  async checkChange() {
    if (this.given < DUE) { this.shake(); this.sfx("deny", { volume: 0.4 }); await this.say(DUE - this.given === 1 ? "لسه ناقص جنيه!" : "لسه ناقص جنيهين!", 1100, 0.9); this.hush(); return; }
    this.phase = "done"; this.guide(null);
    if (this.given > DUE) {
      const extra = this.given - DUE;
      await this.say(extra === 1 ? "ده كتير! خد جنيه 😄" : "ده كتير! خد الزيادة 😄", 1300);
      for (let i = 0; i < extra; i++) { const c = this.dishCoins.pop(); this.tweens.add({ targets: c, x: 560, y: 1100, duration: 300 }); this.money++; }
      this.refresh();
    }
    // he takes his change and is delighted
    this.dishCoins.forEach((c, i) => this.tweens.add({ targets: c, x: this.yahya.x - 30, y: 700, alpha: 0, scale: 0.4, duration: 380, delay: i * 90 }));
    // he picks up his juice: the cup goes with him from now on
    this.tweens.add({ targets: this.cup, x: this.yahya.x + 70, y: 760, duration: 380, ease: "Quad.out", onComplete: () => { this.cup.x -= this.yahya.x; this.cup.y -= Y.feet; this.yahya.add(this.cup); this.cupCarried = true; } });
    this.tweens.add({ targets: [this.note, this.noteNum], x: 560, y: 1110, scale: 0.6, alpha: 0, duration: 400, delay: 300 });
    this.sum.destroy();
    this.sfx("good", { volume: 0.7 });
    this.mouthOpen = true; this.frame();
    await this.hop();
    this.burst(this.yahya.x, 430, "star", 10); this.burst(this.yahya.x - 60, 520, "heart", 6);
    this.sfx("sparkle", { volume: 0.55 });
    await this.say("شكرًا! أحلى عصير في شارع الفكرة!", 1700);
    await new Promise(r => this.time.delayedCall(900, r));
    await this.walkOut();
    this.endCard();
  }
  burst(x, y, key, n) {
    for (let i = 0; i < n; i++) { const p = this.add.image(x, y, key).setScale(0.5).setDepth(16);
      this.tweens.add({ targets: p, x: x + Phaser.Math.Between(-220, 220), y: y - Phaser.Math.Between(40, 260), angle: Phaser.Math.Between(-120, 120), scale: 1.1, alpha: 0, duration: 950, ease: "Quad.out", onComplete: () => p.destroy() }); }
  }

  // ---------- flow ----------
  next() {
    if (this.phase !== "make") return;
    if (this.cup.level === 0) this.guide({ x: this.jug.x, y: this.jug.y });
    else if (this.cup.cubes < 2) this.guide({ x: 612, y: TOP - 40 });
    else this.guide({ x: this.yahya.x, y: 640 }, 130);
  }
  startScreen() {
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x2b1a12, 0.55).setDepth(30);
    const b = this.add.container(W / 2, H / 2).setDepth(31);
    const g = this.add.graphics().fillStyle(0xc98a1e).fillRoundedRect(-170, -56, 340, 120, 40).fillStyle(0xf4b63c).fillRoundedRect(-170, -64, 340, 120, 40).lineStyle(6, INK).strokeRoundedRect(-170, -64, 340, 120, 40);
    b.add([g, this.add.text(0, -4, "يلا نفتح الكشك", { fontFamily: FONT, fontSize: "46px", color: "#3b2016", fontStyle: "800", rtl: true }).setOrigin(0.5)]);
    b.setSize(340, 128).setInteractive({ useHandCursor: true });
    b.on("pointerup", async () => {
      dim.destroy(); b.destroy();
      try { this.sound.play("street", { loop: true, volume: 0.25 }); } catch (e) {}
      this.sfxLog.push({ k: "street", t: this.time.now, vol: 0.25, rate: 1, loop: true });
      this.phase = "enter";
      await this.walkIn();
      await this.say("الحر نار! عايز واحد ساقع!", 1400);
      this.hush();
      this.orderBubble();
      this.phase = "make";
      this.jug.on("pointerup", () => this.pour());
      this.iceBox.on("pointerup", () => this.addIce());
      this.next();
    });
    this.startBtn = b;
  }
  endCard() {
    this.phase = "end";
    const b = this.add.container(W / 2, 560).setDepth(31);
    const g = this.add.graphics().fillStyle(0xc98a1e).fillRoundedRect(-160, -52, 320, 112, 38).fillStyle(0xf4b63c).fillRoundedRect(-160, -60, 320, 112, 38).lineStyle(6, INK).strokeRoundedRect(-160, -60, 320, 112, 38);
    b.add([g, this.add.text(0, -4, "تاني 🔁", { fontFamily: FONT, fontSize: "46px", color: "#3b2016", fontStyle: "800", rtl: true }).setOrigin(0.5)]);
    b.setSize(320, 120).setInteractive({ useHandCursor: true }).on("pointerup", () => this.scene.restart());
    b.setScale(0); this.tweens.add({ targets: b, scale: 1, duration: 300, ease: "Back.out" });
    this.endBtn = b;
    window.__proofDone = true;
  }

  // ---------- test hooks (only with ?test=1) ----------
  hooks() {
    const s = this, toPage = (x, y) => { const r = s.game.canvas.getBoundingClientRect(); return { x: r.left + x * r.width / W, y: r.top + y * r.height / H }; };
    return {
      phase: () => s.phase, busy: () => !!s.busy, money: () => s.money, given: () => s.given,
      cupState: () => ({ level: s.cup.level, cubes: s.cup.cubes }), stock: () => ({ cups: s.cupsLeft, ice: s.ice }),
      start: () => toPage(W / 2, H / 2), jug: () => toPage(s.jug.x, s.jug.y), ice: () => toPage(612, TOP - 40),
      cup: () => toPage(s.cup.x, s.cup.y), yahya: () => toPage(s.yahya.x, 640), dish: () => toPage(250, 1110),
      drawerCoins: () => s.drawerCoins.map(c => toPage(c.x, c.y)), again: () => s.endBtn && toPage(W / 2, 560),
      sfxLog: () => s.sfxLog.map(e => ({ ...e })), clock: () => ({ scene: s.time.now, wall: Date.now() }),
    };
  }
}

document.fonts.load('800 40px "Baloo Bhaijaan 2"').catch(() => {}).finally(() => new Phaser.Game({
  type: Phaser.AUTO, parent: "game", width: W, height: H, backgroundColor: "#2b1a12",
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, input: { activePointers: 2 }, scene: Scene,
}));
