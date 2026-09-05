import { AmbientSky } from "./ambient-sky.ts";
import { Pets } from "./pets.ts";
import { Pedestrians } from "./pedestrians.ts";
import { StreetTraffic } from "./street-traffic.ts";
import { CinemaCamera } from "./cinema.ts";
import { installNeonFlicker, updateNeonFlicker } from "./neon-flicker.ts";
import * as THREE from "three";
import "./constellation.css";
import { ConstellationMap } from "./constellation.ts";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { atmosphere } from "./atmosphere.ts";
import { buildCity, animateTraffic, type City } from "./city.ts";
import { layoutWorld, palette, type WorldLayout } from "./layout.ts";
import { SurveyHierarchy } from "./survey.ts";
import { CameraHeight } from "./camera-height.ts";
import { ShuttleFlight } from "./shuttle-flight.ts";
import { PlayerPhysics } from "./physics.ts";
import { disposeGroup, lineGeometry } from "./geometry.ts";
import { furnitureSize } from "./furniture.ts";
import type { ProjectGraph } from "../graph/types.ts";
export type ViewMode = "survey" | "walk" | "constellation";
export type CinemaState = "playing" | "paused" | "off";
export interface EngineHooks {
  select: (id: string) => void;
  hover: (id: string | undefined, x: number, y: number) => void;
  mode: (mode: ViewMode) => void;
  lock: (locked: boolean) => void;
  error: (message: string) => void;
  dismissSelection?: () => boolean;
  cinemaBlocked?: () => boolean;
  cinema?: (state: CinemaState) => void;
}
export class WorldEngine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(50, 1, 0.1, 6500);
  readonly controls: OrbitControls;
  readonly composer: EffectComposer;
  private worldPass: RenderPass;
  private flight: ShuttleFlight;
  private eyeHeight = new CameraHeight();
  private ambientSky?: AmbientSky;
  private cinema?: CinemaCamera;
  private pets?: Pets;
  private pedestrians?: Pedestrians;
  private streetTraffic?: StreetTraffic;
  cinemaEnabled = true;
  private cinemaResumeAt = 0;
  private cinemaRunning = false;
  private cinemaState?: CinemaState;
  private orbiting = false;
  private constellation?: ConstellationMap;
  private sceneVeil = document.createElement("div");
  private crossingScene = false;
  private cameraFlight?: {
    started: number;
    duration: number;
    from: THREE.Vector3;
    to: THREE.Vector3;
    fromTarget: THREE.Vector3;
    toTarget: THREE.Vector3;
  };
  graph!: ProjectGraph;
  layout!: WorldLayout;
  survey!: SurveyHierarchy;
  city!: City;
  player!: PlayerPhysics;
  mode: ViewMode = "survey";
  landing = true;
  showLabels = true;
  showRoutes = true;
  showStars = true;
  private keys = new Set<string>();
  private lastFrame = performance.now();
  private accumulator = 0;
  private elapsed = 0;
  private reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private pointerDown = { x: 0, y: 0 };
  private yaw = 0;
  private pitch = 0;
  private dragLook = false;
  private mouseFallback = false;
  private lastHover = 0;
  private selectedId?: string;
  private selected = new THREE.Group();
  private cleanup = new AbortController();
  private resizeObserver: ResizeObserver;
  private animationId = 0;
  private miniMap: HTMLCanvasElement;
  constructor(
    private container: HTMLElement,
    private hooks: EngineHooks,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      logarithmicDepthBuffer: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.domElement.className = "world-canvas";
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.setAttribute(
      "aria-label",
      "Interactive 3D project city",
    );
    container.append(this.renderer.domElement);
    Object.assign(this.sceneVeil.style, {
      position: "absolute",
      inset: "0",
      background: "#050a16",
      opacity: "0",
      pointerEvents: "none",
      zIndex: "8",
    });
    this.sceneVeil.setAttribute("aria-hidden", "true");
    container.append(this.sceneVeil);
    atmosphere(this.scene);
    this.flight = new ShuttleFlight(this.scene);
    this.scene.add(this.selected);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 2500;
    this.controls.addEventListener("start", () => {
      this.orbiting = true;
      this.pauseCinema();
    });
    this.controls.addEventListener("end", () => {
      this.orbiting = false;
      this.pauseCinema();
      if (this.mode === "constellation" && !this.cameraFlight)
        this.constellation?.followCamera(this.camera, this.controls.target);
    });
    // Canvas antialiasing does not cover the offscreen scene used for bloom.
    const sceneTarget = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      samples: Math.min(4, this.renderer.capabilities.maxSamples),
    });
    this.composer = new EffectComposer(this.renderer, sceneTarget);
    this.worldPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.worldPass);
    this.composer.addPass(
      new UnrealBloomPass(new THREE.Vector2(1, 1), 0.28, 0.45, 1.1),
    );
    this.composer.addPass(new OutputPass());
    this.miniMap = document.createElement("canvas");
    this.miniMap.className = "minimap";
    this.miniMap.width = 240;
    this.miniMap.height = 200;
    this.miniMap.setAttribute("aria-label", "District map");
    container.append(this.miniMap);
    const signal = this.cleanup.signal;
    document.addEventListener("pointerdown", () => this.pauseCinema(), {
      signal,
    });
    document.addEventListener(
      "keydown",
      (event) => {
        this.pauseCinema();
        if ((event.target as HTMLElement).matches("input,textarea")) return;
        if (document.querySelector("dialog[open]")) return;
        if (
          event.code === "Escape" &&
          this.mouseFallback &&
          this.mode === "walk"
        ) {
          this.setMode("survey");
          return;
        }
        if (this.flight.active && event.code === "Space") {
          event.preventDefault();
          if (!event.repeat && this.flight.jump(this.player)) {
            this.yaw = this.camera.rotation.y;
            this.pitch = this.camera.rotation.x;
          }
          return;
        }
        this.keys.add(event.code);
        if (
          this.mode === "walk" &&
          ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
            event.code,
          )
        )
          event.preventDefault();
      },
      { signal },
    );
    document.addEventListener(
      "keyup",
      (event) => this.keys.delete(event.code),
      { signal },
    );
    window.addEventListener("blur", () => this.keys.clear(), { signal });
    document.addEventListener(
      "visibilitychange",
      () => {
        this.keys.clear();
        this.lastFrame = performance.now();
      },
      { signal },
    );
    document.addEventListener(
      "pointerlockchange",
      () => {
        const locked = document.pointerLockElement === this.renderer.domElement;
        this.keys.clear();
        this.hooks.lock(locked);
      },
      { signal },
    );
    document.addEventListener("pointerlockerror", () => this.enableDragLook(), {
      signal,
    });
    document.addEventListener("pointerup", () => (this.dragLook = false), {
      signal,
    });
    this.renderer.domElement.addEventListener(
      "pointerdown",
      (event) => {
        this.pointerDown = { x: event.clientX, y: event.clientY };
        this.dragLook = true;
        this.renderer.domElement.focus();
      },
      { signal },
    );
    this.renderer.domElement.addEventListener(
      "click",
      (event) => {
        if (
          Math.hypot(
            event.clientX - this.pointerDown.x,
            event.clientY - this.pointerDown.y,
          ) > 5
        )
          return;
        if (this.mode === "walk" && this.hooks.dismissSelection?.()) {
          this.captureMouse();
          return;
        }
        if (
          this.mode === "walk" &&
          !document.pointerLockElement &&
          !this.mouseFallback
        ) {
          this.captureMouse();
          return;
        }
        if (this.flight.active) return;
        const id = this.pick(event.clientX, event.clientY);
        if (!id) return;
        if (this.constellation?.model.items.has(id)) {
          if (this.mode !== "constellation") void this.enterSkyGalaxy(id);
          else this.constellation.select(id);
        } else this.selectWorld(id);
      },
      { signal },
    );
    document.addEventListener(
      "mousemove",
      (event) => {
        if (
          document.pointerLockElement === this.renderer.domElement ||
          (this.mode === "walk" &&
            this.dragLook &&
            (this.mouseFallback || this.flight.parachuting))
        ) {
          this.yaw -= event.movementX * 0.002;
          this.pitch = Math.max(
            -1.48,
            Math.min(1.48, this.pitch - event.movementY * 0.002),
          );
        } else {
          const overCanvas = event.target === this.renderer.domElement;
          this.pointer.set(
            overCanvas ? event.clientX : -1,
            overCanvas ? event.clientY : -1,
          );
        }
      },
      { signal },
    );
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.animate();
  }
  load(graph: ProjectGraph) {
    this.flight.cancel();
    this.ambientSky?.dispose();
    if (this.constellation) {
      this.scene.remove(this.constellation.sky);
      this.constellation.dispose();
    }
    if (this.city) {
      this.scene.remove(this.city.group);
      disposeGroup(this.city.group);
    }
    this.pets?.dispose();
    this.pedestrians?.dispose();
    this.streetTraffic?.dispose();
    this.graph = graph;
    this.layout = layoutWorld(graph);
    this.cinema = new CinemaCamera(this.layout);
    this.survey = new SurveyHierarchy(this.layout);
    const extent = Math.max(this.layout.width, this.layout.depth);
    this.controls.maxDistance = Math.max(2500, extent * 2.5);
    this.camera.far = Math.max(6500, extent * 5);
    this.camera.updateProjectionMatrix();
    this.city = buildCity(graph, this.layout);
    this.scene.add(this.city.group);
    this.pets = new Pets(this.layout, this.city.colliders, this.scene);
    this.pedestrians = new Pedestrians(
      this.layout,
      this.scene,
      this.city.colliders,
    );
    this.streetTraffic = new StreetTraffic(this.layout, this.scene);
    this.ambientSky = new AmbientSky(this.scene, this.city.shuttles);
    this.constellation = new ConstellationMap(
      graph,
      this.layout,
      this.container,
      {
        select: this.hooks.select,
        navigate: (point, radius) => {
          if (this.mode !== "constellation") return;
          const target = point
            .clone()
            .add(new THREE.Vector3(0, 0, -radius * 0.08));
          this.cameraFlight = {
            started: performance.now(),
            duration: 1250,
            from: this.camera.position.clone(),
            to: target
              .clone()
              .add(new THREE.Vector3(0, radius * 2.15, radius * 0.48)),
            fromTarget: this.controls.target.clone(),
            toTarget: target,
          };
          this.controls.minDistance = Math.max(0.01, radius * 0.12);
          this.controls.maxDistance = 12000;
          this.controls.enabled = false;
        },
      },
    );
    this.scene.add(this.constellation.sky);
    installNeonFlicker(this.scene);
    this.player = new PlayerPhysics(this.city.colliders);
    this.player.teleport(this.layout.spawn.x, this.layout.spawn.z);
    this.scene.fog = new THREE.FogExp2(
      "#141e2d",
      0.0007 /
        Math.max(1, Math.max(this.layout.width, this.layout.depth) / 500),
    );
    disposeGroup(this.selected);
    this.selectedId = undefined;
    this.setMode("survey");
  }
  private resize() {
    const width = this.container.clientWidth,
      height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
  }
  private enableDragLook() {
    this.mouseFallback = true;
    this.hooks.lock(true);
    this.hooks.error("Drag to look around. Use W A S D to walk.");
  }
  private captureMouse() {
    this.renderer.domElement.focus();
    if (this.mouseFallback) {
      this.hooks.lock(true);
      return;
    }
    try {
      const result = this.renderer.domElement.requestPointerLock();
      result?.catch(() => this.enableDragLook());
    } catch {
      this.enableDragLook();
    }
  }

  enter() {
    this.landing = false;
    this.setMode("survey");
  }
  private async enterSkyGalaxy(id: string) {
    if (this.crossingScene) return;
    this.crossingScene = true;
    this.keys.clear();
    this.dragLook = false;
    this.sceneVeil.style.pointerEvents = "auto";
    try {
      await this.sceneVeil.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 160,
        fill: "forwards",
        easing: "ease-in",
      }).finished;
      this.setMode("constellation", id);
      await this.sceneVeil.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 260,
        fill: "forwards",
        easing: "ease-out",
      }).finished;
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        throw error;
    } finally {
      this.sceneVeil.getAnimations().forEach((animation) => animation.cancel());
      this.sceneVeil.style.pointerEvents = "none";
      this.crossingScene = false;
    }
  }
  private reportCinema(state: CinemaState) {
    if (state === this.cinemaState) return;
    this.cinemaState = state;
    this.hooks.cinema?.(state);
  }
  setCinemaEnabled(enabled: boolean) {
    this.cinemaEnabled = enabled;
    this.pauseCinema();
    if (enabled) this.cinemaResumeAt = performance.now();
  }
  pauseCinema() {
    this.cinemaResumeAt = performance.now() + 20000;
    if (!this.cinemaRunning) return;
    this.cinemaRunning = false;
    this.cinema?.reset();
    this.sceneVeil.style.opacity = "0";
    this.reportCinema("paused");
  }
  setMode(mode: ViewMode, celestialId?: string) {
    if (!this.layout) return;
    this.pauseCinema();
    this.cinemaResumeAt = performance.now() + 2000;
    this.flight.cancel();
    if (mode !== "survey") this.landing = false;
    this.container.classList.toggle("entered", !this.landing);
    const enteringConstellation =
      mode === "constellation" && this.mode !== "constellation";
    this.sceneVeil.getAnimations().forEach((animation) => animation.cancel());
    this.cameraFlight = undefined;
    this.mode = mode;
    this.controls.zoomToCursor = mode === "constellation";
    this.camera.near = mode === "constellation" ? 0.001 : 0.1;
    this.camera.far =
      mode === "constellation"
        ? 30000
        : Math.max(6500, Math.max(this.layout.width, this.layout.depth) * 5);
    this.camera.updateProjectionMatrix();
    this.constellation?.activate(mode === "constellation");
    this.worldPass.scene =
      mode === "constellation" && this.constellation
        ? this.constellation.scene
        : this.scene;
    this.miniMap.hidden = mode === "constellation";
    this.controls.minDistance = 8;
    this.controls.maxDistance = Math.max(
      2500,
      Math.max(this.layout.width, this.layout.depth) * 2.5,
    );
    this.keys.clear();
    this.dragLook = false;
    this.controls.enabled = mode !== "walk";
    if (mode !== "walk" && document.pointerLockElement)
      document.exitPointerLock();
    const size = Math.max(this.layout.width, this.layout.depth);
    if (mode === "walk") {
      this.eyeHeight.reset(this.player.position.y);
      this.camera.position.set(
        this.player.position.x,
        this.player.position.y,
        this.player.position.z,
      );
      this.yaw = 0;
      this.pitch = 0;
      this.captureMouse();
    } else if (mode === "constellation") {
      if (enteringConstellation && this.constellation) {
        const entry = this.constellation.entryView(celestialId);
        this.controls.minDistance = 0.01;
        this.controls.maxDistance = 12000;
        const damping = this.controls.enableDamping;
        this.controls.enableDamping = false;
        this.controls.update();
        this.controls.target.copy(entry.point);
        this.camera.position
          .copy(entry.point)
          .add(new THREE.Vector3(0, entry.span * 2.2, entry.span * 0.5));
        this.controls.update();
        this.controls.enableDamping = damping;
      }
      this.constellation?.open(celestialId, celestialId !== undefined);
    } else {
      this.camera.position.set(size * 0.55, size * 0.46, size * 0.65);
      this.controls.target.set(this.landing ? -size * 0.2 : 0, 0, 0);
    }
    this.controls.autoRotate = this.landing && mode !== "constellation";
    this.controls.autoRotateSpeed = 0.15;
    this.controls.update();
    this.hooks.mode(mode);
    if (mode === "walk" && this.mouseFallback) this.hooks.lock(true);
  }
  async flyTo(id: string, originId?: string): Promise<boolean> {
    const target =
      this.layout.regions.find((region) => region.id === id) ??
      this.layout.buildings.find((building) => building.id === id);
    if (!target) return false;
    const arrival = this.survey.entry(id)?.position;
    if (!arrival) return false;
    const ships = [...this.city.shuttles.entries()];
    const source =
      this.city.shuttles.get(originId ?? "") ??
      ships.sort(
        (a, b) =>
          a[1].position.distanceToSquared(this.camera.position) -
          b[1].position.distanceToSquared(this.camera.position),
      )[0]?.[1];
    if (!source) return false;
    const destination = this.layout.buildings.some(
      (building) => building.id === id,
    )
      ? undefined
      : this.city.shuttles.get(target.packageId);
    const to =
      destination?.position.clone() ??
      new THREE.Vector3(arrival.x, 0, arrival.z + 2);
    if (source.position.distanceTo(to) < 1) {
      this.focus(id, true);
      return true;
    }
    this.setMode("walk");
    this.clearHighlight();
    const clearance = Math.max(
      35,
      ...this.layout.buildings.map((building) => building.height + 28),
    );
    return this.flight.start(source, destination, to, arrival, clearance);
  }
  private selectWorld(id: string) {
    this.pauseCinema();
    if (this.landing) this.enter();
    const target = this.survey.get(id);
    if (this.mode === "survey" && target && !("nodes" in target))
      this.focus(id);
    this.hooks.select(id);
  }
  focus(id: string, walk = false) {
    this.pauseCinema();
    if (this.mode === "constellation" && !walk) {
      this.constellation?.focus(id);
      return;
    }
    const roomBuilding = this.layout.buildings.find((candidate) =>
      candidate.rooms.some((room) => room.id === id),
    );
    const room = roomBuilding?.rooms.find((candidate) => candidate.id === id);
    const nodePosition = this.layout.positions.get(id),
      building = this.layout.buildings.find(
        (b) => b.id === (nodePosition?.buildingId ?? id),
      );
    const target =
      room ??
      building ??
      this.layout.regions.find((region) => region.id === id);
    if (!target) return;
    this.highlight(id);
    if (walk) {
      const entrance = roomBuilding ?? building ?? target;
      const destinationRoom =
        room ??
        building?.rooms.find((candidate) => candidate.nodeIds.includes(id));
      if (destinationRoom && "rooms" in entrance) {
        this.player.teleport(
          destinationRoom.x,
          destinationRoom.door.z,
          destinationRoom.floorY,
        );
      } else {
        const entry = this.survey.entry(entrance.id);
        this.player.teleport(
          entry?.position.x ?? entrance.x,
          entry?.position.z ?? entrance.z + entrance.depth / 2 + 4,
        );
      }
      if (!nodePosition) this.clearHighlight();
      this.setMode("walk");
      if (destinationRoom) {
        this.yaw = destinationRoom.side === "left" ? Math.PI / 2 : -Math.PI / 2;
        if (nodePosition) {
          const dx = nodePosition.x - this.player.position.x;
          const dz = nodePosition.z - this.player.position.z;
          this.yaw = Math.atan2(-dx, -dz);
        }
      }
      return;
    }
    if (this.mode === "walk") return;
    const x = nodePosition?.x ?? target.x;
    const z = nodePosition?.z ?? target.z;
    const y = room?.floorY ?? nodePosition?.floorY ?? 0;
    const frame = this.survey.frame(target.id);
    const distance =
      Math.max(
        target.width / this.camera.aspect,
        target.depth,
        (frame?.height ?? 0) * 2,
        12,
      ) * 1.35;
    const damping = this.controls.enableDamping;
    this.controls.enableDamping = false;
    this.controls.update();
    this.controls.enableDamping = damping;
    this.cameraFlight = {
      started: performance.now(),
      duration: 900,
      from: this.camera.position.clone(),
      fromTarget: this.controls.target.clone(),
      to: new THREE.Vector3(x + distance * 0.4, y + distance, z + distance),
      toTarget: new THREE.Vector3(x, y, z),
    };
    this.controls.enabled = false;
  }
  highlight(id: string) {
    const roomBuilding = this.layout.buildings.find((candidate) =>
      candidate.rooms.some((room) => room.id === id),
    );
    const room = roomBuilding?.rooms.find((candidate) => candidate.id === id);
    this.selectedId =
      this.layout.positions.get(id)?.buildingId ?? roomBuilding?.id ?? id;
    if (this.mode === "constellation") {
      this.constellation?.focus(id);
      return;
    }
    disposeGroup(this.selected);
    if (room) {
      this.selected.add(
        new THREE.Box3Helper(
          new THREE.Box3(
            new THREE.Vector3(
              room.x - room.width / 2,
              room.floorY + 0.1,
              room.z - room.depth / 2,
            ),
            new THREE.Vector3(
              room.x + room.width / 2,
              room.floorY + 4.5,
              room.z + room.depth / 2,
            ),
          ),
          new THREE.Color("#d5ff91"),
        ),
      );
      return;
    }
    const region = this.layout.regions.find((candidate) => candidate.id === id);
    if (region) {
      this.selected.add(
        new THREE.Box3Helper(
          new THREE.Box3(
            new THREE.Vector3(
              region.x - region.width / 2,
              0.2,
              region.z - region.depth / 2,
            ),
            new THREE.Vector3(
              region.x + region.width / 2,
              0.4,
              region.z + region.depth / 2,
            ),
          ),
          new THREE.Color("#d5ff91"),
        ),
      );
      return;
    }
    const building = this.layout.buildings.find((b) => b.id === id);
    const position = this.layout.positions.get(id);
    const bounds = building
      ? new THREE.Box3(
          new THREE.Vector3(
            building.x - building.width / 2 - 0.5,
            0.1,
            building.z - building.depth / 2 - 0.5,
          ),
          new THREE.Vector3(
            building.x + building.width / 2 + 0.5,
            building.height + 0.5,
            building.z + building.depth / 2 + 0.5,
          ),
        )
      : undefined;
    if (position) {
      const size = furnitureSize[position.furniture];
      const cos = Math.abs(Math.cos(position.rotation)),
        sin = Math.abs(Math.sin(position.rotation));
      const halfWidth = (cos * size.width + sin * size.depth) / 2 + 0.08,
        halfDepth = (sin * size.width + cos * size.depth) / 2 + 0.08;
      const base = size.wall ? position.y - size.height / 2 : position.floorY;
      this.selected.add(
        new THREE.Box3Helper(
          new THREE.Box3(
            new THREE.Vector3(
              position.x - halfWidth,
              base + 0.02,
              position.z - halfDepth,
            ),
            new THREE.Vector3(
              position.x + halfWidth,
              base + size.height + 0.08,
              position.z + halfDepth,
            ),
          ),
          new THREE.Color("#d5ff91"),
        ),
      );
    } else if (bounds)
      this.selected.add(
        new THREE.Box3Helper(bounds, new THREE.Color("#d5ff91")),
      );
    const ids = new Set(building?.nodes.map((n) => n.id) ?? [id]);
    const segments: number[] = [];
    for (const edge of this.graph.edges) {
      if (!ids.has(edge.source) && !ids.has(edge.target)) continue;
      const a = this.layout.positions.get(edge.source)!,
        b = this.layout.positions.get(edge.target)!;
      segments.push(a.x, a.y + 0.3, a.z, b.x, b.y + 0.3, b.z);
    }
    const dependencies = lineGeometry(segments, "#d5ff91", 0.75);
    dependencies.userData.dependencies = true;
    dependencies.visible = this.showRoutes;
    this.selected.add(dependencies);
  }
  clearHighlight() {
    this.selectedId = undefined;
    this.constellation?.clearSelection();
    disposeGroup(this.selected);
  }
  reset() {
    if (this.mode === "constellation") {
      this.constellation?.reset();
      return;
    }
    this.player.teleport(this.layout.spawn.x, this.layout.spawn.z);
    this.setMode(this.mode);
  }
  private pick(x: number, y: number): string | undefined {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (
      !document.pointerLockElement &&
      (x < rect.left || y < rect.top || x > rect.right || y > rect.bottom)
    )
      return;
    const point = document.pointerLockElement
      ? new THREE.Vector2(0, 0)
      : new THREE.Vector2(
          ((x - rect.left) / rect.width) * 2 - 1,
          (-(y - rect.top) / rect.height) * 2 + 1,
        );
    this.raycaster.setFromCamera(point, this.camera);
    if (this.mode === "constellation")
      return this.constellation?.pick(this.raycaster);
    const hit = this.raycaster
      .intersectObjects(this.city.pickables.filter((object) => object.visible))
      .find(({ object }) => {
        let ancestor: THREE.Object3D | null = object;
        while (ancestor) {
          if (!ancestor.visible) return false;
          ancestor = ancestor.parent;
        }
        return true;
      });
    if (this.showStars && this.constellation) {
      const far = this.raycaster.far;
      this.raycaster.far = hit?.distance ?? Infinity;
      const galaxy = this.constellation.pick(this.raycaster, true);
      this.raycaster.far = far;
      if (galaxy) return galaxy;
    }
    if (!hit) return;
    let id: unknown;
    if (hit.instanceId !== undefined)
      id = hit.object.userData.ids?.[hit.instanceId];
    else if (hit.faceIndex !== undefined && hit.faceIndex !== null)
      id = hit.object.userData.signIds?.[Math.floor(hit.faceIndex / 2)];
    if (typeof id === "string") return id;
  }
  private drawMinimap() {
    const context = this.miniMap.getContext("2d");
    if (!context) return;
    const { width, depth, buildings } = this.layout;
    const scale = 180 / Math.max(width, depth),
      cx = 120,
      cy = 100;
    context.clearRect(0, 0, 240, 200);
    context.fillStyle = "#101c27";
    context.fillRect(0, 0, 240, 200);
    context.strokeStyle = "#273b46";
    context.lineWidth = 1;
    for (let i = 0; i < 240; i += 20) {
      context.beginPath();
      context.moveTo(i, 0);
      context.lineTo(i, 200);
      context.stroke();
    }
    for (const b of buildings) {
      context.fillStyle = palette[b.kind];
      context.globalAlpha = 0.55;
      context.fillRect(
        cx + (b.x - b.width / 2) * scale,
        cy + (b.z - b.depth / 2) * scale,
        Math.max(2, b.width * scale),
        Math.max(2, b.depth * scale),
      );
    }
    context.globalAlpha = 1;
    const position =
      this.mode === "walk" ? this.player.position : this.controls.target;
    context.fillStyle = "#d6ff8c";
    context.beginPath();
    context.arc(
      cx + position.x * scale,
      cy + position.z * scale,
      3,
      0,
      Math.PI * 2,
    );
    context.fill();
    context.fillStyle = "#8b9caa";
    context.font = "11px monospace";
    context.fillText("N", 117, 16);
  }
  private animate = () => {
    this.animationId = requestAnimationFrame(this.animate);
    const now = performance.now();
    const dt = Math.min((now - this.lastFrame) / 1000, 0.08);
    this.lastFrame = now;
    this.elapsed += dt;
    updateNeonFlicker(this.elapsed, this.reducedMotion.matches);
    if (!this.city) return;
    if (this.flight.active) {
      const x = Number(this.keys.has("KeyD")) - Number(this.keys.has("KeyA"));
      const z = Number(this.keys.has("KeyS")) - Number(this.keys.has("KeyW"));
      const magnitude = Math.hypot(x, z) || 1;
      const heading = this.yaw;
      this.flight.update(
        dt,
        this.player,
        this.camera,
        {
          x: (x * Math.cos(heading) + z * Math.sin(heading)) / magnitude,
          z: (z * Math.cos(heading) - x * Math.sin(heading)) / magnitude,
        },
        this.layout,
        { yaw: this.yaw, pitch: this.pitch },
      );
      this.accumulator = 0;
      if (!this.flight.active) {
        this.eyeHeight.reset(this.player.position.y);
        this.yaw = this.camera.rotation.y;
        this.pitch = 0;
      }
    } else if (this.mode === "walk") {
      this.accumulator += dt;
      let dx = 0,
        dz = 0;
      if (
        (document.pointerLockElement || this.mouseFallback) &&
        !document.querySelector("dialog[open]")
      ) {
        if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) dz--;
        if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) dz++;
        if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) dx--;
        if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) dx++;
      }
      const length = Math.hypot(dx, dz) || 1;
      dx /= length;
      dz /= length;
      const direction = {
        x: dx * Math.cos(this.yaw) + dz * Math.sin(this.yaw),
        z: dz * Math.cos(this.yaw) - dx * Math.sin(this.yaw),
      };
      while (this.accumulator >= 1 / 120) {
        this.player.step(
          1 / 120,
          direction,
          this.keys.has("Space"),
          this.keys.has("ShiftLeft") || this.keys.has("ShiftRight"),
        );
        this.accumulator -= 1 / 120;
      }
      this.camera.position.set(
        this.player.position.x,
        this.eyeHeight.sample(this.player.position.y, this.player.grounded, dt),
        this.player.position.z,
      );
      this.camera.rotation.order = "YXZ";
      this.camera.rotation.set(this.pitch, this.yaw, 0);
    } else {
      const flight = this.cameraFlight;
      if (this.mode === "constellation" && this.constellation) {
        const drift = this.constellation.moveOrbits(flight ? 0 : dt);
        this.camera.position.add(drift);
        this.controls.target.add(drift);
      }
      if (flight) {
        const progress = Math.min(1, (now - flight.started) / flight.duration);
        const ease = progress * progress * (3 - 2 * progress);
        this.camera.position.lerpVectors(flight.from, flight.to, ease);
        this.controls.target.lerpVectors(
          flight.fromTarget,
          flight.toTarget,
          ease,
        );
        if (progress === 1) {
          this.cameraFlight = undefined;
          this.controls.enabled = true;
        }
      }
      const cinemaBlocked =
        this.mode !== "survey" ||
        this.landing ||
        !this.cinemaEnabled ||
        this.reducedMotion.matches ||
        this.orbiting ||
        document.hidden ||
        !!this.cameraFlight ||
        this.hooks.cinemaBlocked?.();
      if (cinemaBlocked) this.pauseCinema();
      if (!cinemaBlocked && now >= this.cinemaResumeAt && this.cinema) {
        if (!this.cinemaRunning) {
          const damping = this.controls.enableDamping;
          this.controls.enableDamping = false;
          this.controls.update();
          this.controls.enableDamping = damping;
        }
        this.cinemaRunning = true;
        this.controls.minDistance = 0.5;
        this.controls.autoRotate = false;
        this.cinema.update(
          dt,
          this.camera,
          this.controls.target,
          this.ambientSky?.flyingShips ?? [],
        );
        this.sceneVeil.style.opacity = String(this.cinema.fadeOpacity);
        this.reportCinema("playing");
      } else {
        this.controls.update();
        this.reportCinema(this.cinemaEnabled ? "paused" : "off");
      }
      this.accumulator = 0;
    }
    this.ambientSky?.update(
      dt,
      this.camera,
      this.mode !== "constellation",
      this.cinemaRunning,
    );
    this.city.routes.visible = this.showRoutes;
    this.city.titles.visible = this.showLabels;
    for (const child of this.selected.children)
      if (child.userData.dependencies) child.visible = this.showRoutes;
    if (this.constellation) this.constellation.sky.visible = this.showStars;
    for (const [id, roof] of this.city.roofs)
      roof.visible = this.mode === "walk" || this.selectedId !== id;
    animateTraffic(this.city, this.elapsed);
    this.pedestrians?.update(dt, this.camera.position);
    this.streetTraffic?.update(
      dt,
      this.pedestrians?.positions,
      this.mode === "walk" && !this.flight.active
        ? this.player.position
        : undefined,
      this.camera,
    );
    this.pets?.update(dt, this.camera.position, {
      position: this.player.position,
      grounded: this.player.grounded,
      active: this.mode === "walk" && !this.flight.active,
    });
    if (this.elapsed - this.lastHover > 0.12) {
      this.lastHover = this.elapsed;
      this.drawMinimap();
      if (!this.landing) {
        const id = this.pick(this.pointer.x, this.pointer.y);
        const celestial =
          this.constellation?.model.items.has(id ?? "") ?? false;
        this.constellation?.hover(
          celestial ? id : undefined,
          this.pointer.x,
          this.pointer.y,
          this.mode !== "constellation",
        );
        this.hooks.hover(
          celestial ? undefined : id,
          this.pointer.x,
          this.pointer.y,
        );
        this.renderer.domElement.style.cursor = id ? "pointer" : "grab";
      }
    }
    this.camera.updateMatrixWorld();
    this.constellation?.update(
      this.camera,
      this.container.clientWidth,
      this.container.clientHeight,
      this.elapsed,
      this.showRoutes,
    );
    this.composer.render();
  };
  dispose() {
    this.flight.dispose();
    this.pets?.dispose();
    this.pedestrians?.dispose();
    this.streetTraffic?.dispose();
    this.ambientSky?.dispose();
    cancelAnimationFrame(this.animationId);
    this.cleanup.abort();
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.sceneVeil.getAnimations().forEach((animation) => animation.cancel());
    this.sceneVeil.remove();
    if (this.constellation) {
      this.scene.remove(this.constellation.sky);
      this.constellation.dispose();
    }
    disposeGroup(this.scene);
    this.composer.dispose();
    this.renderer.dispose();
  }
}
