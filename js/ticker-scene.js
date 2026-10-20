import * as THREE from 'three';
import { loadCarModel, normalizeModel } from './car-model.js';

const VIEW_HEIGHT = 1.15;
const CAR_SIZE = 1.6; // longest model dimension, scene units
const SPEED = 0.00055; // world units per ms
const ACCENT_COLOR = 0xe10600;

function isWebGLAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch (e) {
    return false;
  }
}

// Small decorative side-view scene: the car drives across the bottom bar
// on a loop. Purely cosmetic, so on any failure we just hide the bar
// rather than showing a fallback.
export function initTickerScene({ canvas, bar, onFail }) {
  const fail = () => {
    if (onFail) onFail();
    else if (bar) bar.style.display = 'none';
  };

  if (!canvas || !bar || !isWebGLAvailable()) {
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
  let viewWidth = VIEW_HEIGHT * 6;
  const camera = new THREE.OrthographicCamera(
    -viewWidth / 2, viewWidth / 2, VIEW_HEIGHT / 2, -VIEW_HEIGHT / 2, 0.1, 20
  );
  camera.position.set(0, 0.2, 6);
  camera.lookAt(0, 0.2, 0);

  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(2, 3, 4);
  scene.add(key);
  scene.add(new THREE.AmbientLight(0x55555f, 1.1));

  const rim = new THREE.PointLight(ACCENT_COLOR, 1.1, 8);
  rim.position.set(-2, 1, 2);
  scene.add(rim);

  const car = new THREE.Group();
  car.rotation.y = Math.PI / 2;
  scene.add(car);

  let halfRange = viewWidth / 2 + CAR_SIZE;
  car.position.x = -halfRange;

  function resize() {
    const w = canvas.parentElement.clientWidth;
    const h = canvas.parentElement.clientHeight;
    if (w === 0 || h === 0) return;
    viewWidth = VIEW_HEIGHT * (w / h);
    camera.left = -viewWidth / 2;
    camera.right = viewWidth / 2;
    camera.top = VIEW_HEIGHT / 2;
    camera.bottom = -VIEW_HEIGHT / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    halfRange = viewWidth / 2 + CAR_SIZE;
  }
  window.addEventListener('resize', resize);
  resize();

  let running = true;
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
  });

  let lastTime = performance.now();
  function animate(now) {
    requestAnimationFrame(animate);
    const dt = now - lastTime;
    lastTime = now;
    if (!running) return;

    car.position.x += SPEED * dt;
    if (car.position.x > halfRange) {
      car.position.x = -halfRange;
    }

    renderer.render(scene, camera);
  }
  requestAnimationFrame(animate);

  loadCarModel()
    .then((model) => {
      normalizeModel(model, CAR_SIZE);
      car.add(model);
    })
    .catch(fail);
}
