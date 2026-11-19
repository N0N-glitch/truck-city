/* ============================================================
   TRUCK CITY - game.js  (Fase 1: física, controles, entrar/sair)
   Greyboxing: só formas geométricas.
   Convenção: heading 0 = apontando para a direita (+x), y cresce para baixo.
   ============================================================ */
(function () {
  'use strict';

  const TC = window.TC;

  /* ================= CONFIGURAÇÃO (ajuste aqui) ================= */
  const WORLD = { w: 2000, h: 2000 };

  const TRUCK = {
    // Geometria (pixels) - o centro do caminhão é a origem local
    halfL: 70,            // meio comprimento
    halfW: 27,            // meia largura
    wheelbase: 90,        // distância entre eixos
    rearToCenter: 45,     // eixo traseiro -> centro
    door: { x: 40, y: -27 }, // porta do motorista (lado esquerdo, na cabine)

    // Dinâmica (pixels e segundos)
    maxFwd: 280,          // velocidade máxima à frente
    maxRev: 90,           // velocidade máxima de ré (reduzida)
    accel: 110,           // aceleração (diminui perto da máxima)
    revAccel: 70,         // aceleração na ré
    brake: 380,           // frenagem
    roll: 60,             // atrito de rolamento (sem acelerar)
    drag: 0.2,            // arrasto proporcional à velocidade

    // Direção
    steerLow: 0.62,       // esterço máximo parado/devagar (~35 graus)
    steerHigh: 0.22,      // esterço máximo em velocidade máxima (~12 graus)
    steerRate: 1.9,       // rad/s ao virar o volante
    steerReturn: 2.6,     // rad/s ao soltar o volante

    exitMaxSpeed: 40,     // velocidade máxima para poder sair
    spawn: { x: 700, y: 1000, heading: 0 },
  };

  const PLAYER = { radius: 11, speed: 150, enterDist: 70 };

  const ROADS = [
    { x: 0,    y: 900, w: 2000, h: 200 },
    { x: 900,  y: 0,   w: 200,  h: 2000 },
    { x: 0,    y: 300, w: 2000, h: 160 },
    { x: 1600, y: 0,   w: 160,  h: 2000 },
  ];

  const ZONES = {
    cargo: { x: 1180, y: 1110, w: 300, h: 170, color: 0xffd400, label: 'ZONA DE CARGA' },
    work:  { x: 180,  y: 720,  w: 300, h: 170, color: 0x2f7df6, label: 'ZONA DE OBRA' },
  };

  /* ================= HELPERS ================= */
  const clamp = Phaser.Math.Clamp;
  const lerp = (a, b, t) => a + (b - a) * t;
  const approach = (v, target, step) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target));

  // Converte um ponto local do caminhão para coordenadas do mundo
  function toWorld(t, lx, ly) {
    const cos = Math.cos(t.heading);
    const sin = Math.sin(t.heading);
    return { x: t.cx + lx * cos - ly * sin, y: t.cy + lx * sin + ly * cos };
  }

  /* ================= CENA PRINCIPAL ================= */
  class WorldScene extends Phaser.Scene {
    constructor() {
      super('World');
    }

    create() {
      this.state = 'driving'; // 'driving' | 'foot'
      this.target = null;
      this.stuckTime = 0;
      this.zoneInside = { cargo: false, work: false };
      this.zoneGfx = {};

      this.drawMap();
      this.createTruck();
      this.createPlayer();
      this.createInput();

      const cam = this.cameras.main;
      cam.setBounds(0, 0, WORLD.w, WORLD.h);
      cam.startFollow(this.truckView, true, 0.08, 0.08);
      cam.centerOn(this.truckView.x, this.truckView.y);

      this.scale.on('resize', this.applyZoom, this);
      this.applyZoom();

      TC.ui.setDriving(true);
    }

    applyZoom() {
      const z = clamp(Math.min(this.scale.width, this.scale.height) / 640, 0.7, 1.25);
      this.cameras.main.setZoom(z);
    }

    /* ---------------- MAPA ---------------- */
    drawMap() {
      const W = WORLD.w;
      const H = WORLD.h;

      this.add.rectangle(0, 0, W, H, 0x2f5233).setOrigin(0).setDepth(0);

      const g = this.add.graphics().setDepth(1);

      // grade sutil (ajuda a perceber o movimento)
      g.lineStyle(1, 0xffffff, 0.05);
      for (let x = 0; x <= W; x += 100) g.lineBetween(x, 0, x, H);
      for (let y = 0; y <= H; y += 100) g.lineBetween(0, y, W, y);

      // ruas
      g.fillStyle(0x3b3b42, 1);
      ROADS.forEach((r) => g.fillRect(r.x, r.y, r.w, r.h));

      // faixa central tracejada (pula os cruzamentos)
      g.fillStyle(0xe8d44d, 1);
      const insideOther = (px, py, idx) =>
        ROADS.some((r, j) => j !== idx && px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h);

      ROADS.forEach((r, i) => {
        if (r.w > r.h) {
          const cy = r.y + r.h / 2;
          for (let x = 0; x < W; x += 80) {
            if (!insideOther(x + 20, cy, i)) g.fillRect(x, cy - 2, 40, 4);
          }
        } else {
          const cx = r.x + r.w / 2;
          for (let y = 0; y < H; y += 80) {
            if (!insideOther(cx, y + 20, i)) g.fillRect(cx - 2, y, 4, 40);
          }
        }
      });

      // borda do mundo
      g.lineStyle(8, 0xff5555, 0.8);
      g.strokeRect(4, 4, W - 8, H - 8);

      // zonas
      Object.keys(ZONES).forEach((key) => this.makeZone(key));
    }

    makeZone(key) {
      const z = ZONES[key];
      this.zoneGfx[key] = this.add.graphics().setDepth(2);
      this.drawZone(key, false);
      this.add
        .text(z.x + z.w / 2, z.y + z.h / 2, z.label, {
          fontFamily: 'monospace',
          fontSize: '22px',
          fontStyle: 'bold',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(3);
    }

    drawZone(key, active) {
      const z = ZONES[key];
      const g = this.zoneGfx[key];
      g.clear();
      g.fillStyle(z.color, active ? 0.75 : 0.35);
      g.fillRect(z.x, z.y, z.w, z.h);
      g.lineStyle(4, z.color, 1);
      g.strokeRect(z.x, z.y, z.w, z.h);
    }

    /* ---------------- CAMINHÃO ---------------- */
    createTruck() {
      const T = TRUCK;
      const h = T.spawn.heading;

      this.truck = {
        heading: h,
        speed: 0,
        steer: 0,
        reverseLock: false,
        // O estado físico fica no EIXO TRASEIRO (modelo bicicleta)
        rx: T.spawn.x - Math.cos(h) * T.rearToCenter,
        ry: T.spawn.y - Math.sin(h) * T.rearToCenter,
        // Centro do caminhão (calculado a partir do eixo traseiro)
        cx: T.spawn.x,
        cy: T.spawn.y,
      };

      const c = this.add.container(T.spawn.x, T.spawn.y).setDepth(10);
      const g = this.add.graphics();

      // baú
      g.fillStyle(0xc4cad1, 1);
      g.fillRect(-70, -27, 92, 54);
      g.lineStyle(2, 0x6b7480, 1);
      g.strokeRect(-70, -27, 92, 54);

      // cabine (frente = +x)
      g.fillStyle(0xd64541, 1);
      g.fillRect(24, -25, 46, 50);
      g.lineStyle(2, 0x8f2a27, 1);
      g.strokeRect(24, -25, 46, 50);

      // para-brisa e faróis
      g.fillStyle(0x1b2a3a, 1);
      g.fillRect(52, -20, 12, 40);
      g.fillStyle(0xfff3a0, 1);
      g.fillRect(68, -22, 3, 9);
      g.fillRect(68, 13, 3, 9);

      // marca da porta do motorista (lado esquerdo)
      g.fillStyle(0xffffff, 1);
      g.fillRect(32, -29, 16, 3);

      // rodas traseiras (fixas)
      g.fillStyle(0x0b0b0b, 1);
      g.fillRect(-56, -31, 22, 8);
      g.fillRect(-56, 23, 22, 8);

      // lanternas traseiras (acendem ao frear)
      this.tailL = this.add.rectangle(-69, -19, 3, 10, 0x6b0000);
      this.tailR = this.add.rectangle(-69, 19, 3, 10, 0x6b0000);

      // rodas dianteiras: giram conforme o esterço (feedback visual)
      const fx = T.wheelbase / 2;
      this.wheelFL = this.add.rectangle(fx, -27, 22, 8, 0x0b0b0b).setStrokeStyle(1, 0x8a8a8a);
      this.wheelFR = this.add.rectangle(fx, 27, 22, 8, 0x0b0b0b).setStrokeStyle(1, 0x8a8a8a);

      c.add([g, this.tailL, this.tailR, this.wheelFL, this.wheelFR]);
      this.truckView = c;
    }

    /* ---------------- PERSONAGEM ---------------- */
    createPlayer() {
      const body = this.add.circle(0, 0, PLAYER.radius, 0x2d7ff9).setStrokeStyle(2, 0xffffff);
      const nose = this.add.rectangle(9, 0, 8, 4, 0xffffff);
      this.p = this.add.container(0, 0, [body, nose]).setDepth(20).setVisible(false);

      this.marker = this.add
        .circle(0, 0, 10, 0xffffff, 0.15)
        .setStrokeStyle(2, 0xffffff)
        .setDepth(5)
        .setVisible(false);

      this.hint = this.add
        .text(0, 0, TC.device === 'pc' ? '[E] / [Espaço]  Entrar' : 'Entrar', {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#ffffff',
          backgroundColor: '#000000aa',
          padding: { x: 6, y: 3 },
        })
        .setOrigin(0.5)
        .setDepth(30)
        .setVisible(false);
    }

    /* ---------------- INPUT ---------------- */
    createInput() {
      const K = Phaser.Input.Keyboard.KeyCodes;
      this.keys = this.input.keyboard.addKeys({
        w: K.W, a: K.A, s: K.S, d: K.D,
        up: K.UP, left: K.LEFT, down: K.DOWN, right: K.RIGHT,
        e: K.E, space: K.SPACE,
      });

      if (this.input.mouse) this.input.mouse.disableContextMenu();

      // Clique (PC) ou toque (celular) no mapa: andar até o ponto
      this.input.on('pointerdown', (pointer) => {
        if (this.state !== 'foot') return;
        this.setTarget(pointer.worldX, pointer.worldY);
      });
    }

    setTarget(x, y) {
      const R = PLAYER.radius;
      this.target = { x: clamp(x, R, WORLD.w - R), y: clamp(y, R, WORLD.h - R) };
      this.stuckTime = 0;
      this.marker.setPosition(this.target.x, this.target.y).setVisible(true);
    }

    clearTarget() {
      this.target = null;
      this.stuckTime = 0;
      this.marker.setVisible(false);
    }

    readInput() {
      const k = this.keys;
      const m = TC.input;
      const left = k.a.isDown || k.left.isDown || m.left;
      const right = k.d.isDown || k.right.isDown || m.right;
      const up = k.w.isDown || k.up.isDown || m.up;
      const down = k.s.isDown || k.down.isDown || m.down;

      let action = Phaser.Input.Keyboard.JustDown(k.e) || Phaser.Input.Keyboard.JustDown(k.space);
      if (TC.consumeAction()) action = true;

      return {
        left, right, up, down,                                  // para andar a pé
        throttle: up || m.gas ? 1 : 0,                          // para dirigir
        brake: down || m.brake ? 1 : 0,
        steer: clamp((right ? 1 : 0) - (left ? 1 : 0) + m.wheel, -1, 1),
        action,
      };
    }

    /* ---------------- LOOP PRINCIPAL ---------------- */
    update(time, delta) {
      const dt = Math.min(delta / 1000, 0.05);
      TC.ui.update(dt);

      const inp = this.readInput();

      if (this.state === 'driving') {
        this.updateTruck(dt, inp, false);
      } else {
        // sem motorista: freio de mão e volante volta ao centro
        this.updateTruck(dt, { throttle: 0, brake: 0, steer: 0 }, true);
        this.updatePlayer(dt, inp);
      }

      if (inp.action) {
        if (this.state === 'driving') this.tryExit();
        else this.tryEnter();
      }

      this.syncVisuals();
      this.updateZonesAndHud();
    }

    /* ---------------- FÍSICA DO CAMINHÃO (Ackermann / bicicleta) ---------------- */
    updateTruck(dt, inp, parked) {
      const T = TRUCK;
      const t = this.truck;
      let v = t.speed;

      const gas = inp.throttle > 0;
      const brk = inp.brake > 0;
      if (!brk) t.reverseLock = false;

      if (parked) {
        v = approach(v, 0, T.brake * 0.8 * dt);
      } else if (gas && !brk) {
        if (v < 0) v = Math.min(0, v + T.brake * dt);                 // freia a ré antes de avançar
        else v += T.accel * (1 - 0.6 * (v / T.maxFwd)) * dt;          // aceleração gradual
      } else if (brk && !gas) {
        if (v > 1) {
          v = Math.max(0, v - T.brake * dt);                          // frenagem
          t.reverseLock = true;                                       // evita engatar ré sem querer
        } else if (!t.reverseLock) {
          v -= T.revAccel * dt;                                       // ré
        } else {
          v = approach(v, 0, T.brake * dt);
        }
      } else if (gas && brk) {
        v = approach(v, 0, T.brake * dt);
      } else {
        v = approach(v, 0, (T.roll + Math.abs(v) * T.drag) * dt);     // inércia / atrito
      }

      v = clamp(v, -T.maxRev, T.maxFwd);

      // Esterço: limitado conforme a velocidade e suavizado
      const speedRatio = clamp(Math.abs(v) / T.maxFwd, 0, 1);
      const maxSteer = lerp(T.steerLow, T.steerHigh, speedRatio);
      const targetSteer = inp.steer * maxSteer;
      const rate = (inp.steer !== 0 ? T.steerRate : T.steerReturn) * dt;
      t.steer = approach(t.steer, targetSteer, rate);

      // Rotação SÓ muda com a velocidade (v = 0 -> não gira)
      t.heading += (v / T.wheelbase) * Math.tan(t.steer) * dt;

      // Movimento do eixo traseiro ao longo do heading
      t.rx += Math.cos(t.heading) * v * dt;
      t.ry += Math.sin(t.heading) * v * dt;

      // Centro do caminhão
      let cx = t.rx + Math.cos(t.heading) * T.rearToCenter;
      let cy = t.ry + Math.sin(t.heading) * T.rearToCenter;

      // Limites do mundo
      const M = 80;
      const ccx = clamp(cx, M, WORLD.w - M);
      const ccy = clamp(cy, M, WORLD.h - M);
      if (ccx !== cx || ccy !== cy) {
        v *= 0.6;
        t.rx += ccx - cx;
        t.ry += ccy - cy;
        cx = ccx;
        cy = ccy;
      }

      t.speed = v;
      t.cx = cx;
      t.cy = cy;
      t.brakeLights = brk && v > 1;
    }

    /* ---------------- PERSONAGEM A PÉ ---------------- */
    updatePlayer(dt, inp) {
      const p = this.p;
      const R = PLAYER.radius;
      const ox = p.x;
      const oy = p.y;

      let dx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
      let dy = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
      let step = PLAYER.speed * dt;
      let moving = false;

      if (dx || dy) {
        // teclado/D-pad cancela o "clicar para andar"
        this.clearTarget();
        const len = Math.hypot(dx, dy);
        dx /= len;
        dy /= len;
        moving = true;
      } else if (this.target) {
        const tx = this.target.x - p.x;
        const ty = this.target.y - p.y;
        const dist = Math.hypot(tx, ty);
        if (dist < 4) {
          this.clearTarget();
        } else {
          dx = tx / dist;
          dy = ty / dist;
          step = Math.min(step, dist);
          moving = true;
        }
      }

      if (moving) {
        p.x += dx * step;
        p.y += dy * step;
        p.rotation = Phaser.Math.Angle.RotateTo(p.rotation, Math.atan2(dy, dx), 14 * dt);
      }

      this.pushPlayerOutOfTruck();
      p.x = clamp(p.x, R, WORLD.w - R);
      p.y = clamp(p.y, R, WORLD.h - R);

      // se o alvo está bloqueado (ex.: dentro do caminhão), desiste
      if (this.target) {
        const moved = Math.hypot(p.x - ox, p.y - oy);
        if (moved < step * 0.3) {
          this.stuckTime += dt;
          if (this.stuckTime > 0.35) this.clearTarget();
        } else {
          this.stuckTime = 0;
        }
      }
    }

    // O personagem não atravessa o caminhão (círculo x retângulo girado)
    pushPlayerOutOfTruck() {
      const t = this.truck;
      const p = this.p;
      const R = PLAYER.radius;
      const cos = Math.cos(t.heading);
      const sin = Math.sin(t.heading);

      const rx = p.x - t.cx;
      const ry = p.y - t.cy;
      let lx = rx * cos + ry * sin;
      let ly = -rx * sin + ry * cos;

      const hx = TRUCK.halfL;
      const hy = TRUCK.halfW;
      const qx = clamp(lx, -hx, hx);
      const qy = clamp(ly, -hy, hy);
      const ddx = lx - qx;
      const ddy = ly - qy;
      const dist = Math.hypot(ddx, ddy);
      if (dist >= R) return;

      if (dist > 1e-4) {
        const k = (R - dist) / dist;
        lx += ddx * k;
        ly += ddy * k;
      } else {
        const px = hx - Math.abs(lx);
        const py = hy - Math.abs(ly);
        if (px < py) lx = Math.sign(lx || 1) * (hx + R);
        else ly = Math.sign(ly || 1) * (hy + R);
      }

      p.x = t.cx + lx * cos - ly * sin;
      p.y = t.cy + lx * sin + ly * cos;
    }

    /* ---------------- ENTRAR / SAIR ---------------- */
    doorWorld() {
      return toWorld(this.truck, TRUCK.door.x, TRUCK.door.y);
    }

    nearDoor() {
      const d = this.doorWorld();
      return Phaser.Math.Distance.Between(this.p.x, this.p.y, d.x, d.y) <= PLAYER.enterDist;
    }

    tryExit() {
      const t = this.truck;
      if (Math.abs(t.speed) > TRUCK.exitMaxSpeed) {
        TC.ui.flash('Reduza a velocidade para sair do caminhão.');
        return;
      }
      const R = PLAYER.radius;
      const pos = toWorld(t, TRUCK.door.x, -(TRUCK.halfW + R + 10));
      this.p.setPosition(clamp(pos.x, R, WORLD.w - R), clamp(pos.y, R, WORLD.h - R));
      this.p.rotation = t.heading - Math.PI / 2; // olhando para fora da porta
      this.p.setVisible(true);

      this.state = 'foot';
      this.clearTarget();
      this.cameras.main.startFollow(this.p, true, 0.08, 0.08);
      TC.ui.setDriving(false);
    }

    tryEnter() {
      if (!this.nearDoor()) {
        TC.ui.flash('Chegue perto da porta do caminhão para entrar.');
        return;
      }
      this.state = 'driving';
      this.p.setVisible(false);
      this.hint.setVisible(false);
      this.clearTarget();
      this.cameras.main.startFollow(this.truckView, true, 0.08, 0.08);
      TC.ui.setDriving(true);
    }

    /* ---------------- VISUAL / HUD ---------------- */
    syncVisuals() {
      const t = this.truck;
      this.truckView.setPosition(t.cx, t.cy).setRotation(t.heading);

      // rodas dianteiras mostram para onde está esterçando
      this.wheelFL.rotation = t.steer;
      this.wheelFR.rotation = t.steer;

      const tail = t.brakeLights ? 0xff2a2a : 0x6b0000;
      this.tailL.setFillStyle(tail);
      this.tailR.setFillStyle(tail);
    }

    updateZonesAndHud() {
      const t = this.truck;
      const hx = TRUCK.halfL;
      const hy = TRUCK.halfW;
      const corners = [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]].map((c) => toWorld(t, c[0], c[1]));

      let status = '';
      Object.keys(ZONES).forEach((key) => {
        const z = ZONES[key];
        const inside = corners.every(
          (pt) => pt.x >= z.x && pt.x <= z.x + z.w && pt.y >= z.y && pt.y <= z.y + z.h
        );
        if (inside !== this.zoneInside[key]) {
          this.zoneInside[key] = inside;
          this.drawZone(key, inside);
        }
        if (inside) {
          status = (Math.abs(t.speed) < 5 ? 'ESTACIONADO: ' : 'Na ') + z.label;
        }
      });

      const kmh = Math.round(Math.abs(t.speed) / 4);
      const gear = t.speed < -1 ? 'R' : Math.abs(t.speed) < 1 ? 'N' : 'D';
      const steerDeg = Math.round(Phaser.Math.RadToDeg(t.steer));
      TC.ui.setHud(kmh, gear, steerDeg, status);

      if (this.state === 'driving') {
        TC.ui.setEnterButton('Sair do caminhão', Math.abs(t.speed) <= TRUCK.exitMaxSpeed);
      } else {
        const near = this.nearDoor();
        TC.ui.setEnterButton('Entrar no caminhão', near);
        this.hint.setVisible(near).setPosition(this.p.x, this.p.y - 28);
      }
    }
  }

  /* ================= INICIALIZAÇÃO ================= */
  TC.startGame = function () {
    new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'game-container',
      backgroundColor: '#1d2b20',
      scale: {
        mode: Phaser.Scale.RESIZE,
        width: '100%',
        height: '100%',
      },
      input: { activePointers: 3 },
      scene: [WorldScene],
    });
  };
})();
