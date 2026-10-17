import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Space } from './space.js';
import { Flight } from './flight.js';
import { HandTracker } from './hands.js';
import { Input } from './input.js';
import { T, TYPE_LABELS } from './planets.js';

const $ = (id) => document.getElementById(id);
const canvas = $('scene');

// ---------- 렌더러 ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.5, 40000);
camera.rotation.order = 'YXZ';
camera.position.set(0, 30, 320);

const space = new Space();
const flight = new Flight();
flight.setAspect(innerWidth / innerHeight);

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(space.scene, camera);
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.7, 0.55, 0.78);
composer.addPass(renderPass);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const hands = new HandTracker($('cam'), $('cam-overlay'));
const input = new Input(canvas, hands);

// ---------- 상태 ----------
const UP = new THREE.Vector3(0, 1, 0);
const S = {
  mode: 'intro',           // intro | space | toInspect | inspect | toSpace | toFlight | flight | fromFlight
  yaw: 0, pitch: 0.03, roll: 0,
  vel: new THREE.Vector3(),
  hover: null, target: null,
  orbitDir: new THREE.Vector3(), dist: 0,
  spin: { x: 0, y: 0 },
  viewShift: 0,
  tween: null,
  hintKey: '',
};

// ---------- 라벨 ----------
for (const p of space.planets) {
  const el = document.createElement('div');
  el.className = 'plabel';
  el.innerHTML = `<span class="n">${p.def.name}</span><span class="d">${p.def.en}</span><span class="g">🤏 잡아서 들여다보기</span>`;
  $('labels').appendChild(el);
  p.labelEl = el;
}

function updateLabels() {
  const show = S.mode === 'space';
  for (const p of space.planets) {
    const s = p.screen, el = p.labelEl;
    const limit = p.def.type === T.STAR ? 9000 : 3200;
    if (!show || !s.visible || s.dist > limit) { el.style.opacity = 0; continue; }
    const R = Math.max(s.r, 16);
    const hover = p === S.hover;
    el.classList.toggle('hover', hover);
    el.style.setProperty('--r', `${R}px`);
    el.style.opacity = hover ? 1 : Math.min(1, (1 - s.dist / limit) * 2.2) * 0.85;
    el.style.transform = `translate(${s.x}px, ${s.y - R - 8}px) translate(-50%, -100%)`;
  }
}

// ---------- UI ----------
const HINTS = {
  'space:hand': [['✋', '헤엄'], ['손 위치', '방향'], ['🤏', '별 잡기 · 끌어서 둘러보기'], ['✊', '멈춤']],
  'space:mouse': [['W / S', '헤엄'], ['드래그', '둘러보기'], ['클릭', '별 잡기'], ['Shift', '가속']],
  'space:touch': [['드래그', '둘러보기'], ['두 손가락', '앞뒤로'], ['탭', '별 잡기']],
  'inspect:hand': [['🤏 끌기', '회전'], ['🙌', '확대·축소'], ['✌️ 유지', '하늘 비행'], ['✊ 유지', '우주로']],
  'inspect:mouse': [['드래그', '회전'], ['휠', '확대'], ['F', '하늘 비행'], ['Esc', '우주로']],
  'inspect:touch': [['드래그', '회전'], ['두 손가락', '확대']],
  'flight:hand': [['손 위치', '조종'], ['✋', '가속'], ['☝️', '순항'], ['✊ 유지', '궤도로']],
  'flight:mouse': [['누른 채 이동', '조종'], ['Shift', '가속'], ['X', '감속'], ['Esc', '궤도로']],
  'flight:touch': [['누른 채 이동', '조종']],
};
function updateHint(source) {
  const m = S.mode === 'inspect' ? 'inspect' : S.mode === 'flight' ? 'flight' : S.mode === 'space' ? 'space' : null;
  const key = m ? `${m}:${source}` : '';
  if (key === S.hintKey) return;
  S.hintKey = key;
  const el = $('hint');
  el.classList.toggle('hidden', !m);
  if (m) el.innerHTML = HINTS[key].map(([a, b]) => `<span><b>${a}</b>${b}</span>`).join('');
}

const MODE_LABELS = { space: '우주 유영', toInspect: '접근 중…', inspect: '행성 관측', toSpace: '이탈 중…', toFlight: '대기권 진입', flight: '대기권 비행', fromFlight: '궤도 복귀' };
function setMode(m) {
  S.mode = m;
  $('mode-label').textContent = MODE_LABELS[m] || '';
  $('info-card').classList.toggle('hidden', m !== 'inspect');
  $('flight-hud').classList.toggle('hidden', m !== 'flight');
  $('horizon').classList.toggle('hidden', m !== 'flight');
  $('speed').classList.toggle('hidden', m !== 'space');
  S.hintKey = '';
}

