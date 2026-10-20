import * as THREE from 'three';

const YAW_RANGE = 0.4;
const PITCH_RANGE = 0.12;
const LERP_FACTOR = 0.06;
const IDLE_TIMEOUT_MS = 2500;
const AUTO_ROTATE_SPEED = 0.002;
const ACCENT_COLOR = 0xe10600;

function isWebGLAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch (e) {
    return false;
  }
}

function buildCar() {
  const car = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x16161a, roughness: 0.4, metalness: 0.6 });
  const accentMat = new THREE.MeshStandardMaterial({
    color: ACCENT_COLOR,
    roughness: 0.3,
    metalness: 0.5,
    emissive: ACCENT_COLOR,
    emissiveIntensity: 0.15,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.45, 1.0), bodyMat);
  body.position.y = 0.35;
  car.add(body);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.4, 0.85), bodyMat);
  cabin.position.set(-0.1, 0.72, 0);
  car.add(cabin);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.95), accentMat);
  nose.position.set(1.25, 0.3, 0);
  car.add(nose);

  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.25, 1.1), accentMat);
  spoiler.position.set(-1.2, 0.65, 0);
  car.add(spoiler);

  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.28, 16);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.8 });
  const wheelPositions = [
    [0.8, 0.1, 0.55], [0.8, 0.1, -0.55],
    [-0.8, 0.1, 0.55], [-0.8, 0.1, -0.55],
  ];
  wheelPositions.forEach(([x, y, z]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, y, z);
    car.add(wheel);
  });

  [body, cabin].forEach((mesh) => {
    const edges = new THREE.EdgesGeometry(mesh.geometry);
    const line = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: ACCENT_COLOR, transparent: true, opacity: 0.5 })
    );
    line.position.copy(mesh.position);
    car.add(line);
  });

  return car;
}

function buildGroundGrid() {
  const grid = new THREE.GridHelper(6, 24, ACCENT_COLOR, 0x2e2e34);
  grid.position.y = -0.05;
  grid.material.transparent = true;
  grid.material.opacity = 0.35;
  return grid;
}

function showFallback(canvasEl, fallbackEl) {
  if (canvasEl) canvasEl.style.display = 'none';
  if (fallbackEl) fallbackEl.style.display = 'block';
}

export function initHeroScene({ canvas, fallback, reduceMotion }) {
  if (!canvas || !isWebGLAvailable()) {
    showFallback(canvas, fallback);
    return;
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) {
    showFallback(canvas, fallback);
    return;
  }

  const container = canvas.parentElement;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(2.6, 1.6, 3.2);
  camera.lookAt(0, 0.3, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(3, 4, 2);
  scene.add(key);

  const rim = new THREE.PointLight(ACCENT_COLOR, 1.4, 10);
  rim.position.set(-2, 1, -2);
  scene.add(rim);

  scene.add(new THREE.AmbientLight(0x404048, 0.8));

  const car = buildCar();
  scene.add(car);
  scene.add(buildGroundGrid());

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  window.addEventListener('resize', resize);
  resize();

  let targetYaw = 0;
  let targetPitch = 0;
  let autoRotateWeight = reduceMotion ? 0 : 1;
  let lastPointerMove = performance.now();
  let isTouch = false;
  let autoAngle = 0;

  function onPointerMove(e) {
    if (isTouch || reduceMotion) return;
    const nx = (e.clientX / window.innerWidth) * 2 - 1;
    const ny = (e.clientY / window.innerHeight) * 2 - 1;
    targetYaw = nx * YAW_RANGE;
    targetPitch = ny * PITCH_RANGE;
    lastPointerMove = performance.now();
  }
  function onTouchStart() {
    isTouch = true;
  }
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('touchstart', onTouchStart, { passive: true });

  let visible = true;
  const observer = new IntersectionObserver(
    (entries) => entries.forEach((entry) => { visible = entry.isIntersecting; }),
    { threshold: 0.05 }
  );
  observer.observe(container);

  let reducedFrameRendered = false;

  function animate() {
    requestAnimationFrame(animate);
    if (!visible) return;

    if (reduceMotion) {
      if (!reducedFrameRendered) {
        car.rotation.y = 0.3;
        renderer.render(scene, camera);
        reducedFrameRendered = true;
      }
      return;
    }

    const idleFor = performance.now() - lastPointerMove;
    const wantsAutoRotate = isTouch || idleFor > IDLE_TIMEOUT_MS;
    autoRotateWeight += ((wantsAutoRotate ? 1 : 0) - autoRotateWeight) * 0.03;
    autoAngle += AUTO_ROTATE_SPEED;

    const blendedYaw = targetYaw * (1 - autoRotateWeight) + autoAngle * autoRotateWeight;
    car.rotation.y += (blendedYaw - car.rotation.y) * LERP_FACTOR;
    car.rotation.x += (targetPitch * (1 - autoRotateWeight) - car.rotation.x) * LERP_FACTOR;

    renderer.render(scene, camera);
  }
  animate();
}
