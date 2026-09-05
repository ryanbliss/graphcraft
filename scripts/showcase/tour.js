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
    time = 0;
  const segments = [
    { start: 0, shot: 0 },
    { start: 2, shot: 1 },
    { start: 4, shot: 2 },
    { start: 5.5, shot: 4 },
    { start: 6.85, shot: 3 },
    { start: 8.5, shot: 5 },
    { start: 10.5, shot: 9 },
    { start: 11.5, shot: 10 },
    { start: 16, shot: 6 },
    { start: 17, shot: 7 },
    { start: 20.5, shot: 8 },
    { start: 22, shot: 11 },
    { start: 26, shot: 12 },
  ];
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
    e.constellation.select(item.id);
    if (e.cameraFlight) e.cameraFlight.duration = 350;
  }
  const endCard = document.createElement("section");
  endCard.style.cssText =
    "position:fixed;inset:0;z-index:200;display:none;align-items:center;justify-content:center;flex-direction:column;backdrop-filter:blur(10px) brightness(.4);color:#e8fff5;text-align:center";
  endCard.innerHTML = `<div class="film-end-brand" style="display:flex;align-items:center;gap:22px;color:#c4ff83;filter:drop-shadow(0 0 12px #84ffb0)">${document.querySelector(".brand svg").outerHTML}<span style="font:600 74px 'Space Grotesk Variable';letter-spacing:-4px">graphcraft</span></div><p style="font:500 25px 'DM Sans Variable';margin:30px 0 15px">Turn your code into a city.</p><div style="font:500 29px 'Space Grotesk Variable';color:#7deaff;text-shadow:0 0 14px #31bdda">graphcraftcity.vercel.app</div><div style="position:absolute;bottom:45px;font:13px/1.65 'DM Sans Variable';color:#d3e3e5">Music: Newer Wave · Kevin MacLeod<br>incompetech.com · CC BY 4.0</div>`;
  const endLogo = endCard.querySelector("svg");
  endLogo.style.width = "78px";
  endLogo.style.height = "78px";
  document.body.append(endCard);
  window.__tour = (t) => {
    time = t;
    e.keys.clear();
    const next = segments.findLast((segment) => t >= segment.start).shot;
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
        walk(core.x + core.width / 2 + 65, core.z + core.depth / 2 + 24);
        c.star =
          e.constellation.skyPickables.find(
            (o) => o.userData.celestialId === "galaxy:.",
          ) || e.constellation.skyPickables[0];
      }
      if (shot === 7) {
        e.setMode("constellation");
        document.querySelector("#inspector").hidden = true;
      }
      if (shot === 8) {
        enter(spaceBuilding.rooms[0]);
        const display = e.layout.positions.get(
          "src/components/projects/wiki/WikiPageEditor.tsx",
        );
        if (display) look(display.x, display.y, display.z);
      }
      if (shot === 9) {
        const ship = e.city.shuttles.get("cli") || e.city.shuttles.get(".");
        c.boardingShip = ship;
        walk(ship.position.x + 9, ship.position.z + 10);
        look(ship.position.x, 2, ship.position.z);
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
      if (shot === 12) {
        e.setMode("survey");
        e.camera.position.set(title.x + 130, 100, title.z + 150);
        e.controls.target.set(title.x, 6, title.z - 120);
        e.controls.autoRotate = true;
        e.controls.autoRotateSpeed = 2.2;
        document
          .querySelectorAll(".masthead,.view-switch,.tools,.crosshair")
          .forEach((el) => (el.style.display = "none"));
        endCard.style.display = "flex";
      }
    }
    if (shot === 12) {
      const age = t - 26;
      const flicker =
        age < 0.1 || (age > 0.22 && age < 0.28) || (age > 0.43 && age < 0.47);
      endCard.querySelector(".film-end-brand").style.opacity = flicker
        ? ".55"
        : "1";
    }
    if (shot === 1) {
      e.keys.add("KeyW");
      look(core.hallX + 20, 3.2, core.z + core.depth / 2 + 4);
    }
    if (shot === 2)
      look(lounge.x, lounge.floorY + 1.4, lounge.z - (t - 4) * 1.3);
    if (shot === 3) e.keys.add("KeyW");
    if (shot === 4)
      look(upper.x, upper.floorY + 1.5, upper.z - (t - 5.5) * 1.2);
    if (shot === 5) {
      e.player.position.y = floor + 2.7;
      e.eyeHeight.reset(floor + 2.7);
      look(title.x - 35 + (t - 8.5) * 45, title.titleHeight * 0.65, title.z);
    }
    if (shot === 9) {
      const p = c.boardingShip.position;
      const progress = Math.min(1, t - 10.5);
      const arc = progress * progress * (3 - 2 * progress);
      const angle = Math.atan2(9, 10) + arc * 0.23;
      e.player.position.x = p.x + Math.sin(angle) * Math.hypot(9, 10);
      e.player.position.z = p.z + Math.cos(angle) * Math.hypot(9, 10);
      look(p.x, 2, p.z);
    }
    if (shot === 6) {
      const p = c.star.position;
      const progress = Math.min(1, t - 16);
      const sweep = 1 - progress * progress * (3 - 2 * progress);
      look(p.x + sweep * 80, p.y - sweep * 28, p.z);
    }
    once("galaxy", 17.25, () => {
      celestial("galaxy:.");
      if (e.cameraFlight) e.cameraFlight.duration = 350;
    });
    once("building", 18.3, () => celestial(spaceBuilding.id));
    once("room", 19.3, () => celestial(spaceBuilding.rooms[0].id));
    once("bailout", 22.45, () =>
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { code: "Space", bubbles: true }),
      ),
    );
    if (shot === 11 && t > 22.5) {
      if (c.glideYaw === undefined) c.glideYaw = 0;
      const progress = t - 22.5;
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
    if (shot === 7 && e.mode !== "constellation")
      throw new Error("Constellation film shot left space mode");
  };
})();
