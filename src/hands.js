import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z - b.z) * 0.5);

// 손가락 하나가 펴졌는지: 손목→끝 거리가 손목→가운데 마디 거리보다 충분히 길면 편 것
function extended(lm, tip, pip) {
  return dist(lm[0], lm[tip]) > dist(lm[0], lm[pip]) * 1.12;
}

export class HandTracker {
  constructor(video, overlay) {
    this.video = video;
    this.overlay = overlay;
    this.ctx = overlay.getContext('2d');
    this.ready = false;
    this.hands = [];
    this.lastVideoTime = -1;
    this.lastDetect = 0;
    this.memory = [{}, {}];
  }

  async start() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false });
    this.video.srcObject = stream;
    await this.video.play();
    const vision = await FilesetResolver.forVisionTasks(WASM);
    const opts = (delegate) => ({
      baseOptions: { modelAssetPath: MODEL, delegate },
      runningMode: 'VIDEO', numHands: 2,
      minHandDetectionConfidence: 0.6, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5,
    });
    try {
      this.landmarker = await HandLandmarker.createFromOptions(vision, opts('GPU'));
    } catch {
      this.landmarker = await HandLandmarker.createFromOptions(vision, opts('CPU'));
    }
    this.overlay.width = this.video.videoWidth || 640;
    this.overlay.height = this.video.videoHeight || 480;
    this.ready = true;
  }

  // 매 프레임 호출. 최신 손 상태(this.hands)를 갱신한다.
  update(now) {
    if (!this.ready || this.video.readyState < 2) return;
    if (now - this.lastDetect < 30 || this.video.currentTime === this.lastVideoTime) return;
    this.lastDetect = now;
    this.lastVideoTime = this.video.currentTime;
    const res = this.landmarker.detectForVideo(this.video, now);
    const raw = (res.landmarks || []).map((lm) => this.classify(lm));
    // 화면 기준 오른쪽 손이 먼저 오도록 정렬 → 손 순서가 프레임마다 뒤바뀌지 않게
    raw.sort((a, b) => b.palm.x - a.palm.x);
    raw.forEach((h, i) => this.debounce(h, i));
    this.hands = raw;
    this.draw(res.landmarks || []);
  }

  classify(lm) {
    const size = dist(lm[0], lm[9]) || 1e-3;
    const pinchRatio = dist(lm[4], lm[8]) / size;
    const ext = {
      index: extended(lm, 8, 6), middle: extended(lm, 12, 10),
      ring: extended(lm, 16, 14), pinky: extended(lm, 20, 18),
    };
    // 주먹 상태에서 엄지가 검지에 닿는 경우를 집기로 오인하지 않도록 검지가 어느 정도 뻗어 있어야 한다
    const indexOut = dist(lm[0], lm[8]) > dist(lm[0], lm[5]) * 1.1;
    const palm = { x: 0, y: 0 };
    for (const i of [0, 5, 9, 13, 17]) { palm.x += lm[i].x / 5; palm.y += lm[i].y / 5; }
    return {
      lm, size, pinchRatio, ext, indexOut,
      palm: { x: 1 - palm.x, y: palm.y },  // 거울 모드
      pinch: false, gesture: 'none',
    };
  }

  debounce(h, i) {
    const m = this.memory[i];
    // 집기: 히스테리시스로 떨림 방지
    const was = !!m.pinch;
    h.pinch = h.indexOut && (was ? h.pinchRatio < 0.5 : h.pinchRatio < 0.32);
    m.pinch = h.pinch;

    let g;
    const e = h.ext;
    if (h.pinch) g = 'pinch';
    else if (e.index && e.middle && e.ring && e.pinky) g = 'open';
    else if (e.index && e.middle && !e.ring && !e.pinky) g = 'victory';
    else if (e.index && !e.middle && !e.ring && !e.pinky) g = 'point';
    else if (!e.index && !e.middle && !e.ring && !e.pinky) g = 'fist';
    else g = 'relaxed';

    // 집기는 즉시, 나머지는 3프레임 연속일 때 확정
    if (g === 'pinch') { m.stable = g; m.cand = g; m.count = 0; }
    else if (g === m.cand) { m.count = (m.count || 0) + 1; if (m.count >= 2) m.stable = g; }
    else { m.cand = g; m.count = 0; if (m.stable === 'pinch') m.stable = 'relaxed'; }
    h.gesture = m.stable || g;
  }

  draw(all) {
    const c = this.ctx, w = this.overlay.width, hgt = this.overlay.height;
    c.clearRect(0, 0, w, hgt);
    const conns = HandLandmarker.HAND_CONNECTIONS;
    all.forEach((lm) => {
      c.strokeStyle = 'rgba(140,190,255,0.9)';
      c.lineWidth = 3;
      c.beginPath();
      for (const { start, end } of conns) {
        c.moveTo(lm[start].x * w, lm[start].y * hgt);
        c.lineTo(lm[end].x * w, lm[end].y * hgt);
      }
      c.stroke();
      for (const i of [4, 8, 12, 16, 20]) {
        c.fillStyle = i === 4 || i === 8 ? '#ffb86b' : '#cfe2ff';
        c.beginPath();
        c.arc(lm[i].x * w, lm[i].y * hgt, 6, 0, Math.PI * 2);
        c.fill();
      }
    });
  }
}
