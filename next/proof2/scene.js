/* Art proof, step 2: Yahya as a layered rig (AI-made parts, A+ art direction).
   Brief: docs/specs/2026-11-20_yahya-rig-brief.md. Same moment as step 1 (pour, ice, serve, change), but:
   - Yahya is built from separate transparent parts (torso, head, face parts, arms) with pivots from art/yahya/rig.json;
   - he takes the cup with his hand (reach, grip, lift), and his face changes between expressions on the same head;
   - A+ layout: one money pill and a price pill always on screen, stock shown as objects with counts, a deeper counter.
   Every drawing is AI-made art (Flow, Nano Banana Pro); code only moves, swaps and layers it. UI pills and text are code.
   ?test=1 exposes read-only hooks and logs every sound with its time (for the video's audio track). */
"use strict";
const W = 720, H = 1280;
const QS = new URLSearchParams(location.search);
const TEST = QS.get("test") === "1";
const INK = 0x3b2016, CREAM = 0xfff6e4;
const FONT = '"Baloo Bhaijaan 2", "Geeza Pro", sans-serif';
const ar = x => String(x).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[d]);
const PRICE = 3, PAID = 5, DUE = PAID - PRICE;

// Layout. LINE = the counter top; the counter hides Yahya below it.
const LINE = 790;
const S = 0.342;                 // 2K art pixels -> game pixels
const TEX = S / 0.5;             // game textures are half the 2K size
const YX = 360;                  // Yahya's centre
// Set from art/yahya/rig.json: the 2K point that sits on the counter line, and the cup prop. The counter cup is cut from
// the cup in his grip drawing, so placing it by the recorded crop makes the hand-off land on the same pixels.
let ORIGIN, CUP_S, HAND, WORK, JUICE;
function fromRig(rig) {
  ORIGIN = rig.pivots.counterLine;
  const c = rig.cupProp;
  CUP_S = S * c.scale2k;
  HAND = { x: YX + (c.center2k[0] - ORIGIN[0]) * S, y: LINE + (c.center2k[1] - ORIGIN[1]) * S };
  WORK = { x: 205, y: HAND.y };
  JUICE = { top: c.juiceTopPx * CUP_S, bottom: c.juiceBottomPx * CUP_S };
}

class Scene extends Phaser.Scene {
  constructor() { super("yahya2"); }

  preload() {
    this.load.json("rig", "art/yahya/rig.json");
    ["torso", "torso_noRsleeve", "head", "armL_down", "armR_down", "armR_reach", "armR_grip", "eyes_eager", "eyes_blink", "eyes_happy", "eyes_surprised",
      "mouth_eager", "mouth_talk", "mouth_happy", "mouth_surprised"].forEach(k => this.load.image("y_" + k, `art/yahya/${k}.png`));
    ["counter", "jug", "icebox", "icebox_open", "claypot", "coin", "cupstack", "note", "cube", "cup_empty", "cup_juice", "cup_full", "tray", "dish"]
      .forEach(k => this.load.image(k, `art/${k}.png`));
    this.load.image("street", "art/bg_street.jpg");
    ["pour", "ice", "ice2", "coin", "coin1", "pop", "tap", "good", "deny", "step", "talk", "sparkle", "whoosh", "street"].forEach(k => this.load.audio(k, `sfx/${k}.mp3`));
  }

  create() {
    this.sfxLog = [];
    this.money = 20; this.cupsLeft = 6; this.ice = 8;
    this.phase = "start";
    fromRig(this.cache.json.get("rig"));
    this.add.image(W / 2, H / 2, "street").setDisplaySize(W, H);
    this.makeYahya();
    // the counter is in front of Yahya; it is wider than the screen so it keeps its proportions
    this.counter = this.add.image(W / 2, LINE - 40, "counter").setOrigin(0.5, 0).setScale((H - LINE + 40) / 668).setDepth(5);
    // things on the counter top (their bottoms sit on the line)
    this.jug = this.add.image(84, LINE + 6, "jug").setOrigin(0.5, 1).setScale(0.8).setDepth(6).setInteractive({ useHandCursor: true });
    this.stack = this.add.image(505, LINE + 6, "cupstack").setOrigin(0.5, 1).setScale(0.57).setDepth(6);
    this.iceBox = this.add.image(636, LINE + 6, "icebox").setOrigin(0.5, 1).setScale(0.62).setDepth(6).setInteractive({ useHandCursor: true });
    this.stackBadge = this.badge(505, LINE - 52);      // the counts sit on the objects themselves
    this.iceBadge = this.badge(636, LINE - 48);
    this.cup = this.makeCup(WORK.x, WORK.y);
    // in the counter front: the change dish and the open drawer with coins
    this.dish = this.add.image(150, 1085, "dish").setScale(0.5).setDepth(6);
    this.label(150, 1170, "الباقي ليحيى");
    this.tray = this.add.image(470, 1085, "tray").setScale(0.55).setDepth(6);
    this.label(470, 1190, "الدرج");
    this.drawerCoins = [];
    for (let i = 0; i < 6; i++) this.addDrawerCoin(i);
    this.makeHud();
    this.input.on("dragstart", (p, o) => { o.onDragStart && o.onDragStart(); });
    this.input.on("drag", (p, o, x, y) => { o.x = x; o.y = y; });
    this.input.on("dragend", (p, o) => o.onDrop && o.onDrop());
    this.idle();
    if (TEST) { window.__proof = this.hooks(); window.__scene = this; }   // __scene: only for still captures in tests
    this.startScreen();
  }

