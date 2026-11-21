/* «مغامرة الكورة», part 1: the grocery, the kiosk and Kunafa's box as one adventure.
   Brief: docs/specs/2026-11-20_linked-proof-brief.md. Money rules live in wallet.js (checked by wallet.test.js).
   No new art: A+ props and Yahya's rig from ../proof2/art, earlier character pictures from ../assets as stand-ins,
   everything else (shelves, items, ball, UI) drawn by code. Sounds are synthesised here (no sound files).
   ?test=1 exposes read-only hooks; &fast=1 shortens waits for the play tests. */
"use strict";
const W = 720, H = 1280;
const QS = new URLSearchParams(location.search);
const TEST = QS.get("test") === "1", FAST = QS.get("fast") === "1";
const SP = FAST ? 0.12 : 1;
const INK = 0x3b2016, CREAM = 0xfff6e4, GREEN = 0x3f8f5a, ORANGE = 0xe07a1f, GREY = 0x9a9a92;
const FONT = '"Baloo Bhaijaan 2", "Geeza Pro", sans-serif';
const ar = x => String(x).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[d]);
const ART = "art/";   // WebP copies of the existing A+ art and stand-ins (same pictures, smaller files)
const SAVE_KEY = "sana-adventure-p1";
const P = Wallet.PRICES;

// ---------- the adventure's state (shared by every scene) ----------
const G = { real: null, play: null, step: "street", practiceBase: null, realResult: null };
function persist() {
  if (G.play && G.play.practice) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ real: G.real, step: G.step, practiceBase: G.practiceBase })); } catch (e) {}
}
function restore() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.real) return s; } catch (e) {}
  return null;
}
function fresh() { G.real = Wallet.create(); G.play = G.real; G.step = "street"; G.practiceBase = null; persist(); }
function setStep(step) { G.step = step; persist(); }
function checkMoney() { const e = Wallet.check(G.play); if (e.length) { console.error("money rule broken: " + e.join("; ")); } return e; }

// ---------- sounds: tiny synth, no files ----------
const Snd = {
  ctx: null,
  unlock() { try { this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)(); if (this.ctx.state === "suspended") this.ctx.resume(); } catch (e) {} },
  tone(freq, dur, { type = "sine", vol = 0.15, to = null, delay = 0 } = {}) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, { vol = 0.08, freq = 1200, q = 0.8, delay = 0 } = {}) {
    const c = this.ctx; if (!c) return null;
    const n = Math.max(1, Math.floor(c.sampleRate * dur)), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime + delay;
    s.buffer = b; f.type = "bandpass"; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(c.destination); s.start(t); return s;
  },
  play(k, i = 0) {
    if (!this.ctx) return;
    if (k === "coin") { this.tone(1250 + i * 70, 0.07, { type: "square", vol: 0.05 }); this.tone(1700 + i * 90, 0.12, { type: "sine", vol: 0.09, delay: 0.06 }); }
    if (k === "pop") this.tone(380, 0.09, { to: 900, vol: 0.12 });
    if (k === "tap") this.tone(700, 0.05, { type: "triangle", vol: 0.08 });
    if (k === "deny") this.tone(220, 0.16, { type: "square", vol: 0.05, to: 150 });
    if (k === "good") [523, 659, 784].forEach((f, j) => this.tone(f, 0.16, { type: "triangle", vol: 0.1, delay: j * 0.08 }));
    if (k === "ice") { this.tone(2600, 0.05, { type: "triangle", vol: 0.07 }); this.tone(1900, 0.08, { type: "triangle", vol: 0.05, delay: 0.04 }); }
    if (k === "step") this.noise(0.05, { vol: 0.05, freq: 500 });
    if (k === "whoosh") this.noise(0.25, { vol: 0.06, freq: 900, q: 0.5 });
    if (k === "deflate") { this.noise(0.6, { vol: 0.08, freq: 2400, q: 0.4 }); this.tone(500, 0.5, { to: 120, vol: 0.05, type: "sawtooth" }); }
    if (k === "talk") for (let j = 0; j < 3; j++) this.tone(300 + Math.random() * 250, 0.06, { type: "triangle", vol: 0.05, delay: j * 0.08 });
    if (k === "meow") this.tone(700, 0.35, { to: 450, type: "sine", vol: 0.08 });
    if (k === "splash") this.noise(0.35, { vol: 0.07, freq: 700, q: 0.6 });
  },
  pourOn() { if (!this.ctx || this.pourSrc) return; this.pourSrc = this.noise(6, { vol: 0.05, freq: 1500, q: 1.2 }); },
  pourOff() { if (this.pourSrc) { try { this.pourSrc.stop(); } catch (e) {} this.pourSrc = null; } },
};

