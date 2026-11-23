/* ============================================================
   TRUCK CITY - game.js  (Atualização 4.0)
   Física, Tráfego na BR, Frota em Comboio, Celular Móvel e Easter Egg do Porão.
   ============================================================ */
(function () {
  'use strict';

  const TC = window.TC;
  const CFG = TC.cfg;
  const ART = TC.art;
  const STORE = TC.store;

  const COLLISIONS = { truck: true, player: true };

  const TRUCK = {
    halfL: 70,
    halfW: 27,
    wheelbase: 90,
    rearToCenter: 45,
    door: { x: 40, y: -27 },
    maxFwd: 280,
    maxRev: 90,
    accel: 110,
    revAccel: 70,
    brake: 380,
    roll: 60,
    drag: 0.2,
    steerLow: 0.62,
    steerHigh: 0.22,
    steerRate: 1.9,
    steerReturn: 2.6,
    exitMaxSpeed: 40,
    spawn: { x: 700, y: 1000, heading: 0 },
  };
  const TRUCK_RADIUS = Math.hypot(TRUCK.halfL, TRUCK.halfW);
  const PLAYER = { radius: 11, speed: 150, enterDist: 70 };
  const DWELL_TIME = 2;
  const ZONE_TOL = 10;

  const SEGMENTS = {
    city:     { id: 'city',     name: 'TRUCK CITY',          sub: 'Centro da cidade e Bairro',           ox: 0,    oy: 0, w: CFG.city.w,     h: CFG.city.h,     padX: 0,   padY: 0 },
    br:       { id: 'br',       name: 'BR-116',              sub: 'Rodovia com tráfego e acesso à Cidade', ox: 4000, oy: 0, w: CFG.br.w,       h: CFG.br.h,       padX: 800, padY: 0 },
    district: { id: 'district', name: 'DISTRITO INDUSTRIAL', sub: 'Zona logística e Portos',             ox: 8000, oy: 0, w: CFG.district.w, h: CFG.district.h, padX: 600, padY: 400 },
  };

  const PORTALS = [
    { seg: 'city',     edge: 'S', min: 900,  max: 1100, to: 'br',       arrive: { x: 504,  y: 170,  axis: 'x' }, spread: 50 },
    { seg: 'city',     edge: 'S', min: 1600, max: 1760, to: 'br',       arrive: { x: 504,  y: 170,  axis: 'x' }, spread: 50 },
    { seg: 'br',       edge: 'N', min: 344,  max: 856,  to: 'city',     arrive: { x: 1050, y: 1830, axis: 'x' }, spread: 40 },
    { seg: 'br',       edge: 'S', min: 344,  max: 856,  to: 'district', arrive: { x: 750,  y: 170,  axis: 'x' }, spread: 40 },
    { seg: 'district', edge: 'N', min: 700,  max: 900,  to: 'br',       arrive: { x: 696,  y: 4630, axis: 'x' }, spread: 50 },
  ];

  const ZONES = {
    cargo:     { seg: 'city',     x: 1180,                         y: 1110, w: 300, h: 170, color: 0xffd400, label: 'ZONA DE CARGA' },
    work:      { seg: 'city',     x: 180,                          y: 720,  w: 300, h: 170, color: 0x2f7df6, label: 'ZONA DE OBRA' },
    warehouse: { seg: 'district', x: SEGMENTS.district.ox + 200,   y: 720,  w: 300, h: 170, color: 0xff8a3d, label: 'ARMAZÉM CENTRAL' },
    port:      { seg: 'district', x: SEGMENTS.district.ox + 1000,  y: 720,  w: 300, h: 170, color: 0x1abc9c, label: 'PORTO SECO' },
  };
  const ZONE_KEYS = Object.keys(ZONES);

  const OFFICE = CFG.office;
  const OFFICE_DOOR = { x: 1350, y: 792, r: 72 };
  const OFFICE_EXIT = { x: 1350, y: 812 };
  const BASEMENT_TRIGGER = { x: 1350, y: 640, r: 45 }; // Paredes de trás do escritório

  const ROOM = CFG.room;
  const ROOM_WALK = { x0: ROOM.x + 26, y0: ROOM.y + 100, x1: ROOM.x + ROOM.w - 26, y1: ROOM.y + ROOM.h - 26 };
  const ROOM_SPAWN = { x: ROOM.x + 400, y: ROOM.y + 440 };
  const ROOM_EXIT = { x: ROOM.x + 400, y: ROOM.y + 515, r: 64 };
  const ROOM_PC = { x: ROOM.x + 570, y: ROOM.y + 222, r: 76 };
  const HOMELESS_NPC = { x: ROOM.x + 120, y: ROOM.y + 160, r: 50 }; // Canto escuro do porão

  const TREES = [
    [120, 120], [310, 80], [520, 150], [730, 100], [210, 205],
    [110, 570], [300, 620], [520, 560], [720, 640], [640, 790], [90, 790],
    [1210, 100], [1370, 70], [1500, 160], [1290, 200], [1190, 220],
    [1200, 1400], [1420, 1480], [1280, 1650], [1500, 1780], [1180, 1880], [1380, 1900],
    [150, 1280], [400, 1400], [700, 1320], [260, 1650], [520, 1850], [800, 1600], [100, 1900], [460, 1940],
    [1880, 180], [1920, 640], [1860, 1000], [1900, 1300], [1850, 1700], [1930, 1900],
    [1170, 835], [1530, 835],
  ];

  const clamp = Phaser.Math.Clamp;
  const lerp = (a, b, t) => a + (b - a) * t;
  const approach = (v, target, step) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target));

  function toWorld(t, lx, ly) {
    const cos = Math.cos(t.heading);
    const sin = Math.sin(t.heading);
    return { x: t.cx + lx * cos - ly * sin, y: t.cy + lx * sin + ly * cos };
  }

  function fmtTime(sec) {
    sec = Math.max(0, Math.ceil(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function fmtDist(px) {
    const m = px / 4;
    if (m >= 1000) return (m / 1000).toFixed(1).replace('.', ',') + ' km';
    return Math.max(10, Math.round(m / 10) * 10) + ' m';
  }

  function portalPoint(p) {
    const s = SEGMENTS[p.seg];
    const mid = (p.min + p.max) / 2;
    if (p.edge === 'S') return { x: s.ox + mid, y: s.oy + s.h };
    if (p.edge === 'N') return { x: s.ox + mid, y: s.oy };
    if (p.edge === 'E') return { x: s.ox + s.w, y: s.oy + mid };
    return { x: s.ox, y: s.oy + mid };
  }

  function nextHop(from, to) {
    if (from === to) return null;
    const queue = [[from]];
    const seen = {};
    seen[from] = true;
    while (queue.length) {
      const path = queue.shift();
      const last = path[path.length - 1];
      for (let i = 0; i < PORTALS.length; i++) {
        const p = PORTALS[i];
        if (p.seg !== last || seen[p.to]) continue;
        const np = path.concat(p.to);
        if (p.to === to) return np[1];
        seen[p.to] = true;
        queue.push(np);
      }
    }
    return null;
  }

  class WorldScene extends Phaser.Scene {
    constructor() {
      super('World');
    }

    create() {
      this.seg = SEGMENTS.city;
      this.state = 'driving';
      this.indoor = false;
      this.inBasement = false; // Dentro do porão secreto
      this.uiOpen = false;
      this.busy = false;
      this.teleporting = false;
      this.target = null;
      this.stuckTime = 0;
      this.interaction = null;
      this.zoneInside = {};
      this.zoneGfx = {};
      this.solids = { city: [], br: [], district: [] };
      this.inSolids = [];
      this.portalCooldown = 0;
      this.noticeCooldown = 0;
      this.hitCooldown = 0;
      this.dwell = 0;
      this.paintKey = null;
      this.cargoKey = null;
      this.beaconKey = undefined;

      this.cars = []; // Tráfego de carros na BR

      this.buildTextures();
      this.buildCity();
      this.buildBR();
      this.buildDistrict();
      this.buildIndoor();
      this.createTrucks();
      this.createPlayer();
      this.createBeacon();
      this.createInput();
      this.refreshTruckLook();

      const cam = this.cameras.main;
      this.applyBounds();
      cam.startFollow(this.truckView, true, 0.08, 0.08);
      cam.centerOn(this.truckView.x, this.truckView.y);

      this.scale.on('resize', this.applyZoom, this);
      this.applyZoom();

      this.events.on(Phaser.Scenes.Events.RENDER, this.positionAction, this);

      TC.ui.setDriving(true);
      TC.ui.banner(this.seg.name, this.seg.sub);
    }

    applyBounds() {
      const s = this.seg;
      this.cameras.main.setBounds(s.ox - s.padX, s.oy - s.padY, s.w + 2 * s.padX, s.h + 2 * s.padY);
    }

    applyZoom() {
      const cam = this.cameras.main;
      const w = this.scale.width;
      const h = this.scale.height;
      if (this.indoor || this.inBasement) {
        const z = clamp(Math.min(w / (ROOM.w + 80), h / (ROOM.h + 80)), 0.35, 1.4);
        cam.setZoom(z);
        cam.centerOn(ROOM.x + ROOM.w / 2, ROOM.y + ROOM.h / 2);
      } else {
        cam.setZoom(clamp(Math.min(w, h) / 620, 0.7, 1.2));
      }
    }

    setSegment(seg) {
      this.seg = seg;
      this.applyBounds();
      this.applyZoom();
    }

    makeTexture(key, w, h, drawFn) {
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      drawFn(g);
      g.generateTexture(key, w, h);
      g.destroy();
    }

    buildTextures() {
      this.makeTexture('tex-ground', CFG.city.w, CFG.city.h, ART.drawGround);
      this.makeTexture('tex-office', 390, 320, ART.drawOfficeTexture);
      this.makeTexture('tex-tree', 72, 72, ART.drawTree);
      this.makeTexture('tex-room', ROOM.w, ROOM.h, ART.drawRoom);
      this.makeTexture('tex-grass', 128, 128, ART.drawGrassTile);
      this.makeTexture('tex-asphalt', 128, 128, ART.drawAsphaltTile);
      this.makeTexture('tex-concrete', 128, 128, ART.drawConcreteTile);
      this.makeTexture('tex-hwy', 512, 256, ART.drawHighwayTile);
      this.makeTexture('tex-rail', 16, 128, ART.drawRailTile);
      this.makeTexture('tex-warehouse', 440, 280, ART.drawWarehouse);
    }

    addSolid(list, x, y, w, h) {
      list.push({ x: x, y: y, w: w, h: h, cx: x + w / 2, cy: y + h / 2, r: Math.hypot(w, h) / 2 });
    }

    addSign(x, y, text, bg) {
      return this.add
        .text(x, y, text, {
          fontFamily: 'monospace', fontSize: '15px', fontStyle: 'bold', color: '#ffffff',
          backgroundColor: bg || '#0b6b3a', padding: { x: 8, y: 5 },
        })
        .setOrigin(0.5)
        .setDepth(6);
    }

    buildCity() {
      const sol = this.solids.city;
      this.add.image(0, 0, 'tex-ground').setOrigin(0).setDepth(0);

      this.makeZone('cargo');
      this.makeZone('work');

      // Prédio do escritório
      this.add.image(OFFICE.x - 10, OFFICE.y - 20, 'tex-office').setOrigin(0).setDepth(4);
      this.add
        .text(OFFICE.x + OFFICE.w / 2, OFFICE.y + 80, 'TRUCK CITY', {
          fontFamily: 'monospace', fontSize: '30px', fontStyle: 'bold',
          color: '#e6eef9', stroke: '#2c3a4d', strokeThickness: 4,
        })
        .setOrigin(0.5).setDepth(5).setAlpha(0.92);
      this.add
        .text(OFFICE.x + OFFICE.w / 2, OFFICE.y + 112, 'LOGÍSTICA & OBRAS', {
          fontFamily: 'monospace', fontSize: '13px', color: '#c9d6e8',
        })
        .setOrigin(0.5).setDepth(5).setAlpha(0.9);

      this.addSolid(sol, OFFICE.x, OFFICE.y, OFFICE.w, OFFICE.h);
      CFG.hedges.forEach((h) => this.addSolid(sol, h.x, h.y, h.w, h.h));

      TREES.forEach((p) => {
        this.add.image(p[0], p[1], 'tex-tree').setOrigin(0.5, 0.47).setDepth(12);
        this.addSolid(sol, p[0] - 17, p[1] - 17, 34, 34);
      });

      this.addSign(700, 1760, '▼ BR-116 · DISTRITO INDUSTRIAL');
      this.addSign(1540, 1760, '▼ BR-116');

      // Casinha construída do morador de rua (ao lado do escritório se a missão foi completada!)
      this.updateHomelessHouseVisual();
    }

    updateHomelessHouseVisual() {
      if (STORE.data.storyState === 'completed' && !this.homelessHouseImg) {
        this.homelessHouseImg = this.add.rectangle(OFFICE.x - 120, OFFICE.y + 140, 80, 70, 0x8b5a2b).setStrokeStyle(2, 0x3e2723).setDepth(4);
        this.add.text(OFFICE.x - 120, OFFICE.y + 130, 'Casa do Amigo', { fontSize: '10px', color: '#fff' }).setOrigin(0.5).setDepth(5);
        this.addSolid(this.solids.city, OFFICE.x - 160, OFFICE.y + 100, 80, 70);
      }
    }

    makeZone(key) {
      const z = ZONES[key];
      this.zoneGfx[key] = this.add.graphics().setDepth(2);
      this.drawZone(key, false);
      this.add
        .text(z.x + z.w / 2, z.y + z.h / 2, z.label, {
          fontFamily: 'monospace', fontSize: '22px', fontStyle: 'bold', color: '#ffffff',
          stroke: '#000000', strokeThickness: 4,
        })
        .setOrigin(0.5).setDepth(3);
    }

    drawZone(key, active) {
      const z = ZONES[key];
      const g = this.zoneGfx[key];
      g.clear();
      g.fillStyle(z.color, active ? 0.75 : 0.32);
      g.fillRect(z.x, z.y, z.w, z.h);
      g.lineStyle(4, z.color, 1);
      g.strokeRect(z.x, z.y, z.w, z.h);
    }

    buildBR() {
      const S = SEGMENTS.br;
      const B = CFG.br;
      const sol = this.solids.br;
      const ox = S.ox;
      const oy = S.oy;
      const rnd = ART.mulberry32(99);

      this.add.tileSprite(ox - S.padX, oy, S.w + 2 * S.padX, S.h, 'tex-grass').setOrigin(0).setDepth(0);
      this.add.tileSprite(ox + B.roadX, oy, B.roadW, S.h, 'tex-hwy').setOrigin(0).setDepth(1);

      const railL = ox + B.roadX - 24;
      const railR = ox + B.roadX + B.roadW + 8;
      this.add.tileSprite(railL, oy, 16, S.h, 'tex-rail').setOrigin(0).setDepth(3);
      this.add.tileSprite(railR, oy, 16, S.h, 'tex-rail').setOrigin(0).setDepth(3);
      this.addSolid(sol, railL - 16, oy, 32, S.h);
      this.addSolid(sol, railR, oy, 32, S.h);

      for (let y = 60; y < S.h; y += 90 + rnd() * 60) {
        this.add.image(ox + 20 + rnd() * 240, oy + y, 'tex-tree').setOrigin(0.5, 0.47).setDepth(12);
        this.add.image(ox + 930 + rnd() * 230, oy + y + rnd() * 40, 'tex-tree').setOrigin(0.5, 0.47).setDepth(12);
      }
    }

    buildDistrict() {
      const S = SEGMENTS.district;
      const ox = S.ox;
      const oy = S.oy;
      const sol = this.solids.district;

      this.add.tileSprite(ox - S.padX, oy - S.padY, S.w + 2 * S.padX, S.h + 2 * S.padY, 'tex-grass').setOrigin(0).setDepth(0);
      this.add.tileSprite(ox, oy, S.w, S.h, 'tex-concrete').setOrigin(0).setDepth(0.2);
      this.add.tileSprite(ox + 700, oy, 200, 520, 'tex-asphalt').setOrigin(0).setDepth(1);
      this.add.tileSprite(ox + 80, oy + 500, 1440, 220, 'tex-asphalt').setOrigin(0).setDepth(1);

      this.makeZone('warehouse');
      this.makeZone('port');

      this.add.image(ox + 130, oy + 930, 'tex-warehouse').setOrigin(0).setDepth(4);
      this.addSolid(sol, ox + 130, oy + 930, 432, 272);
    }

    buildIndoor() {
      this.add.image(ROOM.x, ROOM.y, 'tex-room').setOrigin(0).setDepth(1);
      const S = (x, y, w, h) => this.addSolid(this.inSolids, ROOM.x + x, ROOM.y + y, w, h);
      S(40, 100, 190, 56);
      S(250, 100, 44, 50);
      S(298, 100, 44, 50);
      S(370, 104, 28, 36);
      S(460, 100, 220, 100);
      S(90, 330, 200, 110);
      S(540, 420, 170, 70);
    }

    createTrucks() {
      const T = TRUCK;
      const h = T.spawn.heading;

      this.truck = {
        heading: h, speed: 0, steer: 0, reverseLock: false, portalHit: null,
        rx: T.spawn.x - Math.cos(h) * T.rearToCenter,
        ry: T.spawn.y - Math.sin(h) * T.rearToCenter,
        cx: T.spawn.x, cy: T.spawn.y,
        history: [], // Histórico de posições para a frota em comboio
      };

      const c = this.add.container(T.spawn.x, T.spawn.y).setDepth(10);
      const shadow = this.add.rectangle(3, 5, 140, 54, 0x000000, 0.25);
      const g = this.add.graphics();
      g.fillStyle(0xc4cad1, 1);
      g.fillRect(-70, -27, 92, 54);
      g.lineStyle(2, 0x6b7480, 1);
      g.strokeRect(-70, -27, 92, 54);
      g.fillStyle(0x0b0b0b, 1);
      g.fillRect(-56, -31, 22, 8);
      g.fillRect(-56, 23, 22, 8);

      this.cargoG = this.add.graphics();
      this.cabG = this.add.graphics();
      this.tailL = this.add.rectangle(-69, -19, 3, 10, 0x6b0000);
      this.tailR = this.add.rectangle(-69, 19, 3, 10, 0x6b0000);
      const fx = T.wheelbase / 2;
      this.wheelFL = this.add.rectangle(fx, -27, 22, 8, 0x0b0b0b);
      this.wheelFR = this.add.rectangle(fx, 27, 22, 8, 0x0b0b0b);

      c.add([shadow, g, this.cargoG, this.cabG, this.tailL, this.tailR, this.wheelFL, this.wheelFR]);
      this.truckView = c;

      // Caminhões da Frota em Comboio
      this.fleetViews = [];
      for (let i = 0; i < 5; i++) {
        const fc = this.add.container(-1000, -1000).setDepth(9).setVisible(false);
        const fg = this.add.graphics();
        fg.fillStyle(0xa0aab5, 1);
        fg.fillRect(-70, -27, 92, 54);
        fc.add(fg);
        this.fleetViews.push(fc);
      }
    }

    drawCab(hexStr) {
      const g = this.cabG;
      g.clear();
      const base = Phaser.Display.Color.HexStringToColor(hexStr).color;
      g.fillStyle(base, 1);
      g.fillRect(24, -25, 46, 50);
      g.fillStyle(0x1b2a3a, 1);
      g.fillRect(52, -20, 12, 40);
    }

    drawCargo(contractId) {
      const g = this.cargoG;
      g.clear();
      if (!contractId) return;
      const c = STORE.contract(contractId);
      if (!c) return;
      g.fillStyle(0xffffff, 1);
      g.fillRect(-64, -22, 26, 21);
    }

    refreshTruckLook() {
      const col = STORE.data.paint;
      if (this.paintKey !== col) { this.paintKey = col; this.drawCab(col); }
      const m = STORE.data.mission;
      const key = m && m.stage === 'transit' ? m.id : '';
      if (this.cargoKey !== key) { this.cargoKey = key; this.drawCargo(key); }
    }

    createPlayer() {
      const shadow = this.add.ellipse(2, 3, 24, 22, 0x000000, 0.25);
      const body = this.add.circle(0, 0, PLAYER.radius, 0x2d7ff9).setStrokeStyle(2, 0xffffff);
      const nose = this.add.rectangle(9, 0, 8, 4, 0xffffff);
      this.p = this.add.container(0, 0, [shadow, body, nose]).setDepth(20).setVisible(false);

      this.marker = this.add.circle(0, 0, 10, 0xffffff, 0.15).setStrokeStyle(2, 0xffffff).setDepth(5).setVisible(false);
    }

    createBeacon() {
      this.beacon = this.add.rectangle(0, 0, 100, 100, 0xffffff, 0).setStrokeStyle(6, 0xffffff, 1).setDepth(6).setVisible(false);
      this.tweens.add({ targets: this.beacon, alpha: 0.25, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    setBeacon(zoneKey) {
      const k = zoneKey && ZONES[zoneKey].seg === this.seg.id && !this.indoor && !this.inBasement ? zoneKey : null;
      if (this.beaconKey === k) return;
      this.beaconKey = k;
      if (!k) { this.beacon.setVisible(false); return; }
      const z = ZONES[k];
      this.beacon.setPosition(z.x + z.w / 2, z.y + z.h / 2).setSize(z.w + 16, z.h + 16).setVisible(true);
    }

    createInput() {
      const K = Phaser.Input.Keyboard.KeyCodes;
      this.keys = this.input.keyboard.addKeys({
        w: K.W, a: K.A, s: K.S, d: K.D,
        up: K.UP, left: K.LEFT, down: K.DOWN, right: K.RIGHT,
        e: K.E, space: K.SPACE,
      });
      if (this.input.mouse) this.input.mouse.disableContextMenu();

      this.input.on('pointerdown', (pointer) => {
        if ((this.state !== 'foot' && !this.inBasement) || this.busy || this.uiOpen || this.teleporting) return;
        this.setTarget(pointer.worldX, pointer.worldY);
      });
    }

    walkArea() {
      const R = PLAYER.radius;
      if (this.indoor || this.inBasement) {
        return { x0: ROOM_WALK.x0 + R, y0: ROOM_WALK.y0 + R, x1: ROOM_WALK.x1 - R, y1: ROOM_WALK.y1 - R };
      }
      const s = this.seg;
      return { x0: s.ox + R, y0: s.oy + R, x1: s.ox + s.w - R, y1: s.oy + s.h - R };
    }

    setTarget(x, y) {
      const A = this.walkArea();
      this.target = { x: clamp(x, A.x0, A.x1), y: clamp(y, A.y0, A.y1) };
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

      let phone = TC.consumePhone();

      return { left, right, up, down, throttle: up || m.gas ? 1 : 0, brake: down || m.brake ? 1 : 0, steer: clamp((right ? 1 : 0) - (left ? 1 : 0) + m.wheel, -1, 1), action, phone };
    }

    update(time, delta) {
      const dt = Math.min(delta / 1000, 0.05);
      TC.ui.update(dt);

      if (this.portalCooldown > 0) this.portalCooldown -= dt;
      if (this.noticeCooldown > 0) this.noticeCooldown -= dt;
      if (this.hitCooldown > 0) this.hitCooldown -= dt;

      const frozen = this.uiOpen || this.busy || this.teleporting;
      let inp = this.readInput();
      if (frozen) inp = { left: 0, right: 0, up: 0, down: 0, throttle: 0, brake: 0, steer: 0, action: false, phone: false };

      this.interaction = frozen ? null : this.computeInteraction();

      if (this.teleporting) { this.positionAction(); return; }

      if (this.state === 'driving') {
        this.updateTruck(dt, inp, false);
      } else {
        this.updateTruck(dt, { throttle: 0, brake: 0, steer: 0 }, true);
        if (!frozen) this.updatePlayer(dt, inp);
      }

      if (inp.action) this.handleAction();
      if (inp.phone && STORE.data.upgrades.mobile > 0) this.openComputer();

      // Botão do celular móvel visível apenas fora do caminhão
      TC.ui.setMobilePhoneVisible(this.state === 'foot' && STORE.data.upgrades.mobile > 0 && !this.uiOpen);

      if (!frozen && !this.indoor && !this.inBasement) {
        this.updateMission(dt);
        this.updateTraffic(dt);
      }

      this.checkPortal();
      this.refreshTruckLook();
      this.syncVisuals();
      this.updateZonesAndHud();
      this.updateObjectiveUi();
    }

    updateTruck(dt, inp, parked) {
      const T = TRUCK;
      const t = this.truck;
      const M = STORE.mods();
      const maxFwd = T.maxFwd * M.maxFwd;
      const accel = T.accel * M.accel;
      const brakeF = T.brake * M.brake;
      let v = t.speed;

      const gas = inp.throttle > 0;
      const brk = inp.brake > 0;
      if (!brk) t.reverseLock = false;

      if (parked) v = approach(v, 0, brakeF * 0.8 * dt);
      else if (gas && !brk) {
        if (v < 0) v = Math.min(0, v + brakeF * dt);
        else v += accel * (1 - 0.6 * (v / maxFwd)) * dt;
      } else if (brk && !gas) {
        if (v > 1) { v = Math.max(0, v - brakeF * dt); t.reverseLock = true; }
        else if (!t.reverseLock) v -= T.revAccel * dt;
        else v = approach(v, 0, brakeF * dt);
      } else v = approach(v, 0, (T.roll + Math.abs(v) * T.drag) * dt);

      v = clamp(v, -T.maxRev, maxFwd);

      const speedRatio = clamp(Math.abs(v) / maxFwd, 0, 1);
      const maxSteer = lerp(T.steerLow, T.steerHigh * M.steerHigh, speedRatio);
      const targetSteer = inp.steer * maxSteer;
      const rate = (inp.steer !== 0 ? T.steerRate * M.steerRate : T.steerReturn) * dt;
      t.steer = approach(t.steer, targetSteer, rate);

      const prev = { rx: t.rx, ry: t.ry, heading: t.heading };
      t.heading += (v / T.wheelbase) * Math.tan(t.steer) * dt;
      t.rx += Math.cos(t.heading) * v * dt;
      t.ry += Math.sin(t.heading) * v * dt;

      let cx = t.rx + Math.cos(t.heading) * T.rearToCenter;
      let cy = t.ry + Math.sin(t.heading) * T.rearToCenter;

      if (COLLISIONS.truck && Math.abs(v) > 0.01 && this.truckHitsSolid(cx, cy, t.heading)) {
        t.rx = prev.rx; t.ry = prev.ry; t.heading = prev.heading;
        cx = t.rx + Math.cos(t.heading) * T.rearToCenter;
        cy = t.ry + Math.sin(t.heading) * T.rearToCenter;
        v = -v * 0.2;
        this.applyDamage(10);
      }

      t.speed = v; t.cx = cx; t.cy = cy; t.brakeLights = brk && v > 1;

      // Salva histórico para comboio da frota
      if (Math.hypot(cx - (t.history[0]?.cx || 0), cy - (t.history[0]?.cy || 0)) > 20) {
        t.history.unshift({ cx, cy, heading: t.heading });
        if (t.history.length > 100) t.history.pop();
      }
    }

    truckHitsSolid(cx, cy, heading) {
      const hx = TRUCK.halfL; const hy = TRUCK.halfW;
      const cos = Math.cos(heading); const sin = Math.sin(heading);
      const list = this.solids[this.seg.id];
      for (let i = 0; i < list.length; i++) {
        const s = list[i];
        const dx = s.cx - cx; const dy = s.cy - cy;
        if (Math.hypot(dx, dy) > TRUCK_RADIUS + s.r) continue;
        return true;
      }
      return false;
    }

    applyDamage(dmg) {
      STORE.damage(dmg);
      this.cameras.main.shake(140, 0.004);
      if (this.hitCooldown <= 0) {
        this.hitCooldown = 1.2;
        TC.ui.flash('Colisão! Condição: ' + Math.round(STORE.data.condition) + '%', 1800);
      }
    }

    // Gerenciamento de Tráfego de Carros na BR
    updateTraffic(dt) {
      if (this.seg.id !== 'br') {
        this.cars.forEach(c => c.sprite.setVisible(false));
        return;
      }
      if (this.cars.length === 0) {
        // Cria carros NPC na rodovia
        for (let i = 0; i < 4; i++) {
          const g = this.add.rectangle(0, 0, 50, 24, 0xd9534f).setDepth(8);
          this.cars.push({ sprite: g, y: i * 1200 + 500, speed: 220 + Math.random() * 80 });
        }
      }
      this.cars.forEach(car => {
        car.y -= car.speed * dt;
        if (car.y < this.seg.oy) car.y = this.seg.oy + this.seg.h;
        const carX = this.seg.ox + 460; // Pista da BR
        car.sprite.setPosition(carX, car.y).setVisible(true);

        // Colisão com o caminhão
        if (this.state === 'driving' && Math.hypot(this.truck.cx - carX, this.truck.cy - car.y) < 60) {
          this.applyDamage(15);
          car.y -= 200;
        }
      });
    }

    portalAt(cx, cy) {
      const seg = this.seg; const MG = 80;
      const lx = cx - seg.ox; const ly = cy - seg.oy;
      for (let i = 0; i < PORTALS.length; i++) {
        const p = PORTALS[i];
        if (p.seg !== seg.id) continue;
        let hit = false; let lat = 0;
        if (p.edge === 'S') { hit = ly >= seg.h - MG; lat = lx; }
        else if (p.edge === 'N') { hit = ly <= MG; lat = lx; }
        if (hit && lat >= p.min && lat <= p.max) return p;
      }
      return null;
    }

    checkPortal() {
      const t = this.truck;
      if (this.state !== 'driving' || this.teleporting || this.indoor || this.portalCooldown > 0 || !t.portalHit) return;
      this.startTeleport(t.portalHit);
    }

    startTeleport(p) {
      this.teleporting = true; this.clearTarget(); TC.ui.resetInputs();
      const cam = this.cameras.main; cam.fadeOut(200, 0, 0, 0);
      this.time.delayedCall(230, () => {
        const t = this.truck; const from = this.seg; const to = SEGMENTS[p.to];
        const lat = t.cx - from.ox;
        let nx = to.ox + p.arrive.x + clamp(lat - 1000, -50, 50);
        let ny = to.oy + p.arrive.y;
        t.cx = nx; t.cy = ny; t.portalHit = null;
        this.setSegment(to); this.syncVisuals();
        cam.stopFollow(); cam.centerOn(nx, ny); cam.startFollow(this.truckView, true, 0.08, 0.08);
        cam.fadeIn(240, 0, 0, 0);
        this.portalCooldown = 1.5; this.teleporting = false;
        TC.ui.banner(to.name, to.sub);
      });
    }

    truckCorners() {
      const hx = TRUCK.halfL; const hy = TRUCK.halfW;
      return [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]].map((c) => toWorld(this.truck, c[0], c[1]));
    }

    zoneContains(corners, key) {
      const z = ZONES[key];
      if (z.seg !== this.seg.id) return false;
      const tol = ZONE_TOL;
      return corners.every((pt) => pt.x >= z.x - tol && pt.x <= z.x + z.w + tol && pt.y >= z.y - tol && pt.y <= z.y + z.h + tol);
    }

    updateMission(dt) {
      const m = STORE.data.mission;
      if (!m) { this.dwell = 0; return; }
      const c = STORE.contract(m.id);
      const zoneKey = m.stage === 'pickup' ? 'cargo' : c.to;
      const inZone = this.zoneContains(this.truckCorners(), zoneKey);
      const stopped = Math.abs(this.truck.speed) < 6;

      if (m.stage === 'transit') { m.timeLeft -= dt; STORE.markDirty(); }
      if (inZone && stopped) this.dwell += dt;
      else this.dwell = Math.max(0, this.dwell - dt * 2);

      if (this.dwell >= DWELL_TIME) {
        this.dwell = 0;
        if (m.stage === 'pickup') {
          m.stage = 'transit'; m.timeLeft = c.time; m.damage = 0;
          STORE.touch(); TC.ui.flash('Carga carregada!', 3400);
        } else {
          const res = STORE.completeMission();
          if (res) {
            this.showSummary(res);
            this.updateHomelessHouseVisual(); // Atualiza se desbloqueou a casinha
          }
        }
      }
    }

    showSummary(res) {
      let html = '<div class="sum-card"><div class="sum-head">ENTREGA CONCLUÍDA</div><div class="sum-title">' + res.title + '</div><dl><div><dt>Total</dt><dd>' + STORE.fmt(res.total) + '</dd></div></dl>';
      if (res.levelUp) html += '<div class="sum-level">Nível da Transportadora: ' + res.level + '!</div>';
      html += '<button class="btn primary" data-close>Continuar</button></div>';
      TC.ui.showSummary(html);
    }

    navInfo(zoneKey) {
      const z = ZONES[zoneKey];
      const ref = this.state === 'driving' ? { x: this.truck.cx, y: this.truck.cy } : { x: this.p.x, y: this.p.y };
      if (z.seg === this.seg.id) return { angle: Math.atan2(z.y - ref.y, z.x - ref.x), dist: fmtDist(Math.hypot(z.x - ref.x, z.y - ref.y)) };
      return null;
    }

    updateObjectiveUi() {
      TC.ui.setMoney(Math.round(STORE.data.money).toLocaleString('pt-BR'));
      const m = STORE.data.mission;
      if (!m) { TC.ui.setMission(null); TC.ui.setNav(null); this.setBeacon(null); return; }
      const c = STORE.contract(m.id);
      const pickup = m.stage === 'pickup';
      TC.ui.setMission({ title: c.title, step: pickup ? 'Carregar na Zona de Carga' : 'Entregue no destino', time: fmtTime(c.timeLeft || c.time), progress: this.dwell > 0.05 ? this.dwell / DWELL_TIME : null });
    }

    updatePlayer(dt, inp) {
      const p = this.p; const A = this.walkArea();
      let dx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
      let dy = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
      let step = PLAYER.speed * dt;
      if (dx || dy) { this.clearTarget(); const l = Math.hypot(dx, dy); dx /= l; dy /= l; }
      else if (this.target) {
        const tx = this.target.x - p.x; const ty = this.target.y - p.y; const dist = Math.hypot(tx, ty);
        if (dist < 4) this.clearTarget(); else { dx = tx / dist; dy = ty / dist; step = Math.min(step, dist); }
      }
      p.x += dx * step; p.y += dy * step;
      p.x = clamp(p.x, A.x0, A.x1); p.y = clamp(p.y, A.y0, A.y1);
      if (COLLISIONS.player) this.collidePlayerSolids();
    }

    collidePlayerSolids() {
      const p = this.p; const R = PLAYER.radius;
      const list = this.indoor || this.inBasement ? this.inSolids : this.solids[this.seg.id];
      for (let i = 0; i < list.length; i++) {
        const s = list[i];
        const qx = clamp(p.x, s.x, s.x + s.w); const qy = clamp(p.y, s.y, s.y + s.h);
        if (Math.hypot(p.x - qx, p.y - qy) < R) { p.x += (p.x - qx) * 0.5; p.y += (p.y - qy) * 0.5; }
      }
    }

    computeInteraction() {
      const t = this.truck; const p = this.p;
      if (this.state === 'driving') {
        if (Math.abs(t.speed) > TRUCK.exitMaxSpeed) return null;
        return { id: 'truck-exit', label: 'Sair do Caminhão' };
      }
      if (!this.indoor && !this.inBasement) {
        if (Phaser.Math.Distance.Between(p.x, p.y, OFFICE_DOOR.x, OFFICE_DOOR.y) <= OFFICE_DOOR.r) return { id: 'office-enter', label: 'Entrar no Prédio' };
        if (Phaser.Math.Distance.Between(p.x, p.y, BASEMENT_TRIGGER.x, BASEMENT_TRIGGER.y) <= BASEMENT_TRIGGER.r) return { id: 'basement-enter', label: 'Entrar no Porão' };
        const d = toWorld(t, TRUCK.door.x, TRUCK.door.y);
        if (Phaser.Math.Distance.Between(p.x, p.y, d.x, d.y) <= PLAYER.enterDist) return { id: 'truck-enter', label: 'Entrar no Caminhão' };
      } else if (this.indoor) {
        if (Phaser.Math.Distance.Between(p.x, p.y, ROOM_PC.x, ROOM_PC.y) <= ROOM_PC.r) return { id: 'pc-use', label: 'Usar Computador' };
        if (Phaser.Math.Distance.Between(p.x, p.y, ROOM_EXIT.x, ROOM_EXIT.y) <= ROOM_EXIT.r) return { id: 'office-exit', label: 'Sair do Prédio' };
      } else if (this.inBasement) {
        if (Phaser.Math.Distance.Between(p.x, p.y, ROOM_EXIT.x, ROOM_EXIT.y) <= ROOM_EXIT.r) return { id: 'basement-exit', label: 'Sair do Porão' };
        if (Phaser.Math.Distance.Between(p.x, p.y, HOMELESS_NPC.x, HOMELESS_NPC.y) <= HOMELESS_NPC.r && STORE.data.storyState === 'none') return { id: 'talk-homeless', label: 'Falar com pessoa' };
      }
      return null;
    }

    positionAction() {
      const it = this.interaction;
      TC.ui.setAction(it ? { label: it.label } : null);
    }

    handleAction() {
      const it = this.interaction;
      if (it) this.perform(it.id);
    }

    perform(id) {
      switch (id) {
        case 'truck-exit':
          this.state = 'foot'; this.p.setPosition(this.truck.cx + 40, this.truck.cy).setVisible(true);
          this.cameras.main.startFollow(this.p, true, 0.08, 0.08); TC.ui.setDriving(false); break;
        case 'truck-enter':
          this.state = 'driving'; this.p.setVisible(false);
          this.cameras.main.startFollow(this.truckView, true, 0.08, 0.08); TC.ui.setDriving(true); break;
        case 'office-enter': this.enterBuilding(false); break;
        case 'basement-enter':
          if (STORE.data.upgrades.flashlight < 1) {
            TC.ui.flash('Está tudo muito escuro. Você precisa de uma Lanterna!', 3000);
            return;
          }
          this.enterBuilding(true); break;
        case 'office-exit':
        case 'basement-exit': this.exitBuilding(); break;
        case 'pc-use': this.openComputer(); break;
        case 'talk-homeless': this.startHomelessDialog(); break;
      }
    }

    enterBuilding(basement) {
      this.busy = true;
      const cam = this.cameras.main; cam.fadeOut(220, 0, 0, 0);
      this.time.delayedCall(240, () => {
        if (basement) this.inBasement = true; else this.indoor = true;
        this.p.setPosition(ROOM_SPAWN.x, ROOM_SPAWN.y);
        cam.stopFollow(); cam.removeBounds(); cam.setBackgroundColor('#05070a');
        this.applyZoom(); cam.fadeIn(260, 0, 0, 0); this.busy = false;
      });
    }

    exitBuilding() {
      this.busy = true;
      const cam = this.cameras.main; cam.fadeOut(220, 0, 0, 0);
      this.time.delayedCall(240, () => {
        this.indoor = false; this.inBasement = false;
        this.p.setPosition(OFFICE_EXIT.x, OFFICE_EXIT.y);
        cam.setBackgroundColor('#1d2b20'); this.applyBounds(); this.applyZoom();
        cam.centerOn(this.p.x, this.p.y); cam.startFollow(this.p, true, 0.08, 0.08);
        cam.fadeIn(260, 0, 0, 0); this.busy = false;
      });
    }

    // Diálogo Exato do Easter Egg do Morador de Rua
    startHomelessDialog() {
      this.uiOpen = true;
      const d1 = window.confirm('Você: "O que você está fazendo aqui?"\n[Continuar]');
      if (!d1) { this.uiOpen = false; return; }
      alert('Morador: "Não tenho casa, por isso estou aqui."');
      alert('Morador: "Estou vendo seu uniforme, você trabalha em uma construtora, não é?"');
      const d2 = window.confirm('Você responde: "Sim."\nMorador: "Você poderia construir uma casa para mim?"\n\n[Clique em OK para SIM ou Cancelar para NÃO]');
      
      if (d2) {
        // SIM: Aceitou construir a casa de graça
        STORE.data.storyState = 'accepted';
        STORE.touch();
        alert('Você aceitou ajudar! Missões especiais de construção liberadas na sua central.');
      } else {
        // NÃO: Denunciou à polícia
        STORE.data.storyState = 'refused';
        STORE.touch();
        alert('Você o denunciou à polícia e ele foi levado.');
      }
      this.uiOpen = false;
    }

    openComputer() {
      this.uiOpen = true; this.input.keyboard.enabled = false; TC.ui.resetInputs();
      TC.pc.open(() => {
        this.uiOpen = false; this.input.keyboard.enabled = true;
        this.input.keyboard.resetKeys(); TC.consumeAction();
        this.refreshTruckLook();
      });
    }

    syncVisuals() {
      const t = this.truck;
      this.truckView.setPosition(t.cx, t.cy).setRotation(t.heading);
      this.wheelFL.rotation = t.steer; this.wheelFR.rotation = t.steer;

      // Sincroniza frota em comboio se contratada
      const fleetCount = STORE.data.fleetCount;
      for (let i = 0; i < this.fleetViews.length; i++) {
        const fv = this.fleetViews[i];
        if (i < fleetCount && t.history.length > (i + 1) * 15) {
          const pt = t.history[(i + 1) * 15];
          fv.setPosition(pt.cx, pt.cy).setRotation(pt.heading).setVisible(true);
        } else {
          fv.setVisible(false);
        }
      }
    }

    updateZonesAndHud() {
      const t = this.truck; const corners = this.truckCorners();
      let status = '';
      ZONE_KEYS.forEach((key) => {
        const inside = this.zoneContains(corners, key);
        if (inside) status = 'Na ' + ZONES[key].label;
      });
      let line = this.indoor || this.inBasement ? 'Escritório / Porão' : Math.round(Math.abs(t.speed) / 4) + ' km/h';
      TC.ui.setHud(line, status);
      this.positionAction();
    }
  }

  TC.startGame = function () {
    new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'game-container',
      backgroundColor: '#1d2b20',
      scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
      input: { activePointers: 3 },
      scene: [WorldScene],
    });
  };
})();