  update() {
    // the reaching/gripping arm is drawn in front of the cup, in its own container that follows its anchor in the rig
    if (this.armFront && this.armFront.visible) {
      const d = this.armRpose.getWorldTransformMatrix().decomposeMatrix();
      this.armFront.setPosition(d.translateX, d.translateY).setRotation(d.rotation).setScale(d.scaleX, d.scaleY);
    }
    // keep the juice mask on the cup while it moves
    if (!this.cup || !this.cup.visible) return;
    const m = this.cup.getWorldTransformMatrix();
    const top = JUICE.bottom - (JUICE.bottom - JUICE.top) * this.cup.level;
    this.cup.maskG.clear().fillStyle(0xffffff).fillRect(m.tx - 70, m.ty + top, 140, (JUICE.bottom - top) + 2);
  }

  sfx(k, cfg = {}) {
    try { this.sound.play(k, cfg); } catch (e) {}
    this.sfxLog.push({ k, t: this.time.now, vol: cfg.volume ?? 1, rate: cfg.rate ?? 1 });
  }

  // ---------- UI (code: pills, badges, labels, bubbles) ----------
  pill(x, y, w, h = 70) {
    return this.add.graphics().setDepth(18).fillStyle(INK).fillRoundedRect(x - w / 2, y - h / 2 + 7, w, h, h / 2).fillStyle(CREAM).fillRoundedRect(x - w / 2, y - h / 2, w, h, h / 2)
      .lineStyle(5, INK).strokeRoundedRect(x - w / 2, y - h / 2, w, h, h / 2);
  }
  makeHud() {
    // money: the Kunafa clay pot is the money icon
    this.pill(150, 62, 230);
    this.add.image(70, 58, "claypot").setScale(0.3).setDepth(19);
    this.hudMoney = this.add.text(165, 62, "", { fontFamily: FONT, fontSize: "42px", color: "#3b2016", fontStyle: "800" }).setOrigin(0.5).setDepth(19);
    // price: always readable
    this.pill(560, 62, 250);
    this.add.image(470, 60, "cup_full").setScale(0.095).setDepth(19);
    this.add.text(580, 62, `${ar(PRICE)} جنيه`, { fontFamily: FONT, fontSize: "40px", color: "#3b2016", fontStyle: "800", rtl: true }).setOrigin(0.5).setDepth(19);
    this.refresh();
  }
  badge(x, y) {
    const c = this.add.container(x, y).setDepth(9);
    const g = this.add.graphics().fillStyle(INK).fillCircle(0, 4, 30).fillStyle(CREAM).fillCircle(0, 0, 30).lineStyle(5, INK).strokeCircle(0, 0, 30);
    const t = this.add.text(0, 1, "", { fontFamily: FONT, fontSize: "34px", color: "#3b2016", fontStyle: "800" }).setOrigin(0.5);
    c.add([g, t]); c.text = t; return c;
  }
  label(x, y, s) { return this.add.text(x, y, s, { fontFamily: FONT, fontSize: "30px", color: "#fff6e4", fontStyle: "800", rtl: true, stroke: "#3b2016", strokeThickness: 8 }).setOrigin(0.5).setDepth(7); }
  refresh() { this.hudMoney.setText(ar(this.money)); this.stackBadge.text.setText(ar(this.cupsLeft)); this.iceBadge.text.setText(ar(this.ice)); }
  bump(t) { this.tweens.add({ targets: t, scale: 1.25, duration: 90, yoyo: true }); }

