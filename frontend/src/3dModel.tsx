import * as Three from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const modelUrl = new URL("../assets/naruto.glb", import.meta.url).href;

export function init3DModel() {
  const canvas = document.querySelector<HTMLCanvasElement>("#bg");
  if (!canvas) {
    throw new Error("The 3D model canvas (#bg) was not found.");
  }

  const scene = new Three.Scene();
  const camera = new Three.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
  );
  camera.position.set(0, 0, 20);

  const renderer = new Three.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);

  scene.add(new Three.AmbientLight(0xffffff, 1.5));
  const keyLight = new Three.DirectionalLight(0xffffff, 2);
  keyLight.position.set(5, 10, 10);
  scene.add(keyLight);

  let mixer: Three.AnimationMixer | undefined;
  let animationFrame = 0;
  let disposed = false;
  let previousFrameTime = 0;

  const render = () => {
    animationFrame = requestAnimationFrame(render);
    const frameTime = performance.now() / 1000;
    mixer?.update(previousFrameTime ? frameTime - previousFrameTime : 0);
    previousFrameTime = frameTime;
    renderer.render(scene, camera);
  };
  render();

  const resize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener("resize", resize);

  new GLTFLoader().load(
    modelUrl,
    (gltf) => {
      if (disposed) return;

      const model = gltf.scene;
      const bounds = new Three.Box3().setFromObject(model);
      const center = bounds.getCenter(new Three.Vector3());
      const size = bounds.getSize(new Three.Vector3());
      const largestDimension = Math.max(size.x, size.y, size.z);

      if (largestDimension > 0) {
        const scale = 10 / largestDimension;
        model.scale.setScalar(scale);
        model.position.sub(center.multiplyScalar(scale));
      }

      scene.add(model);
      if (gltf.animations.length > 0) {
        mixer = new Three.AnimationMixer(model);
        gltf.animations.forEach((clip) => mixer?.clipAction(clip).play());
      }
    },
    undefined,
    (error) => {
      console.error("Failed to load the 3D model:", error);
    },
  );

  return () => {
    disposed = true;
    cancelAnimationFrame(animationFrame);
    window.removeEventListener("resize", resize);
    renderer.dispose();
  };
}
