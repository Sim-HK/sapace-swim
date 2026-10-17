// 마우스·터치·키보드·손 제스처를 하나의 "의도" 프레임으로 합친다
const FIST_HOLD = 0.9;
const VICTORY_HOLD = 0.6;

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const dead = (v, d) => (Math.abs(v) < d ? 0 : (v - Math.sign(v) * d) / (1 - d));

export class Input {
  constructor(el, hands) {
    this.el = el;
    this.hands = hands;
    this.keys = new Set();
    this.mouse = { x: 0.5, y: 0.5, down: false, moved: 0, inside: false };
    this.acc = { dx: 0, dy: 0, zoom: 0, select: false, fly: false, back: false };
    this.touches = new Map();
    this.pinchDist = null;
    this.source = 'mouse';
    this.hand = { cursor: { x: 0.5, y: 0.5 }, prev: null, wasPinch: false, fistT: 0, fistFired: false, vT: 0, vFired: false, twoDist: null };

    el.addEventListener('pointerdown', (e) => this.onDown(e));
    window.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', (e) => this.onUp(e));
    window.addEventListener('pointercancel', (e) => this.onUp(e));
    el.addEventListener('pointerleave', () => { this.mouse.inside = false; });
    el.addEventListener('wheel', (e) => { e.preventDefault(); this.acc.zoom += -e.deltaY * 0.0012; }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'KeyF') this.acc.fly = true;
      if (e.code === 'Escape' || e.code === 'Backspace') this.acc.back = true;
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  onDown(e) {
    this.el.setPointerCapture?.(e.pointerId);
    this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.source = e.pointerType === 'touch' ? 'touch' : 'mouse';
    this.mouse.down = true;
    this.mouse.moved = 0;
    this.mouse.x = e.clientX / innerWidth;
    this.mouse.y = e.clientY / innerHeight;
    if (this.touches.size === 2) this.pinchDist = this.touchSpread();
  }

  onMove(e) {
    if (e.pointerType !== 'touch') this.mouse.inside = true;
    const prev = this.touches.get(e.pointerId);
    if (prev) {
      if (this.touches.size === 1) {
        this.acc.dx += (e.clientX - prev.x) / innerHeight;
        this.acc.dy += (e.clientY - prev.y) / innerHeight;
        this.mouse.moved += Math.hypot(e.clientX - prev.x, e.clientY - prev.y);
      }
      prev.x = e.clientX; prev.y = e.clientY;
      if (this.touches.size === 2) {
        const d = this.touchSpread();
        if (this.pinchDist) this.acc.zoom += ((d - this.pinchDist) / innerHeight) * 2.5;
        this.pinchDist = d;
        this.mouse.moved += 100;
      }
    }
    if (this.touches.size <= 1) {
      this.mouse.x = e.clientX / innerWidth;
      this.mouse.y = e.clientY / innerHeight;
    }
  }

  onUp(e) {
    if (!this.touches.has(e.pointerId)) return;
    this.touches.delete(e.pointerId);
    if (this.touches.size === 0) {
      if (this.mouse.moved < 8) this.acc.select = true;
      this.mouse.down = false;
      this.pinchDist = null;
    }
  }

  touchSpread() {
    const [a, b] = [...this.touches.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  frame(dt) {
    const k = this.keys;
    const f = {
      source: this.source, pointer: { x: this.mouse.x, y: this.mouse.y },
      pointerActive: this.mouse.inside || this.mouse.down,
      drag: { x: 0, y: 0 }, dragging: false,
      aim: { x: 0, y: 0 }, aiming: false,
      keySteer: { x: 0, y: 0 },
      thrust: 0, boost: false, brake: false,
      select: false, zoom: this.acc.zoom, fly: this.acc.fly, back: this.acc.back,
      gesture: null, hold: null, handCount: 0,
    };

    // 키보드
    if (k.has('KeyW')) f.thrust += 1;
    if (k.has('KeyS')) f.thrust -= 1;
    if (k.has('ArrowLeft') || k.has('KeyA')) f.keySteer.x -= 1;
    if (k.has('ArrowRight') || k.has('KeyD')) f.keySteer.x += 1;
    if (k.has('ArrowUp')) f.keySteer.y -= 1;
    if (k.has('ArrowDown')) f.keySteer.y += 1;
    if (k.has('ShiftLeft') || k.has('ShiftRight') || k.has('Space')) f.boost = true;
    if (k.has('KeyX')) f.brake = true;

    // 마우스/터치
    if (this.mouse.down && this.mouse.moved >= 8) {
      f.dragging = true;
      f.drag.x = this.acc.dx; f.drag.y = this.acc.dy;
    }
    if (this.mouse.down) {
      f.aiming = true;
      f.aim.x = dead((this.mouse.x - 0.5) * 2, 0.08);
      f.aim.y = dead((this.mouse.y - 0.5) * 2, 0.08);
    }
    f.select = this.acc.select;

    // 손
    const H = this.hands?.ready ? this.hands.hands : [];
    f.handCount = H.length;
    const hs = this.hand;
    if (H.length) {
      this.source = 'hand';
      f.source = 'hand';
      const h = H[0];
      const tx = clamp01((h.palm.x - 0.18) / 0.64);
      const ty = clamp01((h.palm.y - 0.12) / 0.62);
      const a = 1 - Math.exp(-dt * 16);
      hs.cursor.x += (tx - hs.cursor.x) * a;
      hs.cursor.y += (ty - hs.cursor.y) * a;
      f.pointer = { x: hs.cursor.x, y: hs.cursor.y };
      f.pointerActive = true;
      f.gesture = h.gesture;

      if (H.length >= 2) {
        // 두 손 벌리기/모으기 = 확대/축소
        const d = Math.hypot(H[0].palm.x - H[1].palm.x, H[0].palm.y - H[1].palm.y);
        if (hs.twoDist != null) f.zoom += (d - hs.twoDist) * 3.2;
        hs.twoDist = d;
        f.gesture = 'two';
        hs.prev = null; hs.wasPinch = false;
      } else {
        hs.twoDist = null;
        const g = h.gesture;
        if (g === 'pinch') {
          if (!hs.wasPinch) f.select = true;
          else if (hs.prev) {
            f.dragging = true;
            f.drag.x += (hs.cursor.x - hs.prev.x) * (innerWidth / innerHeight);
            f.drag.y += hs.cursor.y - hs.prev.y;
          }
          hs.prev = { x: hs.cursor.x, y: hs.cursor.y };
        } else {
          hs.prev = null;
        }
        hs.wasPinch = g === 'pinch';

        if (g === 'open' || g === 'point') {
          f.aiming = true;
          f.aim.x = dead((hs.cursor.x - 0.5) * 2, 0.16);
          f.aim.y = dead((hs.cursor.y - 0.5) * 2, 0.16);
          f.thrust = Math.max(f.thrust, g === 'open' ? 1 : 0.45);
        }
        if (g === 'fist') {
          f.brake = true;
          hs.fistT += dt;
          if (hs.fistT >= FIST_HOLD && !hs.fistFired) { f.back = true; hs.fistFired = true; }
          if (!hs.fistFired) f.hold = { kind: 'back', p: hs.fistT / FIST_HOLD };
        } else { hs.fistT = 0; hs.fistFired = false; }
        if (g === 'victory') {
          hs.vT += dt;
          if (hs.vT >= VICTORY_HOLD && !hs.vFired) { f.fly = true; hs.vFired = true; }
          if (!hs.vFired) f.hold = { kind: 'fly', p: hs.vT / VICTORY_HOLD };
        } else { hs.vT = 0; hs.vFired = false; }
      }
    } else {
      hs.prev = null; hs.wasPinch = false; hs.twoDist = null; hs.fistT = 0; hs.vT = 0;
      if (this.source === 'hand') this.source = 'mouse';
    }

    this.acc = { dx: 0, dy: 0, zoom: 0, select: false, fly: false, back: false };
    return f;
  }
}