// ---------- a base scene with the shared pieces: Kunafa's box, buttons, talking cards, flying coins ----------
class Base extends Phaser.Scene {
  wait(ms) { return new Promise(r => this.time.delayedCall(ms * SP, r)); }
  tween(cfg) { return new Promise(r => this.tweens.add({ ...cfg, duration: (cfg.duration || 300) * SP, delay: (cfg.delay || 0) * SP, onComplete: r })); }
  text(x, y, s, size = 34, color = "#3b2016", extra = {}) {
    return this.add.text(x, y, s, { fontFamily: FONT, fontSize: size + "px", color, fontStyle: "800", rtl: true, align: "center", ...extra }).setOrigin(0.5);
  }
  setup() {
    this.btns = []; this.hudOn = false; this.cardY = 270; this.card = null; this.ring = null; this.moving = false; this.finishing = false;
    this.events.once("shutdown", () => { this.btns = []; });
    window.__scene = this;
  }
  // a big rounded button; registered for the test hooks by its label
  button(x, y, label, cb, { w = 330, h = 104, color = 0xf4b63c, size = 40, depth = 40, enabled = true } = {}) {
    const c = this.add.container(x, y).setDepth(depth);
    const g = this.add.graphics();
    const draw = (col) => g.clear().fillStyle(0x000000, 0.25).fillRoundedRect(-w / 2, -h / 2 + 8, w, h, h / 2.6).fillStyle(col).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2.6).lineStyle(6, INK).strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2.6);
    draw(enabled ? color : 0xcfc7b8);
    const t = this.text(0, -2, label, size, enabled ? "#3b2016" : "#7d746a");
    c.add([g, t]); c.setSize(w, h);
    const rec = { label, c, enabled };
    c.setInteractive({ useHandCursor: true });
    c.on("pointerup", () => {
      Snd.unlock();
      if (!rec.enabled) { Snd.play("deny"); this.tweens.add({ targets: c, angle: { from: -4, to: 4 }, duration: 50, yoyo: true, repeat: 2, onComplete: () => { c.angle = 0; } }); return; }
      Snd.play("tap"); this.tweens.add({ targets: c, scale: 0.94, duration: 60, yoyo: true }); cb();
    });
    rec.setEnabled = (on) => { rec.enabled = on; draw(on ? color : 0xcfc7b8); t.setColor(on ? "#3b2016" : "#7d746a"); };
    rec.destroy = () => { c.destroy(); this.btns = this.btns.filter(b => b !== rec); };
    this.btns.push(rec);
    return rec;
  }
  clearButtons() { this.btns.slice().forEach(b => b.destroy ? b.destroy() : b.c.destroy()); this.btns = []; }

  // Kunafa's box: one face (the clay pot) with three pockets that never mix in the data
  hud() {
    const practice = G.play.practice;
    const panel = this.add.graphics().setDepth(50);
    panel.fillStyle(0x000000, 0.25).fillRoundedRect(10, 16, 700, 150, 34).fillStyle(practice ? 0xe4e1da : CREAM).fillRoundedRect(10, 8, 700, 150, 34).lineStyle(6, INK).strokeRoundedRect(10, 8, 700, 150, 34);
    this.add.image(662, 80, "claypot").setScale(0.36).setDepth(51);
    
    const chip = (x, w, label, col) => {
      this.add.graphics().setDepth(51).fillStyle(practice ? GREY : col, 0.18).fillRoundedRect(x - w / 2, 24, w, 118, 22).lineStyle(4, practice ? GREY : col).strokeRoundedRect(x - w / 2, 24, w, 118, 22);
      this.text(x, 50, label, 28, practice ? "#6a665e" : "#3b2016").setDepth(52);
      return this.text(x, 100, "", 50).setDepth(52);
    };
    this.hudPocket = chip(520, 150, "مصروفي", GREEN);
    this.hudProject = chip(352, 160, "المشروع", ORANGE);
    // the goal: a bar with two colours, from the pocket and from kiosk profit
    this.add.graphics().setDepth(51).fillStyle(practice ? GREY : 0x2f6b4f, 0.12).fillRoundedRect(28, 24, 230, 118, 22).lineStyle(4, practice ? GREY : 0x2f6b4f).strokeRoundedRect(28, 24, 230, 118, 22);
    this.text(143, 46, "كورة الشارع", 28).setDepth(52);
    this.hudGoal = this.text(143, 82, "", 34).setDepth(52);
    this.goalBar = this.add.graphics().setDepth(52);
    this.chipAt = { pocket: { x: 520, y: 100 }, project: { x: 352, y: 100 }, goal: { x: 143, y: 120 } };
    if (practice) {
      this.add.graphics().setDepth(50).fillStyle(0x6a665e).fillRoundedRect(200, 1228, 320, 46, 18);
      this.text(360, 1251, "يوم تجربة: مابيتحسبش", 26, "#ffffff").setDepth(51);
    }
    this.hudOn = true; this.refresh();
  }
  refresh() {
    if (!this.hudOn || !this.hudPocket.scene) return;
    const s = G.play, g = s.goal;
    this.hudPocket.setText(ar(s.pocket));
    this.hudProject.setText(ar(s.project.cash));
    this.hudGoal.setText(`${ar(g.saved)} من ${ar(g.price)}`);
    const x0 = 44, w = 198, y = 112, h = 18, u = w / g.price;
    this.goalBar.clear().fillStyle(0xffffff).fillRoundedRect(x0, y, w, h, 8).lineStyle(3, INK).strokeRoundedRect(x0, y, w, h, 8);
    // filled from the right (RTL): pocket first, then profit
    const pw = g.fromPocket * u, kw = g.fromProfit * u;
    if (pw) this.goalBar.fillStyle(s.practice ? 0x8a8a82 : GREEN).fillRect(x0 + w - pw, y + 2, pw, h - 4);
    if (kw) this.goalBar.fillStyle(s.practice ? 0xb0aca2 : ORANGE).fillRect(x0 + w - pw - kw, y + 2, kw, h - 4);
  }
  bumpChip(k) { if (!this.hudOn || !this.hudPocket.scene) return; const t = { pocket: this.hudPocket, project: this.hudProject, goal: this.hudGoal }[k]; this.tweens.add({ targets: t, scale: 1.3, duration: 90 * SP, yoyo: true }); }
  // coins fly one by one, each with a rising note; the numbers change when they land
  async fly(from, to, n, onEach) {
    for (let i = 0; i < n; i++) {
      const c = this.add.image(from.x, from.y, "coin").setScale(0.3).setDepth(60);
      if (G.play.practice) c.setTint(0xb8b8b0);
      Snd.play("coin", i);
      this.tweens.add({ targets: c, x: to.x, y: to.y, scale: 0.22, duration: 380 * SP, ease: "Quad.in", onComplete: () => { c.destroy(); onEach && onEach(i); } });
      await this.wait(130);
    }
    await this.wait(300);
  }
  floatText(x, y, s, color = "#3b2016") {
    const t = this.text(x, y, s, 34, color, { stroke: "#fff6e4", strokeThickness: 8 }).setDepth(61);
    this.tweens.add({ targets: t, y: y - 70, alpha: 0, duration: 1200 * SP, ease: "Quad.out", onComplete: () => t.destroy() });
  }
  // a talking card: the speaker's picture and up to two short lines; tap to go on (or it goes on by itself)
  say(who, line, ms) {
    if (this.card) this.card.destroy();
    const pics = { farida: ["farida_face", 0.62, 0.5], omar: ["omar_face", 0.62, 0.5], sitto: ["sitto_face", 0.6, 0.5], yahya: ["yahya_face", 0.62, 0.17], kunafa: ["kunafa", 0.36, 0.42] };
    const cy = this.cardY || 270;
    const c = this.add.container(W / 2, cy).setDepth(55);
    const t = this.text(pics[who] ? -50 : 0, 0, line, 34, "#3b2016", { wordWrap: { width: pics[who] ? 470 : 600, useAdvancedWrap: true } });
    const h = Math.max(130, t.height + 50);
    const g = this.add.graphics().fillStyle(0x000000, 0.25).fillRoundedRect(-340, -h / 2 + 8, 680, h, 36).fillStyle(0xffffff).fillRoundedRect(-340, -h / 2, 680, h, 36).lineStyle(6, INK).strokeRoundedRect(-340, -h / 2, 680, h, 36);
    c.add([g, t]);
    if (pics[who]) {
      const ring = this.add.graphics().fillStyle(0xf4e0b8).fillCircle(268, 0, 58).lineStyle(5, INK).strokeCircle(268, 0, 58);
      const im = this.add.image(268, 0, pics[who][0]).setScale(pics[who][1]).setOrigin(0.5, pics[who][2]);
      const m = this.make.graphics({}, false).fillCircle(W / 2 + 268, cy, 55); im.setMask(m.createGeometryMask());
      c.add([ring, im]);
    }
    c.setScale(0.7); this.tweens.add({ targets: c, scale: 1, duration: 200 * SP, ease: "Back.out" });
    Snd.play(who === "kunafa" ? "meow" : "talk");
    this.card = c;
    const dur = ms ?? Math.max(1700, line.length * 75);
    return new Promise(res => {
      let done = false;
      const go = () => { if (done) return; done = true; res(); };
      this.time.delayedCall(dur * SP, go);
      this.time.delayedCall(450 * SP, () => this.input.once("pointerup", go));
    });
  }
  hush() { if (this.card) { this.card.destroy(); this.card = null; } }
  // the walk between places on the street: a quick slide, footsteps, then the next scene
  async goTo(key, label) {
    this.clearButtons(); this.hush();
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x2b1a12, 0).setDepth(90);
    const sign = this.text(W / 2, H / 2, label, 48, "#fff6e4").setDepth(91).setAlpha(0);
    for (let i = 0; i < 3; i++) this.time.delayedCall(i * 160 * SP, () => Snd.play("step"));
    this.tweens.add({ targets: this.cameras.main, scrollX: -160, duration: 450 * SP, ease: "Quad.in" });
    await this.tween({ targets: dim, fillAlpha: 1, duration: 450 });
    sign.setAlpha(1); await this.wait(350);
    this.scene.start(key);
  }
}

// ---------- boot: load, then resume or start ----------
class Boot extends Base {
  constructor() { super("boot"); }
  preload() {
    ["counter", "jug", "claypot", "coin", "street", "farida_face", "omar_face", "sitto_face", "kunafa", "yahya_full"].forEach(k => this.load.image(k, ART + k + ".webp"));
    this.load.image("yahya_face", ART + "yahya_full.webp");
  }
  create() {
    this.setup();
    const saved = restore();
    if (TEST && QS.get("fresh") === "1") { fresh(); return this.scene.start("street"); }
    if (!saved || saved.step === "street") { fresh(); return this.scene.start("street"); }
    G.real = saved.real; G.play = G.real; G.step = saved.step; G.practiceBase = saved.practiceBase;
    this.add.image(W / 2, H / 2, "street").setDisplaySize(W, H);
    this.add.rectangle(W / 2, H / 2, W, H, 0x2b1a12, 0.55);
    this.text(W / 2, 470, "المغامرة متسجلة عندك", 46, "#fff6e4");
    const where = { grocery: "البقالة", kiosk: "الكشك", ledger: "دفتر الكشك", goal: "الحصالة", done: "آخر المغامرة" }[G.step] || "";
    this.text(W / 2, 540, `وقفت عند: ${where}`, 34, "#fff6e4");
    this.button(W / 2, 700, "كمّل", () => this.scene.start(G.step === "done" ? "goal" : G.step));
    this.button(W / 2, 840, "ابدأ من الأول", () => { fresh(); this.scene.start("street"); }, { color: 0xe8dcc4 });
  }
}

// ---------- 1. the street: the ball pops, the goal is set, the allowance arrives ----------
class Street extends Base {
  constructor() { super("street"); }
  create() {
    this.setup(); setStep("street");
    this.add.image(W / 2, H / 2, "street").setDisplaySize(W, H);
    this.hud();
    this.yahya = this.add.image(500, 1215, "yahya_full").setOrigin(0.5, 1).setScale(1.05);
    this.ball = this.makeBall(400, 1170);
    this.cat = this.add.image(-120, 1200, "kunafa").setOrigin(0.5, 1).setScale(0.8).setFlipX(true);
    const go = this.button(W / 2, 700, "يلا نلعب", () => { go.destroy(); this.story(); }, { w: 300 });
  }
  makeBall(x, y) {
    const c = this.add.container(x, y);
    const g = this.add.graphics().fillStyle(0xffffff).fillCircle(0, 0, 42).lineStyle(5, INK).strokeCircle(0, 0, 42)
      .fillStyle(INK).fillCircle(0, 0, 12).fillCircle(-26, -20, 8).fillCircle(26, -20, 8).fillCircle(-22, 24, 8).fillCircle(22, 24, 8);
    c.add(g); return c;
  }
  async story() {
    Snd.unlock();
    // Yahya bounces the ball; Kunafa pounces; the ball goes flat
    for (let i = 0; i < 2; i++) { Snd.play("tap"); await this.tween({ targets: this.ball, y: 1010, duration: 260, ease: "Quad.out" }); await this.tween({ targets: this.ball, y: 1170, duration: 260, ease: "Quad.in" }); }
    Snd.play("meow");
    this.tweens.add({ targets: this.cat, x: 330, duration: 420 * SP, ease: "Quad.out" });
    await this.tween({ targets: this.cat, y: 1120, duration: 210, yoyo: true, ease: "Quad.out" });
    Snd.play("deflate");
    await this.tween({ targets: this.ball, scaleY: 0.45, scaleX: 1.25, y: 1192, duration: 600, ease: "Quad.out" });
    this.tweens.add({ targets: this.cat, x: -160, duration: 700 * SP, ease: "Quad.in" });
    this.tween({ targets: this.yahya, angle: -4, duration: 160, yoyo: true, repeat: 1 });
    await this.say("yahya", "الكورة اتخرمت!");
    await this.say("farida", "متزعلش يا يحيى. كورة جديدة بـ٣٠… وعندي فكرة!");
    this.goalPop();
    await this.say("omar", "استنوا… نحسبها الأول. ده مصروف الأسبوع:");
    G.play === G.real && Wallet.allowance(G.play);
    await this.fly({ x: 260, y: 300 }, this.chipAt.pocket, P.allowance, () => {});
    this.refresh(); this.bumpChip("pocket"); checkMoney();
    G.practiceBase = Wallet.clone(G.real);
    await this.say("farida", "نبيع عصير في الكشك! الإبريق ٤ كوبايات، وتمنه ٤.");
    await this.say("omar", "بس الأول: طلبات البقالة.");
    this.hush();
    setStep("grocery");
    this.button(W / 2, 700, "يلا على بقالة ستو", () => this.goTo("grocery", "بقالة ستو صديقة"), { w: 440 });
  }
  goalPop() { this.bumpChip("goal"); Snd.play("pop"); }
}