  makeCup(x, y) {
    const c = this.add.container(x, y).setDepth(8);
    const empty = this.add.image(0, 0, "cup_empty").setScale(CUP_S);
    const juice = this.add.image(0, 0, "cup_juice").setScale(CUP_S);
    const m = this.make.graphics({}, false);
    juice.setMask(m.createGeometryMask());
    const full = this.add.image(0, 0, "cup_full").setScale(CUP_S).setVisible(false);
    const cubes = this.add.container(0, 0);
    c.add([empty, juice, cubes, full]);
    c.level = 0; c.cubes = 0; c.maskG = m; c.cubeLayer = cubes; c.full = full; c.home = { x, y };
    c.setSize(120, 220).setInteractive({ useHandCursor: true, draggable: true });
    this.input.setDraggable(c);
    c.onDragStart = () => { this.sfx("tap", { volume: 0.4 }); c.setDepth(12); };
    c.onDrop = () => this.dropCup();
    return c;
  }

  addDrawerCoin(i) {
    const x = 470 - 105 + (i % 3) * 105, y = 1045 + Math.floor(i / 3) * 80;
    const coin = this.add.image(x, y, "coin").setScale(0.5).setDepth(10).setInteractive({ useHandCursor: true, draggable: true });
    coin.home = { x, y }; this.input.setDraggable(coin);
    coin.onDragStart = () => { this.sfx("coin1", { volume: 0.35 }); coin.setScale(0.56).setDepth(12); };
    coin.onDrop = () => this.dropCoin(coin);
    this.drawerCoins.push(coin);
  }

  // ---------- Yahya: a rig of separate parts ----------
  makeYahya() {
    const rig = this.cache.json.get("rig");
    const at = (n, px, py) => { const p = rig.parts[n]; return this.add.image((p.x - px) * S, (p.y - py) * S, "y_" + n).setOrigin(0, 0).setScale(TEX); };
    const group = (pivot) => this.add.container((pivot[0] - ORIGIN[0]) * S, (pivot[1] - ORIGIN[1]) * S);
    const pv = rig.pivots;
    this.yahya = this.add.container(W + 320, LINE).setDepth(2);       // origin = the counter-line point under his centre
    this.root = this.add.container(0, 0);                            // squash, stretch, breathing, hops
    this.yahya.add(this.root);
    // each moving part has an outer container for actions and an inner one for the idle loop, so they never fight
    this.armL = group(pv.elbowHangL); this.armLIdle = this.add.container(0, 0); this.armLIdle.add(at("armL_down", ...pv.elbowHangL)); this.armL.add(this.armLIdle);
    this.armR = group(pv.elbowHangR); this.armRIdle = this.add.container(0, 0); this.armRIdle.add(at("armR_down", ...pv.elbowHangR)); this.armR.add(this.armRIdle);
    this.torso = at("torso", ...ORIGIN);
    this.torsoCut = at("torso_noRsleeve", ...ORIGIN).setVisible(false);   // while a pose arm shows its own sleeve
    this.armRpose = group(pv.shoulderR);                                    // anchor only; the drawings live in armFront
    this.armFront = this.add.container(0, 0).setDepth(9).setVisible(false);
    this.reach = at("armR_reach", ...pv.shoulderR).setVisible(false);
    this.grip = at("armR_grip", ...pv.shoulderR).setVisible(false);
    this.armFront.add([this.reach, this.grip]);
    this.headTilt = group(pv.neck);
    this.head = this.add.container(0, 0); this.headTilt.add(this.head);
    this.head.add(at("head", ...pv.neck));
    this.eyes = {}; this.mouths = {};
    ["eager", "blink", "happy", "surprised"].forEach(k => { this.eyes[k] = at("eyes_" + k, ...pv.neck).setVisible(false); this.head.add(this.eyes[k]); });
    ["eager", "talk", "happy", "surprised"].forEach(k => { this.mouths[k] = at("mouth_" + k, ...pv.neck).setVisible(false); this.head.add(this.mouths[k]); });
    this.root.add([this.armL, this.armR, this.torso, this.torsoCut, this.armRpose, this.headTilt]);
    this.expr = null; this.armPose = "down";
    this.setExpr("eager");
  }
  // expressions are pairs of face parts on the same head; "talk" swaps only the mouth
  setExpr(name) {
    const set = { eager: ["eager", "eager"], happy: ["happy", "happy"], oops: ["surprised", "surprised"] }[name];
    this.expr = name;
    Object.entries(this.eyes).forEach(([k, im]) => im.setVisible(k === set[0]));
    Object.entries(this.mouths).forEach(([k, im]) => im.setVisible(k === set[1]));
    this.baseMouth = set[1]; this.baseEyes = set[0];
  }
  // a change of expression happens inside a blink, with a small squash of the head (anticipation, then overshoot)
  changeExpr(name) {
    if (name === this.expr) return Promise.resolve();
    this.changing = true;
    return new Promise(res => {
      Object.values(this.eyes).forEach(im => im.setVisible(false)); this.eyes.blink.setVisible(true);
      this.tweens.add({ targets: this.head, scaleY: 0.965, scaleX: 1.02, duration: 70, yoyo: true, ease: "Quad.out", onYoyo: () => this.setExpr(name), onComplete: () => { this.changing = false; res(); } });
    });
  }
  showMouth(k) { Object.entries(this.mouths).forEach(([n, im]) => im.setVisible(n === k)); }
  blink() {
    if (this.blinking || this.baseEyes === "happy" || this.changing) return;
    this.blinking = true;
    this.eyes[this.baseEyes].setVisible(false); this.eyes.blink.setVisible(true);
    this.time.delayedCall(110, () => { this.eyes.blink.setVisible(false); this.eyes[this.baseEyes].setVisible(true); this.blinking = false; });
  }
  setArm(pose) {
    this.armPose = pose;
    this.armR.setVisible(pose === "down");
    this.torso.setVisible(pose === "down"); this.torsoCut.setVisible(pose !== "down");
    this.armFront.setVisible(pose !== "down");
    if (pose !== "down") this.update();
    this.reach.setVisible(pose === "reach");
    this.grip.setVisible(pose === "grip");
  }

