import * as THREE from "https://unpkg.com/three@0.163.0/build/three.module.js";

let renderer, scene, camera;
let reticle;
let hitTestSource = null;
let viewerSpace = null;

let xrRefSpace = null;

const hitTestLog = [];

initScene();

document.getElementById("enter-ar").onclick = startAR;
document.getElementById("download-log").onclick = downloadLog;


// ========================
//     INIT SCENE
// ========================
function initScene() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

  renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;

  document.body.appendChild(renderer.domElement);

  // Reticle
  reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.07, 0.1, 32).rotateX(-Math.PI/2),
    new THREE.MeshBasicMaterial({ color: 0x00ff00 })
  );

  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);
}


// ========================
//     START AR SESSION
// ========================
async function startAR() {
  if (!navigator.xr) {
    alert("WebXR не поддерживается.");
    return;
  }

  try {
    const session = await navigator.xr.requestSession("immersive-ar", {
      requiredFeatures: ["hit-test", "local"]
    });

    const gl = renderer.getContext();
    await gl.makeXRCompatible();

    session.updateRenderState({
      baseLayer: new XRWebGLLayer(session, gl)
    });

    renderer.xr.setSession(session);

    // Reference space
    xrRefSpace = await session.requestReferenceSpace("local");

    // Hit-test setup
    viewerSpace = await session.requestReferenceSpace("viewer");
    hitTestSource = await session.requestHitTestSource({ space: viewerSpace });

    // XR render loop
    session.requestAnimationFrame(onXRFrame);

    window.addEventListener("click", placeObject);

  } catch (e) {
    alert("Ошибка запуска AR: " + e);
  }
}


// ========================
//     XR FRAME LOOP
// ========================
function onXRFrame(t, frame) {
  const session = frame.session;
  session.requestAnimationFrame(onXRFrame);

  const pose = frame.getViewerPose(xrRefSpace);

  // Если камера не работает — pose будет NULL
  if (!pose) {
    console.warn("NO CAMERA FEED (pose == null)");
    renderer.render(scene, camera);
    return;
  }

  const hitResults = frame.getHitTestResults(hitTestSource);

  if (hitResults.length > 0) {
    const hit = hitResults[0];
    const poseHit = hit.getPose(xrRefSpace);

    reticle.visible = true;
    reticle.matrix.fromArray(poseHit.transform.matrix);

    const pos = poseHit.transform.position;
    const rot = poseHit.transform.orientation;

    hitTestLog.push({
      time: performance.now(),
      pos: { x: pos.x, y: pos.y, z: pos.z },
      rot: { x: rot.x, y: rot.y, z: rot.z, w: rot.w },
      visible: true
    });
  } else {
    reticle.visible = false;

    hitTestLog.push({
      time: performance.now(),
      pos: null,
      rot: null,
      visible: false
    });
  }

  renderer.render(scene, camera);
}


// ========================
//     PLACE OBJECT
// ========================
function placeObject() {
  if (!reticle.visible) return;

  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshStandardMaterial({ color: 0xff0000 })
  );

  cube.position.setFromMatrixPosition(reticle.matrix);

  const light = new THREE.HemisphereLight(0xffffff, 0x444444);
  scene.add(light);

  scene.add(cube);
}


// ========================
//     DOWNLOAD LOG
// ========================
function downloadLog() {
  const blob = new Blob([JSON.stringify(hitTestLog, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "hit-test-log.json";
  a.click();

  URL.revokeObjectURL(url);
}
