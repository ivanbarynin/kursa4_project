import * as THREE from "https://unpkg.com/three@0.163.0/build/three.module.js";

let scene, camera, renderer;
let reticle, hitTestSource = null, hitTestSourceRequested = false;
let placedObject = null;

// Логи результатов
const hitTestLog = [];

init();
startRendering();

function init() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.01,
    20
  );

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  document.body.appendChild(renderer.domElement);

  reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.08, 0.1, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x00ff00 })
  );
  reticle.visible = false;
  reticle.matrixAutoUpdate = false;
  scene.add(reticle);

  document.getElementById("ar-button").addEventListener("click", startAR);

  // Кнопка для скачивания логов
  document.getElementById("download-log").addEventListener("click", downloadLog);
}

async function startAR() {
  if (!navigator.xr) {
    alert("WebXR не поддерживается.");
    return;
  }

  try {
    const session = await navigator.xr.requestSession("immersive-ar", {
      requiredFeatures: ["hit-test", "local"]
    });

    session.addEventListener("end", () => {
      hitTestSourceRequested = false;
      hitTestSource = null;
    });

    renderer.xr.setSession(session);
  } catch (e) {
    alert("Ошибка запуска AR: " + e);
  }
}

function startRendering() {
  renderer.setAnimationLoop(render);
}

function render(timestamp, frame) {
  if (!frame) return;

  const referenceSpace = renderer.xr.getReferenceSpace();

  if (!hitTestSourceRequested) {
    const session = renderer.xr.getSession();
    if (!session) return;

    session.requestReferenceSpace("viewer").then((viewerSpace) => {
      session.requestHitTestSource({ space: viewerSpace }).then((source) => {
        hitTestSource = source;
      });
    });

    hitTestSourceRequested = true;
  }

  if (hitTestSource) {
    const hitResults = frame.getHitTestResults(hitTestSource);

    if (hitResults.length > 0) {
      const hit = hitResults[0];
      const pose = hit.getPose(referenceSpace);

      reticle.visible = true;
      reticle.matrix.fromArray(pose.transform.matrix);

      // ===== ЛОГИРУЕМ ДАННЫЕ =====
      const pos = pose.transform.position;
      const rot = pose.transform.orientation;

      hitTestLog.push({
        timestamp,
        position: { x: pos.x, y: pos.y, z: pos.z },
        rotation: { x: rot.x, y: rot.y, z: rot.z, w: rot.w },
        browser: navigator.userAgent,
        reticleVisible: true
      });

      // Разовое размещение объекта по тапу
      window.addEventListener("click", placeObjectOnReticle, { once: true });
    } else {
      reticle.visible = false;

      hitTestLog.push({
        timestamp,
        position: null,
        rotation: null,
        browser: navigator.userAgent,
        reticleVisible: false
      });
    }
  }

  renderer.render(scene, camera);
}

function placeObjectOnReticle() {
  if (!reticle.visible) return;

  if (!placedObject) {
    placedObject = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.1),
      new THREE.MeshPhongMaterial({ color: 0xff0000 })
    );

    const light = new THREE.HemisphereLight(0xffffff, 0x444444);
    scene.add(light);

    scene.add(placedObject);
  }

  placedObject.position.setFromMatrixPosition(reticle.matrix);
}

// ========== СКАЧАТЬ ЛОГ ==========
function downloadLog() {
  const blob = new Blob([JSON.stringify(hitTestLog, null, 2)], {
    type: "application/json"
  });

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "hit_test_log.json";
  a.click();

  URL.revokeObjectURL(url);
}