  idle() {
    // breathing (the whole body from the counter line), a slow head drift, arms swaying a little, blinks, a talking mouth
    this.tweens.add({ targets: this.root, scaleY: 1.012, scaleX: 0.997, duration: 1300, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.tweens.add({ targets: this.head, angle: { from: -1.2, to: 1.4 }, duration: 2300, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.tweens.add({ targets: [this.armLIdle], angle: { from: -1.5, to: 1.5 }, duration: 1700, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.tweens.add({ targets: [this.armRIdle], angle: { from: 1.5, to: -1.5 }, duration: 1900, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.time.addEvent({ delay: 2600, loop: true, callback: () => { if (Math.random() < 0.85) this.blink(); } });
    this.time.addEvent({ delay: 110, loop: true, callback: () => {
      if (!this.talking) return;
      this.mouthOpen = !this.mouthOpen;
      this.showMouth(this.mouthOpen ? "talk" : this.baseMouth);
    } });
  }
  say(text, ms = 1300, tone = 1) {
    if (this.bub) this.bub.destroy();
    const b = this.add.container(W / 2, 148).setDepth(15);
    const t = this.add.text(0, 0, text, { fontFamily: FONT, fontSize: "36px", color: "#3b2016", fontStyle: "800", rtl: true }).setOrigin(0.5);
    const w = Math.max(160, t.width + 56), h = 80;
    const g = this.add.graphics().fillStyle(INK, 0.3).fillRoundedRect(-w / 2, -h / 2 + 8, w, h, 40).fillStyle(0xffffff).fillRoundedRect(-w / 2, -h / 2, w, h, 40).lineStyle(6, INK).strokeRoundedRect(-w / 2, -h / 2, w, h, 40)
      .fillStyle(0xffffff).fillTriangle(-30, h / 2 - 4, 6, h / 2 - 4, -36, h / 2 + 30).lineStyle(6, INK).lineBetween(-30, h / 2, -36, h / 2 + 30).lineBetween(-36, h / 2 + 30, 6, h / 2);
    b.add([g, t]); b.setScale(0.6); this.tweens.add({ targets: b, scale: 1, duration: 220, ease: "Back.out" });
    this.bub = b;
    this.talking = true; this.sfx("talk", { volume: 0.35, rate: 1.25 * tone });
    this.time.delayedCall(Math.min(ms, 900), () => { this.talking = false; this.mouthOpen = false; this.showMouth(this.baseMouth); });
    return new Promise(r => this.time.delayedCall(ms, r));
  }
  hush() { if (this.bub) { this.bub.destroy(); this.bub = null; } }

  walk(toX, ms, ease) {
    return new Promise(res => {
      const bob = this.tweens.add({ targets: this.root, y: -14, angle: { from: -2, to: 2 }, duration: 230, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      const steps = this.time.addEvent({ delay: 300, repeat: Math.floor(ms / 300) - 1, callback: () => this.sfx("step", { volume: 0.2, rate: 1.3 }) });
      this.tweens.add({ targets: this.yahya, x: toX, duration: ms, ease, onComplete: () => { bob.stop(); steps.remove(); this.root.y = 0; this.root.angle = 0; res(); } });
    });
  }
  async walkIn() {
    await this.walk(YX, 1500, "Sine.out");
    await new Promise(r => this.tweens.add({ targets: this.root, scaleY: 0.96, scaleX: 1.02, duration: 110, yoyo: true, onComplete: r }));
  }
  walkOut() { this.hush(); return this.walk(-320, 1500, "Sine.in"); }
  hop(h = 50) {
    return new Promise(r => this.tweens.chain({ targets: this.root, tweens: [
      { scaleY: 0.93, scaleX: 1.04, duration: 120, ease: "Quad.out" },
      { y: -h, scaleY: 1.04, scaleX: 0.98, duration: 200, ease: "Quad.out" },
      { y: 0, scaleY: 1, scaleX: 1, duration: 230, ease: "Bounce.out" },
    ], onComplete: r }));
  }
  shake() { this.tweens.add({ targets: this.yahya, x: YX + 10, duration: 60, yoyo: true, repeat: 3, onComplete: () => { this.yahya.x = YX; } }); }

  // The cup-receiving motion: look down, reach, grip (his drawing takes over the cup), lift, joy.
  async receive() {
    this.busy = true;
    await new Promise(r => this.tweens.add({ targets: this.headTilt, angle: -4, y: this.headTilt.y + 4, duration: 140, ease: "Quad.out", onComplete: r }));
    // the hanging arm swings toward the cup, then the reaching drawing takes over and settles with a small overshoot
    await new Promise(r => this.tweens.add({ targets: this.armR, angle: -16, duration: 110, ease: "Quad.in", onComplete: r }));
    this.armR.angle = 0;
    this.setArm("reach"); this.armRpose.angle = 1.2;   // tiny: the pose arm carries its own sleeve, cut through flat shirt colour
    this.sfx("tap", { volume: 0.45 });
    await new Promise(r => this.tweens.add({ targets: this.armRpose, angle: 0, duration: 170, ease: "Back.out", onComplete: r }));
    await new Promise(r => this.time.delayedCall(90, r));
    // grip: his hand closes on the cup; from now on the cup is part of his drawing
    this.setArm("grip"); this.cup.setVisible(false);
    this.sfx("ice", { volume: 0.55, rate: 1.2 });
    this.armRpose.y += 5; this.tweens.add({ targets: this.armRpose, y: this.armRpose.y - 5, duration: 120, ease: "Quad.out" });
    this.tweens.add({ targets: this.headTilt, angle: 0, y: this.headTilt.y - 4, duration: 160 });
    await new Promise(r => this.time.delayedCall(140, r));
    // lift and joy: the face changes inside a blink, the cup comes up, he hops
    this.changeExpr("happy");
    this.sfx("good", { volume: 0.55 });
    this.tweens.add({ targets: this.armRpose, angle: -1, duration: 220, ease: "Quad.out" });   // the hop carries the lift
    await this.hop(42);
    this.sparkle(YX + 10, 420, 9);
    this.busy = false;
  }
  sparkle(x, y, n) {
    this.sfx("sparkle", { volume: 0.45 });
    for (let i = 0; i < n; i++) {
      const a = -Math.PI * (0.1 + 0.8 * i / Math.max(1, n - 1)), r0 = 170, r1 = 300;
      const s = this.add.image(x + Math.cos(a) * r0, y + Math.sin(a) * r0, "coin").setScale(0.1).setDepth(16);
      this.tweens.add({ targets: s, x: x + Math.cos(a) * r1, y: y + Math.sin(a) * r1, angle: Phaser.Math.Between(-180, 180), scale: 0.17, alpha: 0, duration: 850, ease: "Quad.out", onComplete: () => s.destroy() });
    }
  }

  // ---------- the order ----------
  orderBubble() {
    const b = this.add.container(590, 330).setDepth(14);
    const g = this.add.graphics().fillStyle(INK, 0.3).fillRoundedRect(-100, -92, 200, 190, 48).fillStyle(0xffffff).fillRoundedRect(-100, -100, 200, 190, 48).lineStyle(6, INK).strokeRoundedRect(-100, -100, 200, 190, 48)
      .fillStyle(0xffffff).fillTriangle(-80, 70, -30, 84, -116, 132).lineStyle(6, INK).lineBetween(-80, 84, -116, 132).lineBetween(-116, 132, -40, 88);
    const cupIcon = this.add.image(-30, 0, "cup_full").setScale(0.2);
    const cube = this.add.image(46, 28, "cube").setScale(0.3);
    const cold = this.add.container(0, -104, [this.add.graphics().fillStyle(0x5bb6e6).fillRoundedRect(-62, -24, 124, 48, 22).lineStyle(5, INK).strokeRoundedRect(-62, -24, 124, 48, 22),
      this.add.text(0, 0, "ساقع", { fontFamily: FONT, fontSize: "30px", color: "#fff", fontStyle: "800", rtl: true }).setOrigin(0.5)]);
    b.add([g, cupIcon, cube, cold]);
    b.setScale(0); this.tweens.add({ targets: b, scale: 1, duration: 260, ease: "Back.out" });
    this.sfx("pop", { volume: 0.5 });
    this.order = b;
  }
  guide(target, r = 90) {
    if (this.ring) this.ring.destroy();
    if (!target) return;
    r = Math.min(r, target.x - 6, W - 6 - target.x);
    const ring = this.add.circle(target.x, target.y, r).setStrokeStyle(8, 0xffffff, 0.9).setDepth(13);
    this.tweens.add({ targets: ring, scale: 1.18, alpha: 0.25, duration: 700, yoyo: true, repeat: -1 });
    this.ring = ring;
  }

  // ---------- actions ----------
  nope(target) { this.sfx("deny", { volume: 0.35 }); this.tweens.add({ targets: target, angle: { from: -6, to: 6 }, duration: 60, yoyo: true, repeat: 2, onComplete: () => { target.angle = 0; } }); }
  pour() {
    if (this.phase !== "make" || this.busy) return;
    if (this.cup.level > 0) return this.nope(this.jug);
    this.busy = true; this.input.setDraggable(this.cup, false);
    this.sfx("pour", { volume: 0.6 });
    const half = this.jug.displayHeight / 2;
    this.jug.setOrigin(0.5, 0.5); this.jug.y -= half;
    this.tweens.chain({ targets: this.jug, tweens: [
      { x: WORK.x - 78, y: LINE - 270, angle: 52, duration: 300, ease: "Quad.out" },
      { angle: 62, duration: 900, onStart: () => this.stream(true) },
      { x: 84, y: LINE + 6 - half, angle: 0, duration: 260, ease: "Quad.in", onStart: () => this.stream(false) },
    ], onComplete: () => { this.jug.setOrigin(0.5, 1); this.jug.y = LINE + 6; this.busy = false; this.input.setDraggable(this.cup, true); this.cupsLeft--; this.refresh(); this.bump(this.stackBadge); this.next(); } });
    this.tweens.addCounter({ from: 0, to: 1, duration: 900, delay: 320, onUpdate: tw => { this.cup.level = tw.getValue(); } });
  }
  stream(on) {
    if (!on) { if (this.streamG) { this.streamG.destroy(); this.streamG = null; } return; }
    const g = this.add.graphics().setDepth(7);
    this.streamG = g;
    const draw = () => { if (!this.streamG) return; g.clear().fillStyle(0xf2c53d).fillRoundedRect(WORK.x - 8, LINE - 230, 16, 150, 8); };
    this.time.addEvent({ delay: 60, repeat: 15, callback: draw });
  }
  addIce() {
    if (this.phase !== "make" || this.busy) return;
    if (this.cup.level === 0 || this.cup.cubes >= 3) return this.nope(this.iceBox);
    this.busy = true; this.input.setDraggable(this.cup, false);
    this.iceBox.setTexture("icebox_open");
    this.time.delayedCall(900, () => this.iceBox.setTexture("icebox"));
    for (let i = 0; i < 3; i++) {
      const cube = this.add.image(636, LINE - 120, "cube").setScale(0.2).setDepth(11);
      this.tweens.add({ targets: cube, x: this.cup.x - 20 + i * 20, y: this.cup.y - 40 + (i % 2) * 6, angle: 220, duration: 520, delay: 140 + i * 150, ease: "Quad.in",
        onComplete: () => { cube.destroy(); this.sfx(i % 2 ? "ice2" : "ice", { volume: 0.7 });
          const inCup = this.add.image(-20 + i * 20, -36 + (i % 2) * 6, "cube").setScale(0.13).setAngle(i ? 18 : -12); this.cup.cubeLayer.add(inCup);
          this.cup.cubes++; this.ice--; this.refresh(); this.bump(this.iceBadge);
          if (this.cup.cubes === 3) {
            // the finished drink: the full-cup drawing (ice and straw) takes over
            this.time.delayedCall(120, () => { this.cup.full.setVisible(true); this.cup.cubeLayer.setVisible(false); this.sfx("pop", { volume: 0.4, rate: 1.3 });
              this.tweens.add({ targets: this.cup, scaleY: 1.06, scaleX: 0.96, duration: 90, yoyo: true }); this.busy = false; this.input.setDraggable(this.cup, true); this.next(); });
          } } });
    }
  }
  dropCup() {
    this.cup.setDepth(8);
    if (this.busy) return this.cupHome();
    const near = Phaser.Math.Distance.Between(this.cup.x, this.cup.y, HAND.x, 600) < 190;
    if (!near || this.phase !== "make") return this.cupHome();
    if (this.cup.level === 0) { this.cupHome(); this.sfx("deny", { volume: 0.5 }); this.shake(); return this.say("فاضية!", 1000, 0.9); }
    if (this.cup.cubes < 3) { this.cupHome(); this.sfx("deny", { volume: 0.5 }); this.shake(); this.changeExpr("oops").then(() => this.time.delayedCall(900, () => this.changeExpr("eager"))); return this.say("ده مش ساقع!", 1300, 0.9); }
    this.phase = "pay";
    this.cup.disableInteractive(); this.guide(null);
    this.order.destroy();
    this.tweens.add({ targets: this.cup, x: HAND.x, y: HAND.y, duration: 200, ease: "Quad.out", onComplete: () => this.receive().then(() => this.pay()) });
  }
  cupHome() { this.tweens.add({ targets: this.cup, x: this.cup.home.x, y: this.cup.home.y, duration: 240, ease: "Back.out" }); }

  async pay() {
    await this.say("الله! ساقع! خد ٥", 1300);
    this.note = this.add.image(YX - 60, 640, "note").setScale(0.15).setDepth(12);
    this.noteNum = this.add.text(YX - 60, 640, "٥", { fontFamily: FONT, fontSize: "46px", color: "#fff6e4", fontStyle: "800", stroke: "#3b2016", strokeThickness: 8 }).setOrigin(0.5).setDepth(13).setAlpha(0);
    this.sfx("whoosh", { volume: 0.4 });
    this.tweens.add({ targets: this.note, x: 470, y: 1000, scale: 0.5, angle: -6, duration: 460, ease: "Back.out" });
    this.tweens.add({ targets: this.noteNum, x: 470, y: 1000, alpha: 1, duration: 460 });
    this.money += PAID; this.refresh(); this.bump(this.hudMoney);
    this.sum = this.add.text(150, 985, `٥ − ${ar(PRICE)} = ؟`, { fontFamily: FONT, fontSize: "36px", color: "#3b2016", fontStyle: "800", backgroundColor: "#fff6e4", padding: { x: 12, y: 0 }, rtl: true }).setOrigin(0.5).setDepth(13);
    this.given = 0; this.dishCoins = [];
    this.phase = "change"; this.hush();
    this.guide({ x: 470, y: 1085 }, 120);
  }
  dropCoin(coin) {
    coin.setDepth(10);
    const inDish = Phaser.Math.Distance.Between(coin.x, coin.y, 150, 1085) < 130;
    if (this.phase !== "change" || !inDish) { this.tweens.add({ targets: coin, x: coin.home.x, y: coin.home.y, scale: 0.5, duration: 200 }); return; }
    coin.disableInteractive(); this.drawerCoins.splice(this.drawerCoins.indexOf(coin), 1);
    const slot = this.dishCoins.length;
    this.tweens.add({ targets: coin, x: 108 + slot * 34, y: 1078 - slot * 4, scale: 0.42, duration: 160, ease: "Quad.out" });
    this.sfx("coin1", { volume: 0.6, rate: 1 + slot * 0.08 });
    this.dishCoins.push(coin); this.given++;
    this.money--; this.refresh();
    this.guide({ x: 150, y: 1085 }, 110);
    if (this.checkTimer) this.checkTimer.remove();
    this.checkTimer = this.time.delayedCall(1900, () => this.checkChange());   // give a slow child time to add the next coin
  }
  async checkChange() {
    if (this.given < DUE) {
      this.shake(); this.sfx("deny", { volume: 0.4 });
      await this.changeExpr("oops");
      await this.say(DUE - this.given === 1 ? "لسه ناقص جنيه!" : "لسه ناقص جنيهين!", 1100, 0.9);
      this.hush(); await this.changeExpr("happy"); return;
    }
    this.phase = "done"; this.guide(null);
    if (this.given > DUE) {
      const extra = this.given - DUE;
      await this.say(extra === 1 ? "ده كتير! خد جنيه" : "ده كتير! خد الزيادة", 1300);
      for (let i = 0; i < extra; i++) { const c = this.dishCoins.pop(); this.tweens.add({ targets: c, x: 470, y: 1080, duration: 300 }); this.money++; }
      this.refresh();
    }
    this.dishCoins.forEach((c, i) => this.tweens.add({ targets: c, x: YX - 80, y: 700, alpha: 0, scale: 0.12, duration: 380, delay: i * 90 }));
    this.sum.setText(`٥ − ${ar(PRICE)} = ${ar(DUE)}`).setBackgroundColor("#d9f2c4");
    this.tweens.add({ targets: this.sum, scale: 1.2, duration: 160, yoyo: true });
    this.sfx("good", { volume: 0.7 });
    await this.hop(55);
    this.sparkle(YX, 420, 12);
    await this.say("شكرًا! أحلى عصير في شارع الفكرة!", 1700);
    await new Promise(r => this.time.delayedCall(700, r));
    await this.walkOut();
    this.endCard();
  }

  // ---------- flow ----------
  next() {
    if (this.phase !== "make") return;
    if (this.cup.level === 0) this.guide({ x: this.jug.x, y: LINE - 80 });
    else if (this.cup.cubes < 3) this.guide({ x: 636, y: LINE - 60 });
    else this.guide({ x: HAND.x, y: 600 }, 130);
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
  }
  endCard() {
    this.phase = "end";
    const b = this.add.container(W / 2, 560).setDepth(31);
    const g = this.add.graphics().fillStyle(0xc98a1e).fillRoundedRect(-160, -52, 320, 112, 38).fillStyle(0xf4b63c).fillRoundedRect(-160, -60, 320, 112, 38).lineStyle(6, INK).strokeRoundedRect(-160, -60, 320, 112, 38);
    b.add([g, this.add.text(0, -4, "تاني", { fontFamily: FONT, fontSize: "46px", color: "#3b2016", fontStyle: "800", rtl: true }).setOrigin(0.5)]);
    b.setSize(320, 120).setInteractive({ useHandCursor: true }).on("pointerup", () => this.scene.restart());
    b.setScale(0); this.tweens.add({ targets: b, scale: 1, duration: 300, ease: "Back.out" });
    this.endBtn = b;
    if (TEST) window.__proofDone = true;
  }

  // ---------- test hooks (only with ?test=1) ----------
  hooks() {
    const s = this, toPage = (x, y) => { const r = s.game.canvas.getBoundingClientRect(); return { x: r.left + x * r.width / W, y: r.top + y * r.height / H }; };
    return {
      phase: () => s.phase, busy: () => !!s.busy, money: () => s.money, given: () => s.given,
      cupState: () => ({ level: s.cup.level, cubes: s.cup.cubes, inHand: !s.cup.visible }), stock: () => ({ cups: s.cupsLeft, ice: s.ice }),
      expr: () => s.expr, arm: () => s.armPose,
      start: () => toPage(W / 2, H / 2), jug: () => toPage(s.jug.x, LINE - 80), ice: () => toPage(636, LINE - 60),
      cup: () => toPage(s.cup.x, s.cup.y), yahya: () => toPage(HAND.x, 600), dish: () => toPage(150, 1085),
      drawerCoins: () => s.drawerCoins.map(c => toPage(c.x, c.y)), again: () => s.endBtn && toPage(W / 2, 560),
      sfxLog: () => s.sfxLog.map(e => ({ ...e })), clock: () => ({ scene: s.time.now, wall: Date.now() }),
      fps: () => Math.round(s.game.loop.actualFps),
      headAngle: () => s.headTilt.angle + s.head.angle,
      layout: () => { const css = s.game.canvas.getBoundingClientRect().width / W;
        return { counterTop: LINE / H, yahyaTop: s.root.getBounds().top / H,
          targetsCss: [s.jug, s.iceBox, s.cup, ...s.drawerCoins].map(o => Math.min(o.displayWidth || o.width, o.displayHeight || o.height) * css) }; },
      pose: (expr, arm) => { if (expr) s.setExpr(expr); if (arm) s.setArm(arm); return { expr: s.expr, arm: s.armPose }; },
    };
  }
}

document.fonts.load('800 40px "Baloo Bhaijaan 2"').catch(() => {}).finally(() => new Phaser.Game({
  type: Phaser.AUTO, parent: "game", width: W, height: H, backgroundColor: "#2b1a12",
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, input: { activePointers: 2 }, scene: Scene,
}));
