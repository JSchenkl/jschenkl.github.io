import * as THREE from 'three';
import { loadCarModel, normalizeModel } from './car-model.js';

const ACCENT_COLOR = 0xe10600;
const CAR_SIZE = 0.4;

// A real donut pivots on the (steered, gripping) front wheels while the
// rear end breaks traction and swings out wide — the front stays close to
// the pivot, the car's heading IS its spin angle (not tangent-to-a-circle),
// and the smoke comes off the rear tires sweeping the widest arc.
const SPIN_SPEED = 0.0027; // rad/ms, base
const FRONT_SETBACK = CAR_SIZE * 0.26; // car-center to front-pivot distance
const TAIL_SETBACK = CAR_SIZE * 0.32; // car-center to rear/smoke-origin distance
const HEADING_CALIBRATION = Math.PI / 2; // aligns the model's nose with the spin direction
const SMOKE_INTERVAL_MS = 90;
const SMOKE_LIFETIME_MS = 1500;

function isWebGLAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch (e) {
    return false;
  }
}

// Irregular puff texture: several overlapping, randomly offset radial
// blobs instead of one perfect circle, so puffs read as turbulent smoke
// rather than flat dots. Pre-rendering a handful of variants (instead of
// redrawing per spawn) keeps this cheap while still giving visual variety.
function buildSmokeTexture() {
  const size = 96;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const mid = size / 2;
  const blobCount = 5 + Math.floor(Math.random() * 3);

  for (let i = 0; i < blobCount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * mid * 0.45;
    const bx = mid + Math.cos(angle) * dist;
    const by = mid + Math.sin(angle) * dist;
    const r = mid * (0.45 + Math.random() * 0.4);
    const warmth = Math.random();
    const rC = 205 + warmth * 20;
    const gC = 200 + warmth * 10;
    const bC = 195 - warmth * 15;
    const gradient = ctx.createRadialGradient(bx, by, 0, bx, by, r);
    gradient.addColorStop(0, `rgba(${rC},${gC},${bC},0.55)`);
    gradient.addColorStop(0.6, `rgba(${rC},${gC},${bC},0.28)`);
    gradient.addColorStop(1, `rgba(${rC},${gC},${bC},0)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fill();
  }

  return new THREE.CanvasTexture(c);
}

function buildSmokeTextures(count = 4) {
  return Array.from({ length: count }, buildSmokeTexture);
}

function createSmokeSystem(scene, textures) {
  const puffs = [];

  function spawn(position) {
    const texture = textures[Math.floor(Math.random() * textures.length)];
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, opacity: 0.6 });
    const sprite = new THREE.Sprite(material);
    sprite.material.rotation = Math.random() * Math.PI * 2;
    sprite.position.copy(position);
    sprite.position.y = 0.01 + Math.random() * 0.01;
    sprite.scale.setScalar(0.035 + Math.random() * 0.015);
    scene.add(sprite);
    puffs.push({
      sprite,
      born: performance.now(),
      baseX: position.x,
      baseZ: position.z,
      driftX: (Math.random() - 0.5) * 0.00004,
      driftZ: (Math.random() - 0.5) * 0.00004,
      spin: (Math.random() - 0.5) * 0.0015,
      startScale: sprite.scale.x,
    });
  }

  function update(now) {
    for (let i = puffs.length - 1; i >= 0; i -= 1) {
      const p = puffs[i];
      const age = now - p.born;
      if (age > SMOKE_LIFETIME_MS) {
        scene.remove(p.sprite);
        p.sprite.material.dispose();
        puffs.splice(i, 1);
        continue;
      }
      const t = age / SMOKE_LIFETIME_MS;
      const ease = 1 - (1 - t) * (1 - t);
      p.sprite.material.opacity = 0.6 * (1 - t);
      p.sprite.scale.setScalar(p.startScale + ease * 0.2);
      p.sprite.position.x = p.baseX + p.driftX * age;
      p.sprite.position.z = p.baseZ + p.driftZ * age;
      p.sprite.position.y = 0.01 + ease * 0.06;
      p.sprite.material.rotation += p.spin;
    }
  }

  function dispose() {
    puffs.forEach((p) => {
      scene.remove(p.sprite);
      p.sprite.material.dispose();
    });
    puffs.length = 0;
  }

  return { spawn, update, dispose };
}

// Decorative mini-scene next to the About text: the car loops around a
// tight circle, sliding at an angle like a donut, with tire-smoke puffs
// spawned behind it. Purely cosmetic — hidden entirely on any failure.
export function initAboutScene({ canvas, panel, onFail }) {
  const fail = () => {
    if (onFail) onFail();
  };

  if (!canvas || !panel || !isWebGLAvailable()) {
    fail();
    return;
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) {
    fail();
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
  camera.position.set(0, 0.95, 1.1);
  camera.lookAt(0, 0.05, 0);

  const key = new THREE.DirectionalLight(0xffffff, 1.15);
  key.position.set(2, 3, 2);
  scene.add(key);
  scene.add(new THREE.AmbientLight(0x4a4a54, 0.95));

  const rim = new THREE.PointLight(ACCENT_COLOR, 1.2, 6);
  rim.position.set(-1.2, 0.8, -1.2);
  scene.add(rim);

  const car = new THREE.Group();
  scene.add(car);

  const smokeTextures = buildSmokeTextures();
  const smoke = createSmokeSystem(scene, smokeTextures);

  function resize() {
    const w = canvas.parentElement.clientWidth;
    const h = canvas.parentElement.clientHeight;
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  window.addEventListener('resize', resize);
  resize();

  let visible = true;
  const observer = new IntersectionObserver(
    (entries) => entries.forEach((entry) => { visible = entry.isIntersecting; }),
    { threshold: 0.05 }
  );
  observer.observe(panel);

  let running = true;
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
  });

  let lastSmokeAt = 0;
  let carReady = false;
  let spinAngle = 0;
  let lastFrameAt = performance.now();

  function animate(now) {
    requestAnimationFrame(animate);
    const dt = now - lastFrameAt;
    lastFrameAt = now;
    if (!visible || !running) return;

    // Uneven spin speed (throttle/steering variation) instead of a
    // constant rate, so it doesn't feel metronomic.
    const speedWobble =
      1 + 0.2 * Math.sin(now * 0.00026) + 0.08 * Math.sin(now * 0.00061 + 2.1);
    spinAngle += dt * SPIN_SPEED * speedWobble;

    // Front-pivot wobble: the grip point isn't perfectly fixed, it walks
    // a little, and its distance from the car's center varies slightly too.
    const pivotX = 0.025 * Math.sin(now * 0.00013 + 0.4);
    const pivotZ = 0.02 * Math.sin(now * 0.00017 + 2.6);
    const frontSetback = FRONT_SETBACK + 0.015 * Math.sin(spinAngle * 3.1 + 1.0);

    // Heading IS the spin angle — the car genuinely rotates, it doesn't
    // orbit nose-first like a satellite. Position trails behind the
    // front pivot along the car's own heading.
    car.rotation.y = spinAngle + HEADING_CALIBRATION;
    const forwardX = Math.sin(spinAngle);
    const forwardZ = Math.cos(spinAngle);
    car.position.x = pivotX - forwardX * frontSetback;
    car.position.z = pivotZ - forwardZ * frontSetback;

    if (carReady && now - lastSmokeAt > SMOKE_INTERVAL_MS) {
      lastSmokeAt = now;
      // Smoke originates further back, at the rear tires, which sweep the
      // widest arc around the front pivot.
      const smokeX = pivotX - forwardX * (frontSetback + TAIL_SETBACK);
      const smokeZ = pivotZ - forwardZ * (frontSetback + TAIL_SETBACK);
      smoke.spawn(new THREE.Vector3(smokeX, 0, smokeZ));
    }
    smoke.update(now);

    renderer.render(scene, camera);
  }
  requestAnimationFrame(animate);

  loadCarModel()
    .then((model) => {
      normalizeModel(model, CAR_SIZE);
      car.add(model);
      carReady = true;
    })
    .catch(fail);
}