let toastTimer;
function toast(html, ms = 2600) {
  const el = $('toast');
  el.innerHTML = html;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

function fillCard(p) {
  const d = p.def;
  $('info-type').textContent = TYPE_LABELS[d.type];
  $('info-name').textContent = d.name;
  $('info-en').textContent = d.en;
  $('info-desc').textContent = d.desc;
  $('info-stats').innerHTML = Object.entries(d.stats).map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  $('btn-fly').textContent = d.type === T.STAR ? '✌️ 플라스마 바다 위를 날기' : '✌️ 하늘 비행하기';
}

const GESTURE_TEXT = {
  open: '✋ 헤엄', point: '☝️ 천천히', pinch: '🤏 잡기', victory: '✌️ 비행', fist: '✊ 멈춤', relaxed: '🖐 대기', two: '🙌 확대·축소',
};

// ---------- 카메라 트윈 ----------
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
function tweenCamera(toPos, look, dur, done) {
  const m = new THREE.Matrix4().lookAt(toPos, look, UP);
  S.tween = {
    fromPos: camera.position.clone(), fromQ: camera.quaternion.clone(),
    toPos: toPos.clone(), toQ: new THREE.Quaternion().setFromRotationMatrix(m),
    t: 0, dur, done,
  };
}
function runTween(dt) {
  const tw = S.tween;
  if (!tw) return;
  tw.t = Math.min(1, tw.t + dt / tw.dur);
  const e = ease(tw.t);
  camera.position.lerpVectors(tw.fromPos, tw.toPos, e);
  camera.quaternion.slerpQuaternions(tw.fromQ, tw.toQ, e);
  if (tw.t >= 1) { S.tween = null; tw.done?.(); }
}

// ---------- 모드 전환 ----------
function grabPlanet(p) {
  S.target = p;
  S.vel.set(0, 0, 0);
  S.spin = { x: 0, y: 0 };
  S.orbitDir.copy(camera.position).sub(p.group.position).normalize();
  S.dist = p.radius * (p.def.type === T.STAR ? 3.6 : p.def.type === T.GAS ? 3.0 : 3.3);
  const to = p.group.position.clone().addScaledVector(S.orbitDir, S.dist);
  setMode('toInspect');
  fillCard(p);
  toast(`${p.def.en}<small>${p.def.name} · ${TYPE_LABELS[p.def.type]}</small>`);
  tweenCamera(to, p.group.position, 1.6, () => setMode('inspect'));
}

function releasePlanet() {
  const p = S.target;
  if (!p) return;
  setMode('toSpace');
  const to = p.group.position.clone().addScaledVector(S.orbitDir, p.radius * 6 + 140);
  tweenCamera(to, p.group.position, 1.3, () => {
    const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
    S.yaw = e.y; S.pitch = e.x; S.roll = 0;
    S.target = null;
    setMode('space');
  });
}

function fadeTo(color, mid) {
  const fade = $('fade');
  fade.style.background = color;
  fade.style.opacity = 1;
  setTimeout(() => { mid(); setTimeout(() => { fade.style.opacity = 0; }, 120); }, 850);
}

function enterFlight() {
  const p = S.target;
  if (!p) return;
  setMode('toFlight');
  fadeTo(`radial-gradient(circle, #fff, ${p.def.atmo})`, () => {
    flight.enter(p);
    renderPass.scene = flight.scene;
    renderPass.camera = flight.camera;
    bloom.strength = p.def.type === T.STAR || p.def.type === T.LAVA ? 0.7 : 0.4;
    bloom.threshold = 0.75;
    $('fh-name').textContent = `${p.def.en} · ${p.def.name}`;
    setMode('flight');
    toast(`ENTERING ATMOSPHERE<small>${p.def.name}의 하늘</small>`);
  });
}

function exitFlight() {
  setMode('fromFlight');
  fadeTo('#000', () => {
    renderPass.scene = space.scene;
    renderPass.camera = camera;
    bloom.strength = 0.7;
    bloom.threshold = 0.78;
    setMode('inspect');
  });
}

// ---------- 모드별 업데이트 ----------
const tmp = new THREE.Vector3();
const fwd = new THREE.Vector3();

function updateSpace(dt, f) {
  const prevYaw = S.yaw;
  if (f.dragging) { S.yaw += f.drag.x * 2.2; S.pitch += f.drag.y * 2.2; }
  if (f.source === 'hand' && f.aiming) { S.yaw -= f.aim.x * 1.25 * dt; S.pitch -= f.aim.y * 0.95 * dt; }
  S.yaw -= f.keySteer.x * 1.3 * dt;
  S.pitch -= f.keySteer.y * 1.0 * dt;
  S.pitch = THREE.MathUtils.clamp(S.pitch, -1.45, 1.45);
  const yawRate = (S.yaw - prevYaw) / Math.max(dt, 1e-3);
  S.roll += (THREE.MathUtils.clamp(-yawRate * 0.18, -0.35, 0.35) - S.roll) * (1 - Math.exp(-dt * 3));
  camera.rotation.set(S.pitch, S.yaw, S.roll, 'YXZ');

  camera.getWorldDirection(fwd);
  const top = f.boost ? 620 : 170;
  tmp.copy(fwd).multiplyScalar(f.thrust * top);
  S.vel.lerp(tmp, 1 - Math.exp(-dt * 1.5));       // 물속처럼 부드러운 가감속
  S.vel.addScaledVector(fwd, f.zoom * 900);
  if (f.brake) S.vel.multiplyScalar(Math.exp(-dt * 5));
  camera.position.addScaledVector(S.vel, dt);

  // 행성 속으로 들어가지 않게
  for (const p of space.planets) {
    tmp.copy(camera.position).sub(p.group.position);
    const min = p.radius * (p.def.type === T.STAR ? 1.6 : 1.3);
    const d = tmp.length();
    if (d < min) {
      tmp.normalize();
      camera.position.copy(p.group.position).addScaledVector(tmp, min);
      const into = S.vel.dot(tmp);
      if (into < 0) S.vel.addScaledVector(tmp, -into);
    }
  }

  S.hover = f.pointerActive ? space.pick(f.pointer, innerWidth, innerHeight) : null;
  canvas.style.cursor = S.hover && f.source === 'mouse' ? 'pointer' : f.dragging ? 'grabbing' : 'default';
  if (f.select && S.hover) grabPlanet(S.hover);
  $('speed-val').textContent = Math.round(S.vel.length() * 3.2);
}

function updateInspect(dt, f) {
  const p = S.target;
  const camUp = tmp.set(0, 1, 0).applyQuaternion(camera.quaternion).clone();
  const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  let ax = 0, ay = 0;
  if (f.dragging) {
    ax = f.drag.x * 3.2; ay = f.drag.y * 3.2;
    S.spin.x += (ax / Math.max(dt, 1e-3) - S.spin.x) * 0.5;
    S.spin.y += (ay / Math.max(dt, 1e-3) - S.spin.y) * 0.5;
  } else {
    ax = S.spin.x * dt + f.keySteer.x * 1.6 * dt;
    ay = S.spin.y * dt + f.keySteer.y * 1.6 * dt;
    S.spin.x *= Math.exp(-dt * 2.2);
    S.spin.y *= Math.exp(-dt * 2.2);
  }
  if (ax) p.pivot.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(camUp, ax));
  if (ay) p.pivot.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(camRight, ay));

  S.dist *= Math.exp(-f.zoom * 1.6);
  S.dist = THREE.MathUtils.clamp(S.dist, p.radius * (p.def.type === T.STAR ? 1.9 : 1.45), p.radius * 9);
  tmp.copy(p.group.position).addScaledVector(S.orbitDir, S.dist);
  camera.position.lerp(tmp, 1 - Math.exp(-dt * 6));
  camera.lookAt(p.group.position);

  if (f.fly) enterFlight();
  else if (f.back) releasePlanet();
}

