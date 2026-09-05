import * as THREE from "three";
export function atmosphere(scene: THREE.Scene) {
  scene.background = new THREE.Color("#080f1b");
  scene.add(new THREE.HemisphereLight("#a0cbd9", "#293043", 2.2));
  const key = new THREE.DirectionalLight("#c3e3df", 2.5);
  key.position.set(-70, 160, 80);
  scene.add(key);
  const fill = new THREE.DirectionalLight("#8975d2", 1.8);
  fill.position.set(80, 70, -120);
  scene.add(fill);
  const geometry = new THREE.SphereGeometry(4000, 32, 16);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    uniforms: {},
    vertexShader:
      "varying vec3 vPosition; void main(){vPosition=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader:
      "varying vec3 vPosition; void main(){float h=normalize(vPosition).y; vec3 low=vec3(0.018,0.025,0.048);vec3 high=vec3(0.002,0.006,0.018);gl_FragColor=vec4(mix(low,high,smoothstep(-0.12,0.65,h)),1.0);}",
  });
  const dome = new THREE.Mesh(geometry, material);
  dome.renderOrder = -1;
  dome.frustumCulled = false;
  dome.onBeforeRender = (_renderer, _scene, camera) => {
    dome.position.copy(camera.position);
    dome.updateMatrixWorld();
  };
  scene.add(dome);
}
