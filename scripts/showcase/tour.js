/* global window, document, MouseEvent, PointerEvent, KeyboardEvent */
(() => {
  const c = window.__capture,
    e = c.engine,
    core = c.core;
  const front = core.z + core.depth / 2;
  const top = (core.stories - 1) * 5.4;
  const windowZ =
    core.z - core.depth / 2 + 7.1 + Math.floor((core.depth - 14) / 4) * 4;
  const done = new Set();
  let shot = -1;
  const rooms = core.rooms;
  const lounge =
    c.rooms.find(
      (r) => r.directory === "src/components/projects/universal-search",
    ) || rooms[1];
  const stages = [0, 2, 4, 5.5, 7, 10, 11.5, 14, 18, 19, 28];
  function once(id, at, t, fn) {
    if (t >= at && !done.has(id)) {
      done.add(id);
      fn();
    }
  }
  function look(x, y, z) {
    const p = e.player.position;
    e.yaw = Math.atan2(p.x - x, p.z - z);
    e.pitch = Math.atan2(y - p.y, Math.hypot(x - p.x, z - p.z));
  }
  function walk(x, z, floor = 0) {
    e.player.teleport(x, z, floor);
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
  function click(selector) {
    const button = document.querySelector(selector);
    if (!button) throw new Error(`Missing film target: ${selector}`);
    button.click();
  }
  function galaxyClick() {
    const canvas = e.renderer.domElement;
    canvas.dispatchEvent(
      new PointerEvent("pointerdown", {
        clientX: 640,
        clientY: 360,
        bubbles: true,
      }),
    );
    canvas.dispatchEvent(
      new MouseEvent("click", { clientX: 640, clientY: 360, bubbles: true }),
    );
  }
  window.__tour = (t) => {
    const next = stages.findLastIndex((v) => t >= v);
    e.keys.clear();
    if (next !== shot) {
      shot = next;
      if (shot === 0) e.controls.autoRotateSpeed = 0.65;
      if (shot === 1) {
        document.querySelector("#demo").click();
        walk(core.x + core.width / 2 + 10, front + 10);
        look(core.x, 4, front - 10);
      }
      if (shot === 2) enter(rooms[0]);
      if (shot === 3) enter(lounge);
      if (shot === 4) {
        walk(core.x + core.width / 2 - 3.3, front - 5, top - 5.4);
        e.yaw = 0;
        e.pitch = -0.12;
      }
      if (shot === 5) {
        walk(core.x - core.width / 2 + 1.5, windowZ, top);
        e.camera.fov = 32;
        e.camera.updateProjectionMatrix();
        look(core.x - 220, top + 1.5, windowZ);
      }
      if (shot === 6) {
        walk(core.hallX, front + 12);
        c.star =
          e.constellation.skyPickables.find(
            (o) => o.userData.celestialId === "galaxy:.",
          ) || e.constellation.skyPickables[0];
      }
      if (shot === 8) {
        enter(rooms[0]);
        const artifact = e.layout.positions.get(rooms[0].nodeIds[0]);
        look(artifact.x, artifact.y, artifact.z);
      }
      if (shot === 9) {
        // Board through the production destination menu. The full eight-second
        // flight, including landing, remains in the edit.
        c.travel.open("transit:.");
        const district = e.layout.regions.find(
          (region) =>
            !region.parentId &&
            region.packageId !== "." &&
            region.packageId !== "~external",
        );
        click(`[data-destination="${district?.id || core.id}"]`);
      }
      if (shot === 10) {
        // Editorial cut to a second ride already airborne; Space still invokes
        // the production bailout handler and physics.
        const towers = e.layout.buildings.filter(
          (building) => building.stories >= 5,
        );
        const destination =
          towers.sort(
            (a, b) => a.x * a.x + a.z * a.z - b.x * b.x - b.z * b.z,
          )[0] || core;
        void e.flyTo(destination.id, ".");
        document.querySelector(".travel-arrival").hidden = true;
        e.flight.update(4.8, e.player, e.camera, { x: 0, z: 0 }, e.layout);
      }
    }
    if (shot === 1) e.keys.add("KeyW");
    if (shot === 2 || shot === 3) {
      const r = shot === 2 ? rooms[0] : lounge;
      look(r.x, r.floorY + 1.4, r.z - (t - stages[shot]) * 1.2);
    }
    if (shot === 4) {
      if (e.player.position.z > front - 16) e.keys.add("KeyW");
      if (t > 9.85 && e.player.position.y < top + 1)
        throw new Error("Recorded stair climb failed to reach top floor");
    }
    if (shot === 5) look(core.x - 220, top + 1.5, windowZ + (t - 10) * 12);
    if (shot === 6) {
      const star = c.star.position;
      look(star.x, star.y, star.z);
      e.pitch *= Math.min(1, 0.35 + (t - 11.5) / 1.7);
    }
    once("sky", 13.65, t, galaxyClick);
    once("hierarchy", 14.7, t, () => {
      // Select the real folder hierarchy; compact this large project's long
      // directory path with a match cut, then show its room and file selection.
      const item = e.constellation.model.sources.get(core.id);
      if (!item) throw new Error("Database constellation missing");
      e.constellation.select(item.id);
    });
    once("room", 15.9, t, () => {
      const item = e.constellation.model.sources.get(rooms[0].id);
      if (item) e.constellation.select(item.id);
    });
    once("file", 16.8, t, () => {
      const item = e.constellation.model.sources.get(rooms[0].nodeIds[0]);
      if (!item) throw new Error("File constellation missing");
      e.constellation.select(item.id);
    });
    once("visit", 17.7, t, () => click("#visit"));
    once("bailout", 28.65, t, () =>
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { code: "Space", bubbles: true }),
      ),
    );
    if (t > 28.7) {
      if (c.glideYaw === undefined) {
        const center = e.layout.buildings.reduce(
          (sum, b) => ({ x: sum.x + b.x, z: sum.z + b.z }),
          { x: 0, z: 0 },
        );
        center.x /= e.layout.buildings.length;
        center.z /= e.layout.buildings.length;
        c.glideYaw = Math.atan2(
          e.player.position.x - center.x,
          e.player.position.z - center.z,
        );
      }
      const progress = t - 28.7;
      e.yaw = c.glideYaw + Math.sin(progress * 1.15) * 0.62;
      e.pitch = -0.3;
      e.keys.add("KeyW");
    }
  };
})();
