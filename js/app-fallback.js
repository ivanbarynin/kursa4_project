// app-fallback.js
// fallback: plain camera feed via getUserMedia + Three.js overlay
// exports: startFallback(opts), stopFallback()

import * as THREE from 'three';

let renderer, scene, camera;
let videoEl = null;
let videoTexture = null;
let animationId = null;
let placed = false;
let rotationSpeed = 0.005;

export async function startFallback(opts = {}) {
  // opts.onExit, opts.onMessage
  try {
    // get camera stream
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    opts.onMessage?.('Camera stream obtained');

    // create video element
    videoEl = document.createElement('video');
    videoEl.autoplay = true;
    videoEl.playsInline = true;
    videoEl.muted = true;
    videoEl.srcObject = stream;
    await videoEl.play();

    // three init
    initThree();

    // set video texture as background plane
    videoTexture = new THREE.VideoTexture(videoEl);
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    videoTexture.format = THREE.RGBFormat;

    // large plane behind everything
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.MeshBasicMaterial({ map: videoTexture });
    const plane = new THREE.Mesh(geometry, material);
    plane.position.set(0, 0, -1); // behind
    plane.scale.set(1.777,1,1); // adjust aspect; renderer will handle
    scene.add(plane);

    // add a 3D object in front of camera
    const cube = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.2,0.2), new THREE.MeshStandardMaterial({ color:0xff0000 }));
    cube.position.set(0, -0.2, -0.6);
    scene.add(cube);

    const light = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
    scene.add(light);

    placed = true;

    // simple animation loop
    const loop = () => {
      animationId = requestAnimationFrame(loop);
      if (placed) cube.rotation.y += rotationSpeed;
      renderer.render(scene, camera);
    };
    loop();

    opts.onMessage?.('Fallback started');
    return true;
  } catch (err) {
    console.error('fallback start err', err);
    opts.onMessage?.('Не удалось получить камеру: '+(err?.message||err));
    return false;
  }
}

export async function stopFallback() {
  // stop animation
  if (animationId) cancelAnimationFrame(animationId);
  animationId = null;

  // stop video & tracks
  if (videoEl && videoEl.srcObject) {
    const tracks = videoEl.srcObject.getTracks();
    tracks.forEach(t => t.stop());
    videoEl.srcObject = null;
  }
  videoEl = null;

  // remove renderer
  if (renderer) {
    const container = document.getElementById('canvas-container');
    if (container && renderer.domElement.parentElement === container) container.removeChild(renderer.domElement);
    renderer.dispose();
    renderer = null;
    scene = null;
    camera = null;
  }
}

function initThree() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, window.innerWidth/window.innerHeight, 0.01, 20);
  renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  const container = document.getElementById('canvas-container');
  container.appendChild(renderer.domElement);
}