// ---------- 2. Sitto's grocery: what I need, what I want, and what that leaves for the kiosk ----------
class Grocery extends Base {
  constructor() { super("grocery"); }
  create() {
    this.setup(); setStep("grocery");
    this.paid = false; this.warned = false; this.warnedEmpty = false;
    this.drawShop();
    this.hud();
    this.basket = new Set();
    this.cards = {};
    const xs = { notebook: 560, choc: 360, sticker: 160 };
    Object.keys(Wallet.ITEMS).forEach(id => { this.cards[id] = this.itemCard(id, xs[id], 760); });
    this.kunafa = this.add.image(250, 640, "kunafa").setOrigin(0.5, 1).setScale(0.5).setDepth(8);
    this.tweens.add({ targets: this.kunafa, angle: { from: -3, to: 3 }, duration: 600, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.info = this.add.container(0, 0).setDepth(20);
    this.payBtn = this.button(W / 2, 1185, "ادفع لستو", () => this.pay(), { w: 360 });
    this.updateInfo();
    this.intro();
  }
  drawShop() {
    const g = this.add.graphics();
    g.fillStyle(0xf0d39c).fillRect(0, 0, W, H);
    // shelves with goods (code-drawn stand-ins)
    const cols = [0xd9534f, 0x5b8fd6, 0x8bc34a, 0xf4b63c, 0x9c6ade, 0xe07a1f];
    for (let r = 0; r < 2; r++) {
      const y = 330 + r * 120;
      g.fillStyle(0x8a5a36).fillRect(30, y, 660, 18).lineStyle(4, INK).strokeRect(30, y, 660, 18);
      for (let i = 0; i < 9; i++) { const h = 50 + ((i * 37 + r * 13) % 40); g.fillStyle(cols[(i + r * 2) % cols.length]).fillRoundedRect(46 + i * 72, y - h, 56, h, 8).lineStyle(4, INK).strokeRoundedRect(46 + i * 72, y - h, 56, h, 8); }
    }
    g.fillStyle(0x2f6b4f).fillRoundedRect(190, 175, 340, 60, 20);
    this.text(360, 205, "بقالة ستو صديقة", 36, "#fff6e4");
    this.add.image(470, 650, "sitto_face").setOrigin(0.5, 1).setScale(1.45);
    this.add.image(W / 2, 600, "counter").setOrigin(0.5, 0).setScale(1.02).setDepth(5);
  }
  itemCard(id, x, y) {
    const it = Wallet.ITEMS[id];
    const c = this.add.container(x, y).setDepth(10);
    const g = this.add.graphics();
    const draw = (on) => g.clear().fillStyle(0x000000, 0.25).fillRoundedRect(-90, -112, 180, 230, 26).fillStyle(on ? 0xd9f2c4 : 0xffffff).fillRoundedRect(-90, -120, 180, 230, 26).lineStyle(on ? 8 : 5, on ? GREEN : INK).strokeRoundedRect(-90, -120, 180, 230, 26);
    draw(false);
    const icon = this.add.graphics();
    if (id === "notebook") icon.fillStyle(0x5b8fd6).fillRoundedRect(-42, -95, 84, 100, 8).lineStyle(4, INK).strokeRoundedRect(-42, -95, 84, 100, 8).lineStyle(3, 0xffffff).lineBetween(-28, -70, 28, -70).lineBetween(-28, -50, 28, -50).lineBetween(-28, -30, 28, -30);
    if (id === "choc") icon.fillStyle(0x6b3b1f).fillRoundedRect(-50, -80, 100, 70, 10).lineStyle(4, INK).strokeRoundedRect(-50, -80, 100, 70, 10).fillStyle(0xd9534f).fillRect(-50, -60, 100, 28).lineStyle(4, INK).strokeRect(-50, -60, 100, 28);
    c.add([g, icon]);
    if (id === "sticker") { const st = this.add.graphics().fillStyle(0xffffff).fillCircle(0, -48, 50).lineStyle(4, INK).strokeCircle(0, -48, 50); c.add([st, this.add.image(0, -48, "claypot").setScale(0.3)]); }
    c.add(this.text(0, 30, it.name, 30));
    const price = this.add.container(0, 80); price.add([this.add.image(-30, 0, "coin").setScale(0.22), this.text(20, -2, ar(it.price), 40)]); c.add(price);
    if (it.need) { const tag = this.add.graphics().fillStyle(GREEN).fillRoundedRect(-70, -150, 140, 40, 16); c.add([tag, this.text(0, -130, "على القايمة", 24, "#ffffff")]); }
    c.setSize(180, 230).setInteractive({ useHandCursor: true });
    c.on("pointerup", () => this.toggle(id));
    c.draw = draw;
    this.btns.push({ label: "item:" + id, c, enabled: true });
    return c;
  }
  toggle(id) {
    if (this.paid) return;
    Snd.unlock();
    const c = this.cards[id];
    if (this.basket.has(id)) { this.basket.delete(id); c.draw(false); this.tweens.add({ targets: c, y: 760, duration: 150 }); Snd.play("tap"); }
    else {
      const cost = [...this.basket].reduce((a, k) => a + Wallet.ITEMS[k].price, 0) + Wallet.ITEMS[id].price;
      if (cost > G.play.pocket) { Snd.play("deny"); return; }
      this.basket.add(id); c.draw(true); this.tweens.add({ targets: c, y: 745, duration: 150, ease: "Back.out" }); Snd.play("pop");
      if (!Wallet.ITEMS[id].need) { Snd.play("meow"); this.tweens.add({ targets: this.kunafa, y: 600, duration: 140 * SP, yoyo: true }); }
    }
    this.updateInfo();
  }
  updateInfo() {
    this.info.removeAll(true);
    const cost = [...this.basket].reduce((a, k) => a + Wallet.ITEMS[k].price, 0), left = G.play.pocket - cost;
    const g = this.add.graphics().fillStyle(0xffffff, 0.95).fillRoundedRect(40, 930, 640, 170, 28).lineStyle(5, INK).strokeRoundedRect(40, 930, 640, 170, 28);
    const line1 = this.text(360, 975, `معاك ${ar(G.play.pocket)} − السلة ${ar(cost)} = هيفضل ${ar(left)}`, 34);
    // what is left decides the kiosk: one jug, or two
    const jugs = Math.floor(left / P.jug);
    const line2 = this.text(470, 1050, "يكفّي للكشك:", 30);
    const j1 = this.add.image(300, 1050, "jug").setScale(0.3).setAlpha(jugs >= 1 ? 1 : 0.25);
    const j2 = this.add.image(220, 1050, "jug").setScale(0.3).setAlpha(jugs >= 2 ? 1 : 0.25);
    const note = this.text(110, 1050, jugs >= 2 ? "إبريقين" : "إبريق", 30, jugs >= 2 ? "#2f6b4f" : "#3b2016");
    this.info.add([g, line1, line2, j1, j2, note]);
    this.jugsAfter = jugs;
  }
  async intro() {
    await this.say("sitto", "أهلًا يا حبيبي! طلباتك إيه؟");
    await this.say("kunafa", "مياو! (كنافة بتبص على الشيكولاتة والاستيكر)", 1800);
    this.hush();
  }
  async pay() {
    if (this.paid) return;
    if (!this.basket.has("notebook") && !this.warned) { this.warned = true; Snd.play("deny"); await this.say("sitto", "والكراسة؟ دي اللي على القايمة. ولو مش عايزها، اضغط ادفع تاني."); this.hush(); return; }
    if (this.basket.size === 0 && !this.warnedEmpty) { this.warnedEmpty = true; await this.say("sitto", "مش هتاخد حاجة؟ ماشي، اضغط ادفع تاني."); this.hush(); return; }
    this.paid = true; this.payBtn.destroy();
    const ids = [...this.basket];
    if (ids.length) {
      const cost = ids.reduce((a, k) => a + Wallet.ITEMS[k].price, 0);
      Wallet.buy(G.play, ids);
      await this.fly(this.chipAt.pocket, { x: 470, y: 520 }, cost, () => { this.refresh(); });
      this.refresh(); this.bumpChip("pocket"); checkMoney();
      ids.forEach(id => this.tween({ targets: this.cards[id], y: 1400, alpha: 0, duration: 450, ease: "Quad.in" }));
    }
    const line = ids.length ? "اتفضل يا حبيبي. ربنا يبارك." : "ولا يهمك. تعالى في أي وقت.";
    await this.say("sitto", line);
    if (ids.includes("choc")) await this.say("kunafa", "مياو! (الشيكولاتة طعمها حلو… بس فلوس الكشك قلّت)", 2200);
    this.hush();
    setStep("kiosk");
    this.button(W / 2, 1185, "يلا على الكشك", () => this.goTo("kiosk", "كشك الناصية"), { w: 400 });
  }
}

// ---------- 3. the kiosk: how much juice, pour by hand, ice or not, who gets served ----------
const LINE = 790, S = 0.342, TEX = S / 0.5, YX = 360;
let ORIGIN, CUP_S, HAND, JUICE;
const WORK = { x: 250 };
function fromRig(rig) {
  ORIGIN = rig.pivots.counterLine;
  const c = rig.cupProp;
  CUP_S = S * c.scale2k;
  HAND = { x: YX + (c.center2k[0] - ORIGIN[0]) * S, y: LINE + (c.center2k[1] - ORIGIN[1]) * S };
  WORK.y = HAND.y;
  JUICE = { top: c.juiceTopPx * CUP_S, bottom: c.juiceBottomPx * CUP_S };
}
const LINES = {
  yahya: { order: "عايز واحد عصير!", iced: "الله! ساقع! هجيب صحابي بكرة", warm: "حلو… بس دافي شوية", out: "خلص؟! خسارة" },
  soad: { order: "اتنين لو سمحت", iced: "تسلم إيدك! ساقع وحلو", warm: "شكرًا يا حبيبي", out: "خلص العصير؟ خسارة" },
  captain: { order: "واحد ساقع بس! الحر نار", iced: "هو ده! ساقع!", warm: "ده مش ساقع. لأ شكرًا", out: "خلص؟ طيب" },
  kids: { order: "اتنين يا عم!", iced: "ساقع! يلا نكمل الماتش", warm: "ماشي… شكرًا", out: "خلص؟! يا خسارة", partly: "واحد بس؟ ماشي" },
};

class Kiosk extends Base {
  constructor() { super("kiosk"); }
  preload() {
    ["icebox", "icebox_open", "cupstack", "cube", "cup_empty", "cup_juice", "cup_full", "tray"].forEach(k => this.load.image(k, ART + k + ".webp"));
    this.load.json("rig", ART + "yahya/rig.json");
    ["torso", "torso_noRsleeve", "head", "armL_down", "armR_down", "armR_reach", "armR_grip", "eyes_eager", "eyes_blink", "eyes_happy", "eyes_surprised",
      "mouth_eager", "mouth_talk", "mouth_happy", "mouth_surprised"].forEach(k => this.load.image("y_" + k, ART + `yahya/${k}.webp`));
    [1, 2, 3, 4].forEach(i => this.load.svg("cust" + i, ART + `cust${i}.svg`, { width: 220, height: 400 }));
  }
  create() {
    this.setup(); setStep("kiosk"); this.cardY = 1090;
    Object.assign(this, { cup: null, handCup: null, heldCup: null, body: null, current: null, deliverTo: null, pouring: false, busy: false, phase: "start", jugs: [], stockText: null, orderB: null, armFront: null, blinking: false });
    fromRig(this.cache.json.get("rig"));
    this.add.image(W / 2, H / 2, "street").setDisplaySize(W, H);
    this.add.rectangle(W / 2, H / 2, W, H, 0xffb347, 0.12);
    this.makeYahya();
    this.counter = this.add.image(W / 2, LINE - 40, "counter").setOrigin(0.5, 0).setScale((H - LINE + 40) / 668).setDepth(5);
    this.iceBox = this.add.image(636, LINE + 6, "icebox").setOrigin(0.5, 1).setScale(0.62).setDepth(6).setInteractive({ useHandCursor: true });
    this.iceBox.on("pointerup", () => this.addIce());
    this.add.image(530, LINE + 6, "cupstack").setOrigin(0.5, 1).setScale(0.5).setDepth(6);
    this.tray = this.add.image(470, 1085, "tray").setScale(0.55).setDepth(6);
    this.add.text(470, 1190, "الدرج", { fontFamily: FONT, fontSize: "30px", color: "#fff6e4", fontStyle: "800", rtl: true, stroke: "#3b2016", strokeThickness: 8 }).setOrigin(0.5).setDepth(7);
    this.hud();
    this.input.on("pointerup", () => this.stopPour());
    this.input.on("dragstart", (p, o) => o.onDragStart && o.onDragStart());
    this.input.on("drag", (p, o, x, y) => { o.x = x; o.y = y; });
    this.input.on("dragend", (p, o) => o.onDrop && o.onDrop());
    this.idleYahya();
    const d = G.play.day;
    if (d && d.closed) { this.scene.start("ledger"); return; }
    if (d) { this.poured = d.sold; this.placeJugs(d.jugs); this.runDay(); }
    else this.chooseJugs();
  }
  update(time, dt) {
    if (this.armFront && this.armFront.visible) {
      const m = this.armRpose.getWorldTransformMatrix().decomposeMatrix();
      this.armFront.setPosition(m.translateX, m.translateY).setRotation(m.rotation).setScale(m.scaleX, m.scaleY);
    }
    if (this.pouring && this.cup) {
      this.cup.level = Math.min(1.08, this.cup.level + dt / 1000 * 0.5 / SP);
      if (this.cup.level >= 1.08) this.stopPour();
      if (this.cup.level > 1.0 && !this.cup.spilled) { this.cup.spilled = true; this.drip(); }
    }
    if (this.cup && this.cup.visible) {
      const m = this.cup.getWorldTransformMatrix();
      const lv = Math.min(1, this.cup.level);
      const top = JUICE.bottom - (JUICE.bottom - JUICE.top) * lv;
      this.cup.maskG.clear().fillStyle(0xffffff).fillRect(m.tx - 70, m.ty + top, 140, (JUICE.bottom - top) + 2);
    }
  }

  // --- how much juice to buy: one jug or two (the capital comes from my pocket) ---
  async chooseJugs() {
    await this.say("farida", "النهارده حر، والزباين كتير. هنشتري كام إبريق عصير؟");
    const max = Wallet.maxJugs(G.play);
    this.add.image(250, 560, "jug").setScale(0.55).setDepth(41);
    this.text(250, 470, "إبريق = ٤ كوبايات", 28, "#fff6e4", { stroke: "#3b2016", strokeThickness: 8 }).setDepth(41);
    this.text(W / 2, 770, "اللي مايتباعش بيترمي آخر اليوم", 28, "#fff6e4", { stroke: "#3b2016", strokeThickness: 8 }).setDepth(41);
    const b1 = this.button(530, 880, "إبريق بـ٤", () => pick(1), { w: 290 });
    const b2 = this.button(190, 880, "إبريقين بـ٨", () => pick(2), { w: 290, enabled: max >= 2 });
    if (max < 2) this.text(190, 955, `معاك ${ar(G.play.pocket)} بس`, 28, "#fff6e4", { stroke: "#3b2016", strokeThickness: 8 }).setDepth(41);
    const pick = async (jugs) => {
      b1.destroy(); b2.destroy(); this.hush();
      this.children.list.filter(o => o.depth === 41).forEach(o => o.destroy());
      const before = G.play.project.cash;
      Wallet.openKiosk(G.play, jugs);
      const moved = G.play.project.capital - 0;
      // my pocket → the project (capital) → the juice
      await this.fly(this.chipAt.pocket, this.chipAt.project, jugs * P.jug - before, () => {});
      this.hudPocket.setText(ar(G.play.pocket)); this.hudProject.setText(ar(jugs * P.jug)); this.bumpChip("project");
      this.floatText(352, 210, `رأس المال: ${ar(moved)}`);
      await this.wait(300);
      this.poured = 0;
      this.placeJugs(jugs);
      await this.fly(this.chipAt.project, { x: 120, y: LINE - 90 }, jugs * P.jug, () => {});
      this.refresh(); checkMoney(); persist();
      this.poured = 0;
      this.runDay();
    };
  }
  placeJugs(n) {
    this.jugs = [];
    for (let i = 0; i < n; i++) {
      const j = this.add.image(70 + i * 90, LINE + 6, "jug").setOrigin(0.5, 1).setScale(0.62).setDepth(6).setInteractive({ useHandCursor: true });
      j.home = { x: j.x, y: j.y };
      j.on("pointerdown", () => this.startPour(j));
      this.jugs.push(j);
    }
    this.stockBadge = this.add.container(125, LINE - 225).setDepth(9);
    const g = this.add.graphics().fillStyle(INK).fillRoundedRect(-105, -26, 210, 56, 26).fillStyle(CREAM).fillRoundedRect(-105, -30, 210, 56, 26).lineStyle(4, INK).strokeRoundedRect(-105, -30, 210, 56, 26);
    this.stockText = this.text(0, -2, "", 28);
    this.stockBadge.add([g, this.stockText]);
    this.refreshStock();
  }
  jugLeft() { return G.play.day.stock - this.poured; }
  refreshStock() { if (this.stockText) this.stockText.setText(`فاضل ${ar(this.jugLeft())} كوبايات`); }

  // --- the customers, one by one ---
  async runDay() {
    const d = G.play.day;
    while (!Wallet.dayOver(G.play)) {
      const c = Wallet.CUSTOMERS[d.next];
      await this.serveCustomer(c);
      persist();
    }
    await this.sunset();
  }
  available() { return this.jugLeft() + (this.cup && this.cup.level > 0 ? 1 : 0); }
  async serveCustomer(c) {
    this.current = c;
    await this.enter(c);
    if (this.available() === 0) {
      await this.cSay(c, LINES[c.id].out);
      Wallet.serve(G.play, []); checkMoney(); persist();
      return this.leave(c, false);
    }
    await this.cSay(c, LINES[c.id].order);
    this.orderBubble(c);
    const iced = []; let refused = false;
    while (iced.length < c.cups && this.available() > 0) {
      if (!this.cup) this.newCup();
      this.phase = "make"; this.hint();
      const r = await new Promise(res => { this.deliverTo = res; });
      if (c.coldOnly && !r.iced) { refused = true; break; }
      iced.push(r.iced ? 1 : 0);
      this.giveCup(c, r.iced, iced.length);
      if (iced.length < c.cups && this.available() > 0) await this.wait(450);
    }
    this.phase = "pay"; this.guide(null);
    if (this.orderB) { this.orderB.destroy(); this.orderB = null; }
    const res = Wallet.serve(G.play, refused ? [0] : iced); checkMoney(); persist();
    if (refused) { this.cupBack(); await this.react(c, "warm-refused"); return this.leave(c, false); }
    if (res.left === "partly-sold-out") await this.cSay(c, LINES[c.id].partly || LINES[c.id].warm);
    await this.react(c, res.iced > 0 ? "iced" : "warm");
    // payment: 3 per cup into the drawer; one coin per iced cup goes to the ice box
    await this.fly(this.custPos(c), this.chipAt.project, res.paid, () => {});
    this.refresh(); this.bumpChip("project"); this.floatText(352, 210, `+${ar(res.paid)} بيع`, "#2f6b4f");
    if (res.ice) {
      this.iceBox.setTexture("icebox_open");
      await this.fly(this.chipAt.project, { x: 636, y: LINE - 60 }, res.ice, () => {});
      this.iceBox.setTexture("icebox");
      this.floatText(560, LINE - 200, `−${ar(res.ice)} تلج`, "#a4441c");
    }
    this.refresh();
    return this.leave(c, true);
  }

  // --- customers' bodies: Yahya is the rig; the others are earlier pictures (stand-ins) ---
  custPos(c) { return c.id === "yahya" ? { x: YX, y: 480 } : { x: 380, y: 480 }; }
  async enter(c) {
    if (c.id === "yahya") { await this.walkYahya(YX, 1300, "Sine.out"); return; }
    const keys = { soad: ["cust1"], captain: ["cust2"], kids: ["cust3", "cust4"] }[c.id];
    this.body = this.add.container(W + 300, 0).setDepth(2);
    keys.forEach((k, i) => this.body.add(this.add.image((i - (keys.length - 1) / 2) * 170, LINE + 190, k).setOrigin(0.5, 1).setScale(keys.length > 1 ? 1.15 : 1.35)));
    this.body.add(this.text(0, 330, c.name, 30, "#fff6e4", { stroke: "#3b2016", strokeThickness: 8 }));
    for (let i = 0; i < 4; i++) this.time.delayedCall(i * 250 * SP, () => Snd.play("step"));
    await this.tween({ targets: this.body, x: 380, duration: 1000, ease: "Sine.out" });
  }
  async leave(c, happy) {
    this.hush();
    if (c.id === "yahya") { this.setArm("down"); if (this.heldCup) { this.heldCup.destroy(); this.heldCup = null; } await this.walkYahya(-320, 1200, "Sine.in"); this.changeExpr("eager"); return; }
    await this.tween({ targets: this.body, x: -320, duration: 900, ease: "Sine.in" });
    this.body.destroy(); this.body = null;
  }
  cSay(c, line) { return this.say(null, `${c.name}: ${line}`, Math.max(1500, line.length * 70)); }
  orderBubble(c) {
    const b = this.add.container(600, 480).setDepth(14);
    const g = this.add.graphics().fillStyle(INK, 0.3).fillRoundedRect(-100, -92, 200, 190, 48).fillStyle(0xffffff).fillRoundedRect(-100, -100, 200, 190, 48).lineStyle(6, INK).strokeRoundedRect(-100, -100, 200, 190, 48);
    b.add(g);
    for (let i = 0; i < c.cups; i++) b.add(this.add.image((i - (c.cups - 1) / 2) * 70, 0, "cup_juice").setScale(0.16));
    if (c.coldOnly) b.add([this.add.graphics().fillStyle(0x5bb6e6).fillRoundedRect(-62, -128, 124, 48, 22).lineStyle(5, INK).strokeRoundedRect(-62, -128, 124, 48, 22), this.text(0, -104, "ساقع بس", 28, "#ffffff")]);
    b.setScale(0); this.tweens.add({ targets: b, scale: 1, duration: 260 * SP, ease: "Back.out" }); Snd.play("pop");
    this.orderB = b;
  }
  async react(c, kind) {
    const L = LINES[c.id];
    if (c.id === "yahya") {
      if (kind === "iced") { await this.receive(true); await this.ySay(L.iced); }
      else { await this.receive(false); await this.changeExpr("eager"); await this.ySay(L.warm); }
      return;
    }
    if (kind === "warm-refused") { Snd.play("deny"); this.tweens.add({ targets: this.body, x: 400, duration: 60 * SP, yoyo: true, repeat: 3 }); return this.cSay(c, L.warm); }
    if (kind === "iced") { Snd.play("good"); this.sparkle(380, 470); await this.tween({ targets: this.body, y: -40, duration: 200, yoyo: true, ease: "Quad.out" }); return this.cSay(c, L.iced); }
    return this.cSay(c, L.warm);
  }
  ySay(line) { return this.say("yahya", line); }

  // --- cups: pour by hand (press and hold on the jug), ice from the box, drag to the customer ---
  newCup() {
    const c = this.add.container(WORK.x, WORK.y).setDepth(8);
    const empty = this.add.image(0, 0, "cup_empty").setScale(CUP_S);
    const juice = this.add.image(0, 0, "cup_juice").setScale(CUP_S);
    const m = this.make.graphics({}, false);
    juice.setMask(m.createGeometryMask());
    const full = this.add.image(0, 0, "cup_full").setScale(CUP_S).setVisible(false);
    const cubes = this.add.container(0, 0);
    const lineY = JUICE.bottom - (JUICE.bottom - JUICE.top) * 0.93;
    const mark = this.add.graphics().lineStyle(4, 0xffffff, 0.95);
    for (let x = -46; x < 46; x += 16) mark.lineBetween(x, lineY, x + 9, lineY);
    c.add([empty, juice, cubes, full, mark]);
    c.level = 0; c.cubes = 0; c.iced = false; c.maskG = m; c.cubeLayer = cubes; c.full = full; c.mark = mark;
    c.setSize(130, 230).setInteractive({ useHandCursor: true, draggable: true });
    this.input.setDraggable(c);
    c.onDragStart = () => { c.setDepth(12); Snd.play("tap"); };
    c.onDrop = () => this.dropCup();
    c.setScale(0); this.tweens.add({ targets: c, scale: 1, duration: 220 * SP, ease: "Back.out" });
    this.cup = c;
  }
  startPour(jug) {
    Snd.unlock();
    if (this.phase !== "make" || !this.cup || this.pouring || this.busy) return;
    if (this.cup.level >= 1.0) { this.nope(jug); return; }
    if (this.cup.level === 0) {
      if (this.jugLeft() <= 0) { this.nope(jug); return; }
      this.poured++; this.refreshStock();
    }
    this.pouring = true; this.pourJug = jug; this.cup.spilled = this.cup.level > 1.0;
    this.tweens.killTweensOf(jug);
    jug.setOrigin(0.5, 0.5); jug.y = jug.home.y - jug.displayHeight / 2;
    this.tweens.add({ targets: jug, x: WORK.x - 86, y: LINE - 260, angle: 58, duration: 220 * SP, ease: "Quad.out" });
    this.stream = this.add.graphics().setDepth(7);
    this.streamEv = this.time.addEvent({ delay: 50, loop: true, callback: () => { this.stream.clear(); if (this.pouring) this.stream.fillStyle(0xf2c53d).fillRoundedRect(WORK.x - 9, LINE - 235, 18, 150 + Math.random() * 6, 9); } });
    Snd.pourOn();
  }
  stopPour() {
    if (!this.pouring) return;
    this.pouring = false; Snd.pourOff();
    if (this.streamEv) this.streamEv.remove(); if (this.stream) this.stream.destroy();
    const j = this.pourJug;
    this.tweens.add({ targets: j, x: j.home.x, y: j.home.y - j.displayHeight / 2, angle: 0, duration: 220 * SP, ease: "Quad.in", onComplete: () => { j.setOrigin(0.5, 1); j.y = j.home.y; } });
    const lv = this.cup.level;
    if (lv >= 0.86 && lv <= 1.0 && !this.cup.praised) { this.cup.praised = true; Snd.play("good"); this.sparkle(WORK.x, WORK.y - 120, 6); this.floatText(WORK.x, WORK.y - 170, "مظبوط!", "#2f6b4f"); }
    else if (lv < 0.86) this.floatText(WORK.x, WORK.y - 170, "كمّل لحد الخط", "#a4441c");
    else this.floatText(WORK.x, WORK.y - 170, "فاضت شوية!", "#a4441c");
    this.hint();
  }
  drip() {
    Snd.play("splash");
    for (let i = 0; i < 4; i++) {
      const d = this.add.circle(this.cup.x - 30 + i * 20, this.cup.y - 100, 7, 0xf2c53d).setDepth(9);
      this.tweens.add({ targets: d, y: LINE + 20, alpha: 0, duration: 500 * SP, delay: i * 70 * SP, onComplete: () => d.destroy() });
    }
  }
  addIce() {
    Snd.unlock();
    if (this.phase !== "make" || !this.cup || this.busy) return;
    if (this.cup.level < 0.86 || this.cup.iced) { this.nope(this.iceBox); this.floatText(WORK.x, WORK.y - 170, "املاها للخط الأول", "#a4441c"); return; }
    this.busy = true; this.cup.iced = true;
    this.iceBox.setTexture("icebox_open");
    this.time.delayedCall(700 * SP, () => this.iceBox.setTexture("icebox"));
    for (let i = 0; i < 3; i++) {
      const cube = this.add.image(636, LINE - 120, "cube").setScale(0.2).setDepth(11);
      this.tweens.add({ targets: cube, x: this.cup.x - 20 + i * 20, y: this.cup.y - 40 + (i % 2) * 6, angle: 220, duration: 420 * SP, delay: (100 + i * 120) * SP, ease: "Quad.in",
        onComplete: () => { cube.destroy(); Snd.play("ice");
          this.cup.cubeLayer.add(this.add.image(-20 + i * 20, -36 + (i % 2) * 6, "cube").setScale(0.13).setAngle(i ? 18 : -12));
          if (i === 2) this.time.delayedCall(100 * SP, () => { this.cup.full.setVisible(true); this.cup.cubeLayer.setVisible(false); this.cup.mark.setVisible(false); Snd.play("pop"); this.busy = false; this.hint(); }); } });
    }
    this.floatText(636, LINE - 200, "تلج: جنيه من البيع", "#2f6b4f");
  }
  dropCup() {
    const cup = this.cup; if (!cup) return;
    cup.setDepth(8);
    const target = this.custPos(this.current);
    const near = Phaser.Math.Distance.Between(cup.x, cup.y, target.x, target.y + 60) < 230;
    if (!near || this.phase !== "make" || this.busy) return this.cupHome();
    if (cup.level < 0.6) { this.cupHome(); Snd.play("deny"); this.floatText(WORK.x, WORK.y - 170, "لسه ناقصة!", "#a4441c"); return; }
    const done = this.deliverTo; this.deliverTo = null;
    done && done({ iced: cup.iced });
  }
  cupHome() { this.tweens.add({ targets: this.cup, x: WORK.x, y: WORK.y, duration: 240 * SP, ease: "Back.out" }); }
  cupBack() { if (this.cup) { this.cupHome(); this.cup.setInteractive(); } }
  giveCup(c, iced, n) {
    const cup = this.cup; this.cup = null;
    cup.disableInteractive();
    if (c.id === "yahya") { this.handCup = cup; return; }
    this.tweens.add({ targets: cup, x: 380 + (n === 2 ? 60 : -40), y: 560, scale: 0.6, alpha: 0, duration: 380 * SP, ease: "Quad.in", onComplete: () => cup.destroy() });
  }
  nope(t) { Snd.play("deny"); this.tweens.add({ targets: t, angle: { from: -6, to: 6 }, duration: 60 * SP, yoyo: true, repeat: 2, onComplete: () => { t.angle = 0; } }); }
  guide(target, r = 90) {
    if (this.ring) { this.ring.destroy(); this.ring = null; }
    if (!target) return;
    r = Math.min(r, target.x - 6, W - 6 - target.x);
    this.ring = this.add.circle(target.x, target.y, r).setStrokeStyle(8, 0xffffff, 0.9).setDepth(13);
    this.tweens.add({ targets: this.ring, scale: 1.18, alpha: 0.25, duration: 700, yoyo: true, repeat: -1 });
  }
  hint() {
    if (this.phase !== "make" || !this.cup) return this.guide(null);
    if (this.cup.level < 0.86) return this.guide({ x: this.jugs[0].x, y: LINE - 80 });
    const t = this.custPos(this.current);
    this.guide({ x: t.x, y: t.y + 60 }, 130);
  }
  sparkle(x, y, n = 8) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI * (0.1 + 0.8 * i / Math.max(1, n - 1));
      const s = this.add.image(x + Math.cos(a) * 120, y + Math.sin(a) * 120, "coin").setScale(0.08).setDepth(16);
      this.tweens.add({ targets: s, x: x + Math.cos(a) * 230, y: y + Math.sin(a) * 230, angle: 180, scale: 0.14, alpha: 0, duration: 750 * SP, ease: "Quad.out", onComplete: () => s.destroy() });
    }
  }
  async sunset() {
    this.phase = "closed"; this.guide(null); this.hush();
    const d = G.play.day;
    if (!d.closed) { Wallet.closeDay(G.play); checkMoney(); persist(); }
    const glow = this.add.rectangle(W / 2, H / 2, W, H, 0xff7a2a, 0).setDepth(30);
    await this.tween({ targets: glow, fillAlpha: 0.35, duration: 900 });
    this.text(W / 2, 560, "الشمس غربت", 52, "#fff6e4", { stroke: "#3b2016", strokeThickness: 10 }).setDepth(31);
    const left = d.stock - d.sold;
    if (this.stockBadge) this.stockBadge.setVisible(false);
    if (this.ring) { this.ring.destroy(); this.ring = null; }
    if (left > 0) {
      for (let i = 0; i < left; i++) {
        const c = this.add.image(250 + i * 70, LINE - 60, "cup_juice").setScale(0.16).setDepth(32);
        this.tweens.add({ targets: c, angle: 120, y: LINE + 60, alpha: 0, duration: 700 * SP, delay: (300 + i * 250) * SP });
      }
      if (this.cup) { this.tween({ targets: this.cup, alpha: 0, y: this.cup.y + 80, duration: 500 }); }
      Snd.play("splash");
      this.jugs.forEach(j => this.tweens.add({ targets: j, angle: 100, alpha: 0.3, duration: 700 * SP }));
      this.text(W / 2, 650, `اترمى ${left === 1 ? "كوباية" : left === 2 ? "كوبايتين" : ar(left) + " كوبايات"} مااتباعوش`, 38, "#fff6e4", { stroke: "#3b2016", strokeThickness: 10 }).setDepth(31);
    }
    await this.wait(1500);
    setStep("ledger");
    this.button(W / 2, 800, "نقفل الدفتر", () => this.goTo("ledger", "دفتر الكشك"), { w: 380, depth: 45 });
  }

