let scene, camera, renderer;
let hitTestSource = null;
let hitTestSourceRequested = false;

const logEl = document.getElementById("log");
function log(msg) {
    logEl.textContent += msg + "\n";
    logEl.scrollTop = logEl.scrollHeight;
}

document.getElementById("clear-log").onclick = () => {
    logEl.textContent = "";
};

init();
runDiagnostics(renderer);

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;

    document.body.appendChild(renderer.domElement);
}

async function runDiagnostics(renderer) {
    const dWebXR = document.getElementById("diag-webxr");
    const dAR = document.getElementById("diag-ar");
    const dHit = document.getElementById("diag-hit");
    const dCam = document.getElementById("diag-camera");
    const dGL = document.getElementById("diag-gl");

    // WebXR support
    if ("xr" in navigator) dWebXR.textContent = "✓ Supported";
    else dWebXR.textContent = "❌ Not Available";

    // AR session support
    if (navigator.xr) {
        try {
            const supported = await navigator.xr.isSessionSupported("immersive-ar");
            dAR.textContent = supported ? "✓ Supported" : "❌ Not Supported";
        } catch {
            dAR.textContent = "⚠️ Error";
        }
    }

    // Hit test support
    try {
        const temp = await navigator.xr.requestSession("inline", {
            optionalFeatures: ["hit-test"]
        });
        dHit.textContent = "✓ Supported";
        await temp.end();
    } catch {
        dHit.textContent = "❌ Not Available";
    }

    // Camera access check
    try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        dCam.textContent = "✓ OK";
    } catch {
        dCam.textContent = "❌ Blocked";
    }

    // WebGL XR compatible
    try {
        const gl = renderer.getContext();
        await gl.makeXRCompatible();
        dGL.textContent = "✓ Compatible";
    } catch {
        dGL.textContent = "❌ Failed";
    }
}

document.getElementById("start-ar").onclick = startAR;

async function startAR() {
    if (!navigator.xr) {
        alert("WebXR not supported");
        return;
    }

    const session = await navigator.xr.requestSession("immersive-ar", {
        requiredFeatures: ["local", "hit-test"]
    });

    const gl = renderer.getContext();
    await gl.makeXRCompatible();

    session.updateRenderState({
        baseLayer: new XRWebGLLayer(session, gl)
    });

    renderer.xr.setSession(session);

    const referenceSpace = await session.requestReferenceSpace("local");
    const viewerSpace = await session.requestReferenceSpace("viewer");

    hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
    hitTestSourceRequested = true;

    session.requestAnimationFrame(onXRFrame);
}

function onXRFrame(time, frame) {
    const session = frame.session;
    session.requestAnimationFrame(onXRFrame);

    const refSpace = renderer.xr.getReferenceSpace();
    const pose = frame.getViewerPose(refSpace);

    if (pose) {
        const hitTestResults = frame.getHitTestResults(hitTestSource);

        if (hitTestResults.length > 0) {
            const hit = hitTestResults[0];
            const pose = hit.getPose(refSpace);

            log(`Hit: ${pose.transform.position.x.toFixed(3)}, ${pose.transform.position.y.toFixed(3)}, ${pose.transform.position.z.toFixed(3)}`);
        }
    }

    renderer.render(scene, camera);
}