function updateFlight(dt, t, f) {
  const handOpen = f.source === 'hand' && f.gesture === 'open';
  const ctl = {
    steerX: THREE.MathUtils.clamp((f.aiming ? f.aim.x : 0) + f.keySteer.x, -1, 1),
    steerY: THREE.MathUtils.clamp((f.aiming ? f.aim.y : 0) + f.keySteer.y, -1, 1),
    boost: f.boost || handOpen || f.thrust > 0.5 && f.source !== 'hand',
    brake: f.brake || f.thrust < 0,
  };
  const r = flight.update(dt, t, ctl);
  $('fh-alt').textContent = Math.max(0, Math.round(r.altitude * 4)).toLocaleString();
  $('fh-spd').textContent = Math.round(r.speed * 6).toLocaleString();
  $('horizon').style.transform = `rotate(${-flight.state.roll}rad)`;
  if (f.back) exitFlight();
}

// ---------- 커서 / 제스처 표시 ----------
function updateCursor(f) {
  const c = $('cursor');
  const show = f.source === 'hand' && f.handCount > 0 && S.mode !== 'intro';
  c.classList.toggle('hidden', !show);
  const chip = $('gesture-chip');
  if (hands.ready) {
    let txt = f.handCount ? GESTURE_TEXT[f.gesture] || '🖐 대기' : '손을 보여주세요';
    if (S.mode === 'flight' && f.gesture === 'open') txt = '✋ 가속';
    chip.textContent = txt;
  } else chip.textContent = '🖱️ 마우스 모드';
  if (!show) return;
  c.style.transform = `translate(${f.pointer.x * innerWidth}px, ${f.pointer.y * innerHeight}px)`;
  c.classList.toggle('hover', !!S.hover && S.mode === 'space');
  c.classList.toggle('pinch', f.gesture === 'pinch');
  let hold = 0, tag = '';
  if (f.hold) {
    const ok = f.hold.kind === 'fly' ? S.mode === 'inspect' : S.mode === 'inspect' || S.mode === 'flight';
    if (ok) { hold = Math.min(1, f.hold.p); tag = f.hold.kind === 'fly' ? '하늘로…' : '돌아가는 중…'; }
  }
  if (!tag && S.hover && S.mode === 'space') tag = f.gesture === 'pinch' ? '' : '🤏 잡기';
  c.querySelector('.prog').style.strokeDashoffset = 163.4 * (1 - hold);
  $('cursor-tag').textContent = tag;
}

