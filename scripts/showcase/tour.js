/* global window, document, KeyboardEvent */
(() => {
  const c = window.__capture,
    e = c.engine,
    core = c.core;
  const tower = e.layout.buildings.find((b) => b.id === ".:convex") || core;
  const upper = tower.rooms
    .filter((r) => r.nodeIds.length >= 10)
    .sort((a, b) => b.floorY - a.floorY)[0];
  const floor = upper.floorY;
  const front = tower.z + tower.depth / 2;
  const title =
    e.city.titlePlacements.find((p) => p.packageId === ".") ||
    e.city.titlePlacements[0];
  const lounge =
    c.rooms.find(
      (r) => r.directory === "src/components/projects/universal-search",
    ) || core.rooms[0];
  const spaceBuilding =
    e.layout.buildings.find((b) => b.id === ".:src/components/projects/wiki") ||
    core;
  const done = new Set();
  let shot = -1,
    time = 0,
    pulse = -10;
  const stages = [0, 2, 4, 6, 7.65, 9, 12, 13, 16.5, 18.5, 19.5, 24];
  const cursor = document.createElement("div");
  cursor.innerHTML =
    '<svg width="26" height="32" viewBox="0 0 26 32"><path d="M3 2 L3 25 L9 20 L14 30 L19 27 L14 18 L23 17 Z" fill="white" stroke="#0a2439" stroke-width="2"/></svg>';
  cursor.style.cssText =
    "position:fixed;z-index:150;pointer-events:none;display:none;filter:drop-shadow(0 0 5px #5bdbff)";
  const ring = document.createElement("div");
  ring.style.cssText =
    "position:fixed;z-index:149;pointer-events:none;border:2px solid #73edff;border-radius:50%;display:none";
  document.body.append(cursor, ring);
  let pointer = { x: 640, y: 360 };
  function point(x, y, click = false) {
    pointer = { x, y };
    cursor.style.left = x + "px";
    cursor.style.top = y + "px";
    if (click) pulse = time;
  }
  function once(id, at, fn) {
    if (time >= at && !done.has(id)) {
      done.add(id);
      fn();
    }
  }
  function look(x, y, z) {
    const p = e.player.position;
    e.yaw = Math.atan2(p.x - x, p.z - z);
    e.pitch = Math.atan2(y - p.y, Math.hypot(x - p.x, z - p.z));
  }
  function walk(x, z, y = 0) {
    e.player.teleport(x, z, y);
    e.setMode("walk");
    e.camera.fov = 65;
    e.camera.updateProjectionMatrix();
    e.showRoutes = false;
    e.clearHighlight();
    document.querySelector("#inspector").hidden = true;
  }
  function enter(r) {
    walk(r.door.x + (r.side === "left" ? -0.7 : 0.7), r.door.z, r.floorY);
    look(r.x, r.floorY + 1.4, r.z);
  }
  function celestial(source) {
    const item =
      e.constellation.model.sources.get(source) ||
      e.constellation.model.items.get(source);
    if (!item) throw new Error("Missing celestial source " + source);
    const body = e.constellation.places.get(item.id);
    if (body) {
      const p = body.point.clone();
      p.project(e.camera);
      point((p.x + 1) * 640, (1 - p.y) * 360, true);
    }
    e.constellation.select(item.id);
    if (e.cameraFlight) e.cameraFlight.duration = 350;
  }
  window.__tour = (t) => {
    time = t;
    e.keys.clear();
    const next = stages.findLastIndex((v) => t >= v);
    if (next !== shot) {
      shot = next;
      if (shot === 0) e.controls.autoRotateSpeed = 0.65;
      if (shot === 1) {
        document.querySelector("#demo").click();
        walk(core.hallX - 22, core.z + core.depth / 2 + 14);
        e.yaw = -Math.PI / 2;
        e.pitch = 0.08;
      }
      if (shot === 2) enter(lounge);
      if (shot === 3) {
        walk(tower.x + tower.width / 2 - 2.5, front - 6, floor - 5.4);
        e.yaw = 0;
        e.pitch = -0.12;
      }
      if (shot === 4) enter(upper);
      if (shot === 5) {
        walk(tower.x + 2, tower.z - tower.depth / 2 + 0.35, floor);
        e.camera.fov = 75;
        e.camera.updateProjectionMatrix();
        look(title.x, title.titleHeight * 0.65, title.z);
      }
      if (shot === 6) {
        walk(title.x, title.z + 24);
        c.star =
          e.constellation.skyPickables.find(
            (o) => o.userData.celestialId === "galaxy:.",
          ) || e.constellation.skyPickables[0];
      }
      if (shot === 7) {
        e.setMode("constellation");
        document.querySelector("#inspector").hidden = true;
      }
      if (shot === 8) enter(spaceBuilding.rooms[0]);
      if (shot === 9) {
        const ship = e.city.shuttles.get("cli") || e.city.shuttles.get(".");
        walk(ship.position.x + 9, ship.position.z + 10);
        look(ship.position.x, 2, ship.position.z);
        point(640, 360, true);
      }
      if (shot === 10) {
        const target = e.layout.regions.find(
          (r) => !r.parentId && r.packageId === ".",
        );
        void e.flyTo(target.id, "cli");
        document.querySelector(".travel-arrival").hidden = true;
      }
      if (shot === 11) {
        void e.flyTo(core.id, ".");
        document.querySelector(".travel-arrival").hidden = true;
        e.flight.update(1.9, e.player, e.camera, { x: 0, z: 0 }, e.layout);
      }
    }
    if (shot === 1) {
      e.keys.add("KeyW");
      look(core.hallX + 20, 3.2, core.z + core.depth / 2 + 4);
    }
    if (shot === 2)
      look(lounge.x, lounge.floorY + 1.4, lounge.z - (t - 4) * 1.3);
    if (shot === 3) e.keys.add("KeyW");
    if (shot === 4)
      look(upper.x, upper.floorY + 1.5, upper.z - (t - 7.65) * 1.2);
    if (shot === 5) {
      e.player.position.y = floor + 2.7;
      e.eyeHeight.reset(floor + 2.7);
      look(title.x + (t - 9) * 6, title.titleHeight * 0.65, title.z);
    }
    if (shot === 6) {
      const p = c.star.position;
      look(p.x, p.y, p.z);
      point(640, 360, t > 12.8 && pulse < 12);
    }
    once("galaxy", 13.25, () => {
      celestial("galaxy:.");
      if (e.cameraFlight) e.cameraFlight.duration = 350;
    });
    once("building", 14.3, () => celestial(spaceBuilding.id));
    once("room", 15.3, () => celestial(spaceBuilding.rooms[0].id));
    once("bailout", 24.45, () =>
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { code: "Space", bubbles: true }),
      ),
    );
    if (t > 24.5) {
      if (c.glideYaw === undefined) c.glideYaw = 0;
      const progress = t - 24.5;
      e.yaw = c.glideYaw + Math.sin(progress * 1.05) * 0.55;
      e.pitch = -0.3;
      e.keys.add("KeyW");
    }
    if (shot === 7) {
      for (const r of e.constellation.rendered) {
        const visible = r.item.id === e.constellation.current.id;
        r.button.style.visibility = visible ? "visible" : "hidden";
        r.leader.style.visibility = visible ? "visible" : "hidden";
      }
    }
    cursor.style.display =
      shot === 6 || shot === 7 || shot === 9 ? "block" : "none";
    const age = t - pulse;
    ring.style.display = age >= 0 && age < 0.45 ? "block" : "none";
    const size = 12 + age * 70;
    ring.style.width = size + "px";
    ring.style.height = size + "px";
    ring.style.left = pointer.x - size / 2 + "px";
    ring.style.top = pointer.y - size / 2 + "px";
    ring.style.opacity = String(1 - age / 0.45);
    if (shot === 7 && e.mode !== "constellation")
      throw new Error("Constellation film shot left space mode");
  };
})();