  // ---------- Yahya's rig (from the art proof, step 2) ----------
  makeYahya() {
    const rig = this.cache.json.get("rig");
    const at = (n, px, py) => { const p = rig.parts[n]; return this.add.image((p.x - px) * S, (p.y - py) * S, "y_" + n).setOrigin(0, 0).setScale(TEX); };
    const group = (pv) => this.add.container((pv[0] - ORIGIN[0]) * S, (pv[1] - ORIGIN[1]) * S);
    const pv = rig.pivots;
    this.yahya = this.add.container(W + 320, LINE).setDepth(2);
    this.root = this.add.container(0, 0); this.yahya.add(this.root);
    this.armL = group(pv.elbowHangL); this.armLIdle = this.add.container(0, 0); this.armLIdle.add(at("armL_down", ...pv.elbowHangL)); this.armL.add(this.armLIdle);
    this.armR = group(pv.elbowHangR); this.armRIdle = this.add.container(0, 0); this.armRIdle.add(at("armR_down", ...pv.elbowHangR)); this.armR.add(this.armRIdle);
    this.torso = at("torso", ...ORIGIN);
    this.torsoCut = at("torso_noRsleeve", ...ORIGIN).setVisible(false);
    this.armRpose = group(pv.shoulderR);
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
    this.setExpr("eager");
  }
  setExpr(name) {
    const set = { eager: ["eager", "eager"], happy: ["happy", "happy"], oops: ["surprised", "surprised"] }[name];
    this.expr = name;
    Object.entries(this.eyes).forEach(([k, im]) => im.setVisible(k === set[0]));
    Object.entries(this.mouths).forEach(([k, im]) => im.setVisible(k === set[1]));
    this.baseEyes = set[0];
  }
  changeExpr(name) {
    if (name === this.expr) return Promise.resolve();
    return new Promise(res => {
      Object.values(this.eyes).forEach(im => im.setVisible(false)); this.eyes.blink.setVisible(true);
      this.tweens.add({ targets: this.head, scaleY: 0.965, scaleX: 1.02, duration: 70 * SP, yoyo: true, onYoyo: () => this.setExpr(name), onComplete: res });
    });
  }
  setArm(pose) {
    this.armR.setVisible(pose === "down");
    this.torso.setVisible(pose === "down"); this.torsoCut.setVisible(pose !== "down");
    this.armFront.setVisible(pose !== "down");
    if (pose !== "down") this.update(0, 0);
    this.reach.setVisible(pose === "reach"); this.grip.setVisible(pose === "grip");
    this.armPose = pose;
  }
  idleYahya() {
    // breathing and blinks: he never looks frozen, but he does not fidget either
    this.tweens.add({ targets: this.root, scaleY: 1.012, scaleX: 0.997, duration: 1300, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.tweens.add({ targets: this.head, angle: { from: -1.2, to: 1.4 }, duration: 2300, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.time.addEvent({ delay: 2600, loop: true, callback: () => {
      if (this.blinking || this.baseEyes === "happy") return;
      this.blinking = true; this.eyes[this.baseEyes].setVisible(false); this.eyes.blink.setVisible(true);
      this.time.delayedCall(110, () => { this.eyes.blink.setVisible(false); this.eyes[this.baseEyes].setVisible(true); this.blinking = false; });
    } });
  }
  walkYahya(toX, ms, ease) {
    return new Promise(res => {
      const bob = this.tweens.add({ targets: this.root, y: -14, duration: 230, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      for (let i = 0; i < Math.floor(ms / 300); i++) this.time.delayedCall(i * 300 * SP, () => Snd.play("step"));
      this.tweens.add({ targets: this.yahya, x: toX, duration: ms * SP, ease, onComplete: () => { bob.stop(); this.root.y = 0; res(); } });
    });
  }
  // the hand-off: with ice his grip drawing takes the cup (that drawing has ice); without ice he reaches and the cup sits in his hand
  async receive(iced) {
    const cup = this.handCup; this.handCup = null;
    await this.tween({ targets: this.headTilt, angle: -4, duration: 140, ease: "Quad.out" });
    this.setArm("reach"); Snd.play("tap");
    await this.tween({ targets: cup, x: HAND.x, y: HAND.y, duration: 220, ease: "Quad.out" });
    if (iced) { this.setArm("grip"); cup.destroy(); }
    else { cup.setDepth(10); this.heldCup = cup; }
    this.tween({ targets: this.headTilt, angle: 0, duration: 160 });
    if (iced) { await this.changeExpr("happy"); Snd.play("good"); await this.tween({ targets: this.root, y: -40, duration: 200, yoyo: true, ease: "Quad.out" }); this.sparkle(YX, 420, 9); }
    else { await this.wait(300); }
  }
}

// ---------- 4. the kiosk's ledger: revenue is not profit; the capital stays; the profit chooses a pocket ----------
class Ledger extends Base {
  constructor() { super("ledger"); }
  async create() {
    this.setup(); setStep("ledger");
    this.add.image(W / 2, H / 2, "street").setDisplaySize(W, H);
    this.add.rectangle(W / 2, H / 2, W, H, 0x2b1a12, 0.5);
    this.hud();
    const d = G.play.day;
    const paper = this.add.graphics().fillStyle(0x000000, 0.25).fillRoundedRect(40, 228, 640, 640, 30).fillStyle(0xfffaf0).fillRoundedRect(40, 220, 640, 640, 30).lineStyle(6, INK).strokeRoundedRect(40, 220, 640, 640, 30);
    this.text(360, 270, "دفتر الكشك", 42);
    this.text(360, 322, `رأس المال اللي حطيته الصبح: ${ar(d.capitalMorning)} (اشترينا بيه العصير)`, 26, "#7d746a");
    const rows = [
      [`البيع (${ar(d.sold)} × ${ar(P.cup)})`, "+" + ar(d.revenue), "#2f6b4f"],
      [`العصير (${d.jugs === 2 ? "إبريقين" : "إبريق"})`, "−" + ar(d.juiceCost), "#a4441c"],
      ["التلج", "−" + ar(d.iceCost), "#a4441c"],
    ];
    if (d.wasted > 0) rows.push([`اترمى ${ar(d.wasted)} (تمنهم جوه العصير)`, "", "#7d746a"]);
    let y = 385;
    const fresh = !this.alreadyShown(d);
    for (const [k, v, col] of rows) {
      this.text(430, y, k, 30, col, { align: "right" }).setOrigin(1, 0.5).setX(640);
      this.text(110, y, v, 34, col);
      y += 62; if (fresh) { Snd.play("tap"); await this.wait(450); }
    }
    this.add.graphics().lineStyle(4, INK).lineBetween(80, y - 20, 640, y - 20);
    this.text(640, y + 20, "المكسب = البيع − العصير − التلج", 30).setOrigin(1, 0.5);
    this.profitText = this.text(110, y + 20, ar(d.profit), 46, "#2f6b4f");
    y += 90;
    this.text(360, y, `رأس المال ${ar(d.capitalMorning)} بيفضل في المشروع لشراء عصير جديد بكرة`, 26, "#3b2016", { wordWrap: { width: 580 } });
    this.y0 = y + 90;
    if (fresh) { Snd.play("good"); await this.wait(400); }
    this.markShown(d);
    if (!G.play.ledgerDone) this.distribute(); else if (G.step === "ledger") this.savePocket(); else this.scene.start("goal");
  }
  alreadyShown(d) { return !!d.shown; }
  markShown(d) { d.shown = true; persist(); }
  // the profit leaves the project one coin at a time, to the ball or to my pocket; whatever stays, stays in the project
  distribute() {
    const d = G.play.day;
    const panelY = 990;
    const g = this.add.graphics().fillStyle(0xffffff, 0.96).fillRoundedRect(30, panelY - 90, 660, 180, 28).lineStyle(5, INK).strokeRoundedRect(30, panelY - 90, 660, 180, 28);
    const q = this.text(360, panelY - 50, "", 32);
    const upd = () => q.active && q.setText(d.profitLeft > 0 ? `المكسب اللي لسه في المشروع: ${ar(d.profitLeft)}. يروح فين؟` : "المكسب اتوزّع.");
    upd();
    const toGoal = this.button(530, panelY + 25, "+١ للكورة", () => move("goal"), { w: 240, h: 96, size: 32 });
    const toPocket = this.button(190, panelY + 25, "+١ لمصروفي", () => move("pocket"), { w: 240, h: 96, size: 32 });
    const allGoal = this.button(530, panelY + 145, "كله للكورة", () => moveAll(), { w: 240, h: 96, size: 30, color: 0xd9f2c4 });
    const done = this.button(190, panelY + 145, "تمام", () => finish(), { w: 240, h: 96, size: 32, color: 0xe8dcc4 });
    const move = async (to) => {
      if (d.profitLeft < 1 || this.moving) return;
      this.moving = true;
      Wallet.takeProfit(G.play, to, 1); checkMoney(); persist();
      await this.fly(this.chipAt.project, this.chipAt[to], 1, () => {});
      this.refresh(); this.bumpChip(to); upd(); this.moving = false;
    };
    const moveAll = async () => { while (d.profitLeft > 0) { this.moving = false; await move("goal"); } };
    const finish = async () => {
      if (this.finishing) return; this.finishing = true;
      while (this.moving) await this.wait(60);
      this.finishing = false;
      [toGoal, toPocket, allGoal, done].forEach(b => b.destroy()); g.destroy(); q.destroy();
      G.play.ledgerDone = true; persist();
      this.savePocket();
    };
  }
  // then: save something from my own pocket too?
  savePocket() {
    const panelY = 990;
    const g = this.add.graphics().fillStyle(0xffffff, 0.96).fillRoundedRect(30, panelY - 90, 660, 180, 28).lineStyle(5, INK).strokeRoundedRect(30, panelY - 90, 660, 180, 28);
    const q = this.text(360, panelY - 50, "", 32);
    let one, all;
    const upd = () => { q.active && q.setText(`ومن مصروفك؟ معاك ${ar(G.play.pocket)}`); if (one) { one.setEnabled(G.play.pocket > 0); all.setEnabled(G.play.pocket > 0); } };
    one = this.button(530, panelY + 25, "+١ للكورة", () => put(1), { w: 240, h: 96, size: 32 });
    all = this.button(190, panelY + 25, "كله للكورة", () => put(G.play.pocket), { w: 240, h: 96, size: 30, color: 0xd9f2c4 });
    upd();
    const done = this.button(W / 2, panelY + 145, "خلّصت", async () => { if (this.finishing) return; this.finishing = true; while (this.moving) await this.wait(60); this.finishing = false; [one, all, done].forEach(b => b.destroy()); g.destroy(); q.destroy(); this.goTo("goal", "حصالة كنافة"); }, { w: 300, h: 96, size: 34, color: 0xe8dcc4 });
    const put = async (n) => {
      if (n < 1 || G.play.pocket < 1 || this.moving) return;
      this.moving = true;
      Wallet.save(G.play, n); checkMoney(); persist();
      await this.fly(this.chipAt.pocket, this.chipAt.goal, n, () => {});
      this.refresh(); this.bumpChip("goal"); upd(); this.moving = false;
    };
  }
}

// ---------- 5. Kunafa's box: where the ball money came from, and how far it is ----------
class Goal extends Base {
  constructor() { super("goal"); }
  async create() {
    this.setup();
    if (!G.play.practice) setStep("done");
    this.add.image(W / 2, H / 2, "street").setDisplaySize(W, H);
    this.add.rectangle(W / 2, H / 2, W, H, 0x2b1a12, 0.45);
    this.hud();
    const s = G.play, g = s.goal, f = Wallet.forecast(s), d = s.day;
    const card = this.add.graphics().fillStyle(0x000000, 0.25).fillRoundedRect(30, 228, 660, 720, 30).fillStyle(0xfffaf0).fillRoundedRect(30, 220, 660, 720, 30).lineStyle(6, INK).strokeRoundedRect(30, 220, 660, 720, 30);
    this.text(360, 270, "كورة الشارع", 44);
    // the big bar: green from my pocket, orange from the kiosk's profit (filled from the right)
    const x0 = 70, w = 580, y = 320, h = 56, u = w / g.price;
    const bar = this.add.graphics().fillStyle(0xffffff).fillRoundedRect(x0, y, w, h, 20).lineStyle(5, INK).strokeRoundedRect(x0, y, w, h, 20);
    const pw = g.fromPocket * u, kw = g.fromProfit * u;
    bar.fillStyle(s.practice ? 0x8a8a82 : GREEN).fillRect(x0 + w - pw, y + 3, pw, h - 6).fillStyle(s.practice ? 0xb0aca2 : ORANGE).fillRect(x0 + w - pw - kw, y + 3, kw, h - 6);
    this.text(360, 430, `${ar(g.saved)} من ${ar(g.price)}`, 54);
    this.add.graphics().fillStyle(GREEN).fillRoundedRect(560, 486, 30, 30, 8).fillStyle(ORANGE).fillRoundedRect(300, 486, 30, 30, 8);
    this.text(470, 500, `${ar(g.fromPocket)} من المصروف`, 30);
    this.text(200, 500, `${ar(g.fromProfit)} من الكشك`, 30);
    this.add.graphics().lineStyle(3, 0xd8cdb8).lineBetween(70, 550, 650, 550);
    const count = (n, one, two, few, many) => n === 1 ? one : n === 2 ? two : `${ar(n)} ${n <= 10 ? few : many}`;
    const weeks = f.pocketWeeks === null ? "مش هتوصل كده" : f.pocketWeeks === 0 ? "وصلت!" : `حوالي ${count(f.pocketWeeks, "أسبوع", "أسبوعين", "أسابيع", "أسبوع")} كمان`;
    const days = f.kioskDays === null ? "—" : f.kioskDays === 0 ? "وصلت!" : `حوالي ${count(f.kioskDays, "يوم كشك", "يومين كشك", "أيام كشك", "يوم كشك")} كمان`;
    this.text(360, 600, `فاضل ${ar(f.left)}`, 40);
    this.text(360, 670, `من المصروف بس (${ar(g.fromPocket)} في الأسبوع): ${weeks}`, 28, "#2f6b4f", { wordWrap: { width: 600 } });
    this.text(360, 740, `لو كل يوم كشك مكسبه ${ar(Math.max(0, d.profit))} وراح كله للكورة: ${days}`, 28, "#a4441c", { wordWrap: { width: 600 } });
    this.text(360, 830, s.project.cash > s.project.capital ? `في المشروع ${ar(s.project.cash)}: رأس مال ${ar(s.project.capital)} لعصير بكرة، و${ar(s.project.cash - s.project.capital)} مكسب سبته في المشروع` : `في المشروع ${ar(s.project.cash)}: رأس مال لشراء عصير بكرة`, 26, "#3b2016", { wordWrap: { width: 600 } });
    this.text(360, 885, `ومعاك في مصروفك ${ar(s.pocket)}`, 26);
    // Yahya (earlier picture, stand-in) and the outcome in one line
    const y2 = this.add.image(600, 1270, "yahya_full").setOrigin(0.5, 1).setScale(0.62);
    this.tweens.add({ targets: y2, y: 1255, duration: 500, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    if (s.practice && G.realResult) {
      this.text(300, 990, `اليوم الحقيقي: ${ar(G.realResult.saved)} من ٣٠\nيوم التجربة: ${ar(g.saved)} من ٣٠`, 30, "#fff6e4", { stroke: "#3b2016", strokeThickness: 8 });
      this.button(300, 1150, "ارجع لليوم الحقيقي", () => { G.play = G.real; this.goTo("goal", "حصالة كنافة"); }, { w: 420, size: 34 });
      return;
    }
    G.realResult = { saved: g.saved };
    await this.say("yahya", g.saved >= 15 ? "قرّبنا أوي من الكورة!" : "لسه بدري… بس قرّبنا!");
    this.hush();
    this.button(290, 1020, "جرّب اختيار تاني", () => this.practice(), { w: 440, size: 36 });
    this.button(290, 1150, "ابدأ من الأول", () => { fresh(); G.realResult = null; this.goTo("street", "شارع الفكرة"); }, { w: 440, size: 32, color: 0xe8dcc4 });
    if (TEST) window.__advDone = true;
  }
  practice() {
    // a practice day: the same morning (allowance in the pocket), grey coins, nothing saved
    const p = Wallet.clone(G.practiceBase || G.real); p.practice = true;
    G.play = p;
    this.goTo("grocery", "يوم تجربة · بقالة ستو");
  }
}

// ---------- test hooks (only with ?test=1) ----------
if (TEST) {
  const page = (sc, x, y) => { const r = sc.game.canvas.getBoundingClientRect(); return { x: r.left + x * r.width / W, y: r.top + y * r.height / H }; };
  window.__adv = {
    scene: () => window.__scene && window.__scene.scene.key,
    step: () => G.step,
    wallet: () => JSON.parse(JSON.stringify(G.play)),
    real: () => JSON.parse(JSON.stringify(G.real)),
    check: () => Wallet.check(G.play),
    buttons: () => ((window.__scene && window.__scene.btns) || []).filter(b => b.c && b.c.active).map(b => ({ label: b.label, enabled: b.enabled, ...page(window.__scene, b.c.x + (b.c.parentContainer ? b.c.parentContainer.x : 0), b.c.y) })),
    phase: () => window.__scene.phase,
    busy: () => !!window.__scene.busy || !!window.__scene.pouring,
    customer: () => { const s = window.__scene; return s.current ? s.current.id : null; },
    waitingForCup: () => !!window.__scene.deliverTo,
    cup: () => { const s = window.__scene; return s.cup ? { level: s.cup.level, iced: s.cup.iced, ...page(s, s.cup.x, s.cup.y) } : null; },
    jug: () => { const s = window.__scene; return page(s, s.jugs[0].x, LINE - 80); },
    ice: () => page(window.__scene, 636, LINE - 60),
    target: () => { const s = window.__scene; const t = s.custPos(s.current); return page(s, t.x, t.y + 60); },
    fps: () => Math.round(window.__scene.game.loop.actualFps),
    talking: () => !!window.__scene.card,
  };
}

const fontReady = new Promise(res => (document.readyState === "complete" ? res() : window.addEventListener("load", res)))
  .then(() => document.fonts.load('800 40px "Baloo Bhaijaan 2"', "مصروفي كورة الشارع ٠١٢٣٤٥٦٧٨٩"));   // the Arabic subset, not only Latin
Promise.race([fontReady, new Promise(r => setTimeout(r, 4000))]).catch(() => {}).finally(() => new Phaser.Game({
  type: Phaser.AUTO, parent: "game", width: W, height: H, backgroundColor: "#2b1a12",
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, input: { activePointers: 2 },
  scene: [Boot, Street, Grocery, Kiosk, Ledger, Goal],
}));