// ---------- 시작 / 버튼 ----------
async function enableHands() {
  const note = $('intro-note');
  note.textContent = '카메라와 손 인식 모델을 준비하는 중… (처음엔 몇 초 걸려요)';
  try {
    await hands.start();
    $('cam-wrap').classList.remove('hidden');
    $('btn-hands').classList.add('hidden');
    return true;
  } catch (err) {
    console.warn(err);
    note.textContent = '카메라를 열 수 없어요. 권한을 확인해 주세요.';
    toast('카메라를 열 수 없어요<small>마우스 · 터치 · 키보드로 여행할 수 있어요</small>', 3600);
    return false;
  }
}

function startJourney(withHands) {
  $('intro').classList.add('out');
  setTimeout(() => $('intro').classList.add('hidden'), 800);
  $('hud-top').classList.remove('hidden');
  const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
  S.yaw = e.y; S.pitch = e.x;
  setMode('space');
  toast(withHands ? '✋ 손바닥을 펴서 헤엄쳐 보세요<small>별 근처에서 엄지와 검지를 모으면 잡을 수 있어요</small>' : 'W 키로 헤엄쳐 보세요<small>행성을 클릭하면 가까이 다가가요</small>', 4200);
}

$('btn-start-hands').onclick = async () => {
  $('btn-start-hands').disabled = true;
  const ok = await enableHands();
  startJourney(ok);
};
$('btn-start-mouse').onclick = () => startJourney(false);
$('btn-hands').onclick = async () => { if (await enableHands()) toast('✋ 손 인식 켜짐'); };
$('btn-fly').onclick = () => S.mode === 'inspect' && enterFlight();
$('btn-back').onclick = () => S.mode === 'inspect' && releasePlanet();
$('btn-exit-flight').onclick = () => S.mode === 'flight' && exitFlight();
$('btn-help').onclick = () => $('help').classList.remove('hidden');
$('btn-help-close').onclick = () => $('help').classList.add('hidden');
window.addEventListener('keydown', (e) => { if (e.code === 'KeyH') $('help').classList.toggle('hidden'); });

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  flight.setAspect(innerWidth / innerHeight);
});

// ---------- 루프 ----------
const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  hands.update(performance.now());
  const f = input.frame(dt);
  updateHint(f.source);

  if (S.mode === 'flight' || S.mode === 'fromFlight' && renderPass.scene === flight.scene) {
    updateFlight(dt, t, S.mode === 'flight' ? f : { ...f, back: false });
  } else {
    if (S.mode === 'intro') {
      S.yaw += dt * 0.012;
      camera.rotation.set(S.pitch + Math.sin(t * 0.2) * 0.03, S.yaw, 0, 'YXZ');
      camera.position.z -= dt * 6;
    } else if (S.mode === 'space') updateSpace(dt, f);
    else if (S.mode === 'inspect') updateInspect(dt, f);
    else if (S.mode === 'toFlight') { /* 페이드 중 정지 */ }
    else runTween(dt);

    // 관측 모드에선 행성을 화면 왼쪽으로 비켜서 정보 카드 자리를 만든다
    const want = (S.mode === 'inspect' || S.mode === 'toInspect' || S.mode === 'toFlight') && innerWidth > 760 ? 0.16 : 0;
    S.viewShift += (want - S.viewShift) * (1 - Math.exp(-dt * 3));
    if (S.viewShift > 0.001) camera.setViewOffset(innerWidth, innerHeight, innerWidth * S.viewShift, 0, innerWidth, innerHeight);
    else if (camera.view?.enabled) camera.clearViewOffset();

    space.update(dt, t, camera, innerHeight * renderer.getPixelRatio());
    space.project(camera, innerWidth, innerHeight);
    if (S.mode !== 'space') S.hover = null;
    updateLabels();
  }
  updateCursor(f);
  composer.render();
}

setMode('intro');
loop();
