/* global window, document, MouseEvent, PointerEvent, setTimeout */
(() => {
  const c = window.__capture;
  const e = c.engine;
  const core = c.core;
  const front = core.z + core.depth / 2;
  let shot = -1;
  const done = new Set();
  const caption = document.querySelector("#film-caption");
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const ease = (v) => {
    v = clamp(v);
    return v * v * (3 - 2 * v);
  };
  function once(id, time, t, action) {
    if (t >= time && !done.has(id)) {
      done.add(id);
      action();
    }
  }
  function look(x, y, z) {
    const p = e.player.position,
      dx = x - p.x,
      dz = z - p.z;
    e.yaw = Math.atan2(-dx, -dz);
    e.pitch = Math.atan2(y - p.y, Math.hypot(dx, dz));
  }
  function startWalk(x, z, floor = 0) {
    e.player.teleport(x, z, floor);
    e.setMode("walk");
    e.camera.fov = 65;
    e.camera.updateProjectionMatrix();
    e.showRoutes = false;
    document.querySelector("#inspector").hidden = true;
  }
  function room(packageId, name) {
    return c.rooms.find((r) => r.directory === `${packageId}/src/${name}`);
  }
  function enterRoom(r) {
    startWalk(
      r.door.x + (r.side === "left" ? -0.45 : 0.45),
      r.door.z,
      r.floorY,
    );
    e.clearHighlight();
    e.showRoutes = false;
  }
  function pulse(x, y) {
    let p = document.querySelector("#film-pointer");
    if (!p) {
      p = document.createElement("div");
      p.id = "film-pointer";
      document.body.append(p);
      Object.assign(p.style, {
        position: "fixed",
        width: "24px",
        height: "24px",
        border: "2px solid #d6ff8c",
        borderRadius: "50%",
        zIndex: 100,
        pointerEvents: "none",
        boxShadow: "0 0 16px #aaff99",
      });
    }
    (document.querySelector("dialog[open]") || document.body).append(p);
    p.style.left = `${x - 12}px`;
    p.style.top = `${y - 12}px`;
    p.hidden = false;
    setTimeout(() => (p.hidden = true), 260);
  }
  function click(selector) {
    const b = document.querySelector(selector);
    if (!b) throw new Error(`Shot target not found: ${selector}`);
    const r = b.getBoundingClientRect();
    pulse(r.x + r.width / 2, r.y + r.height / 2);
    b.click();
  }
  const boundaries = [0, 3, 6, 7.4, 8.7, 10, 13, 15, 18, 21, 27];
  const titles = [
    "",
    "Walk your architecture.",
    "Every object is a file.",
    "Every object is a file.",
    "Every object is a file.",
    "Explore every floor.",
    "",
    "Catch a district shuttle.",
    "Your dependencies are up there.",
    "Follow a connection home.",
    "A world inside your workspace.",
  ];
  window.__tour = (t) => {
    let next = boundaries.findLastIndex((v) => t >= v);
    if (next !== shot) {
      shot = next;
      caption.textContent = titles[shot];
      if (shot === 0) {
        e.controls.autoRotateSpeed = 1;
      }
      if (shot === 1) {
        document.querySelector("#demo").click();
        startWalk(core.x - 8, front + 26);
        look(core.x, 2.8, front - 3);
      }
      if (shot === 2) enterRoom(room("packages/runtime", "systems"));
      if (shot === 3) enterRoom(room("packages/runtime", "engine"));
      if (shot === 4) enterRoom(room("packages/ui", "tests"));
      if (shot === 5) {
        startWalk(core.x + core.width / 2 - 3.3, front - 5);
        look(e.player.position.x, 4, front - 16);
      }
      if (shot === 6) {
        startWalk(core.x - core.width / 2 + 0.85, front - 5.35, 5.4);
        e.camera.fov = 45;
        e.camera.updateProjectionMatrix();
        look(-46, 4, front - 5.35);
      }
      if (shot === 7) {
        const d = e.layout.districts.find((d) => d.id === "packages/core");
        c.stop = { x: d.x + 6, z: d.z + d.depth / 2 + 5 };
        startWalk(c.stop.x - 7, c.stop.z + 10);
        look(c.stop.x, 3.4, c.stop.z);
      }
      if (shot === 8) {
        startWalk(0, 15);
        look(0, 2, 0);
      }
      if (shot === 10) {
        document.querySelector("#inspector").hidden = true;
        e.clearHighlight();
      }
    }
    if (shot === 1) {
      e.keys.clear();
      if (e.player.position.z > front + 1) e.keys.add("KeyW");
    } else e.keys.clear();
    if (shot >= 2 && shot <= 4) {
      const r = [
        room("packages/runtime", "systems"),
        room("packages/runtime", "engine"),
        room("packages/ui", "tests"),
      ][shot - 2];
      look(
        r.x + (t - boundaries[shot] - 0.6) * 0.65,
        r.floorY + 1.3,
        r.z - 1.2,
      );
    }
    if (shot === 5) {
      // The production collision solver performs the ascent, including each step.
      e.pitch = 0.13;
      e.yaw = 0;
      if (e.player.position.z > front - 16) e.keys.add("KeyW");
      if (t > 12.8 && e.player.position.y < 7)
        throw new Error("Stair ascent did not reach the top floor");
    }
    if (shot === 6) {
      look(-46, 4, front - 6 + ease((t - 13) / 2) * 1.3);
    }
    once("rocket", 16, t, () => {
      // Real world raycast, then the real destination button.
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
    });
    once("destination", 17.1, t, () =>
      click('.travel-destination[aria-label="Teleport to Ui, packages/ui"]'),
    );
    if (shot === 8) {
      const star = e.constellation.skyPickables[0].position;
      const goal = Math.atan2(
        star.y - e.player.position.y,
        Math.hypot(star.x - e.player.position.x, star.z - e.player.position.z),
      );
      e.yaw = 0;
      e.pitch = 0.3 + (goal - 0.3) * ease((t - 18) / 1.35);
    }
    once("sky", 20.5, t, () => {
      const canvas = e.renderer.domElement;
      pulse(640, 360);
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
    });
    once("package", 22, t, () =>
      click('.celestial-label[aria-label="Explore @harbor/runtime"]'),
    );
    once("room", 23.5, t, () =>
      click('.celestial-label[aria-label="Explore systems"]'),
    );
    once("file", 25, t, () =>
      click('.celestial-label[aria-label="Inspect Physics.ts"]'),
    );
    once("visit", 26.6, t, () => click("#visit"));
    if (shot === 10) {
      const r = room("packages/runtime", "systems");
      look(r.x, 1.15, r.z - 1.2);
      if (t < 27.22) e.keys.add("KeyS");
    }
  };
})();
