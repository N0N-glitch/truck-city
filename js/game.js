/* ============================================================
   TRUCK CITY - game.js  (Fase 2 + botão contextual fixo)
   Mantém TODA a lógica da Fase 1 (física Ackermann, controles,
   tap-to-move, entrar/sair do caminhão, câmera suave) e adiciona:
   - botão contextual (só perto de objetos interativos, posição fixa no CSS)
   - prédio do escritório + sala interna + computador
   - mapa polido (calçadas, faixas, grama, árvores)
   Convenção: heading 0 = apontando para a direita (+x), y cresce para baixo.
   ============================================================ */
(function () {
  'use strict';

  const TC = window.TC;

  /* ================= CONFIGURAÇÃO (ajuste aqui) ================= */
  const WORLD = { w: 2000, h: 2000 };
  const SIDEWALK = 36;

  // Desligue aqui se a colisão atrapalhar algum teste (não afeta a física)
  const COLLISIONS = { truck: true, player: true };

  const TRUCK = {
    // Geometria (pixels) - o centro do caminhão é a origem local
    halfL: 70,
    halfW: 27,
    wheelbase: 90,
    rearToCenter: 45,
    door: { x: 40, y: -27 },

    // Dinâmica (pixels e segundos)
    maxFwd: 280,
    maxRev: 90,
    accel: 110,
    revAccel: 70,
    brake: 380,
    roll: 60,
    drag: 0.2,

    // Direção
    steerLow: 0.62,
    steerHigh: 0.22,
    steerRate: 1.9,
    steerReturn: 2.6,

    exitMaxSpeed: 40,
    spawn: { x: 700, y: 1000, heading: 0 },
  };
  const TRUCK_RADIUS = Math.hypot(TRUCK.halfL, TRUCK.halfW);

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

  /* ----- Escritório (exterior) ----- */
  const OFFICE = { x: 1170, y: 520, w: 360, h: 250 };
  const OFFICE_DOOR = { x: 1350, y: 792, r: 72 };   // ponto de interação em frente à porta
  const OFFICE_EXIT = { x: 1350, y: 812 };           // onde o jogador aparece ao sair
  const HEDGES = [
    { x: 1140, y: 540, w: 22, h: 210 },
    { x: 1538, y: 540, w: 22, h: 210 },
  ];

  const TREES = [
    // bloco superior esquerdo
    [120, 120], [310, 80], [520, 150], [730, 100], [210, 205],
    // bloco esquerdo do meio
    [110, 570], [300, 620], [520, 560], [720, 640], [640, 790], [90, 790],
    // bloco superior central
    [1210, 100], [1370, 70], [1500, 160], [1290, 200], [1190, 220],
    // inferior central
    [1200, 1400], [1420, 1480], [1280, 1650], [1500, 1780], [1180, 1880], [1380, 1900],
    // inferior esquerdo
    [150, 1280], [400, 1400], [700, 1320], [260, 1650], [560, 1760], [800, 1600], [100, 1900], [460, 1940],
    // faixa direita
    [1880, 180], [1920, 640], [1860, 1000], [1900, 1300], [1850, 1700], [1930, 1900],
    // praça do escritório
    [1170, 835], [1530, 835],
  ];

  /* ----- Sala interna (fica longe do mapa, na mesma cena) ----- */
  const ROOM = { x: 2400, y: 200, w: 800, h: 560 };
  const ROOM_WALK = { x0: ROOM.x + 26, y0: ROOM.y + 100, x1: ROOM.x + ROOM.w - 26, y1: ROOM.y + ROOM.h - 26 };
  const ROOM_SPAWN = { x: ROOM.x + 400, y: ROOM.y + 440 };
  const ROOM_EXIT = { x: ROOM.x + 400, y: ROOM.y + 515, r: 64 };
  const ROOM_PC = { x: ROOM.x + 570, y: ROOM.y + 222, r: 76 };

  /* ================= HELPERS ================= */
  const clamp = Phaser.Math.Clamp;
  const lerp = (a, b, t) => a + (b - a) * t;
  const approach = (v, target, step) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target));

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Converte um ponto local do caminhão para coordenadas do mundo
  function toWorld(t, lx, ly) {
    const cos = Math.cos(t.heading);
    const sin = Math.sin(t.heading);
    return { x: t.cx + lx * cos - ly * sin, y: t.cy + lx * sin + ly * cos };
  }

  /* ================= DESENHO DAS TEXTURAS (rodam uma única vez) ================= */

  // ---------- MAPA: grama, calçadas, ruas, faixas, praça, sebes ----------
  function drawGround(g) {
    const W = WORLD.w, H = WORLD.h, SW = SIDEWALK;
    const rnd = mulberry32(42);

    // Grama em xadrez suave + tufos
    g.fillStyle(0x3b6e41, 1);
    g.fillRect(0, 0, W, H);
    g.fillStyle(0x376a3d, 1);
    for (let gx = 0; gx < W; gx += 100) {
      for (let gy = 0; gy < H; gy += 100) {
        if (((gx + gy) / 100) % 2 === 0) g.fillRect(gx, gy, 100, 100);
      }
    }
    for (let i = 0; i < 700; i++) {
      g.fillStyle(rnd() < 0.5 ? 0x4b8650 : 0x2f5e35, 0.55);
      g.fillRect(Math.floor(rnd() * W), Math.floor(rnd() * H), 3, 3);
    }

    // Calçadas (borda escura primeiro, depois o concreto claro)
    g.fillStyle(0x8c877b, 1);
    ROADS.forEach((r) => g.fillRect(r.x - SW - 3, r.y - SW - 3, r.w + 2 * (SW + 3), r.h + 2 * (SW + 3)));
    g.fillStyle(0xbdb8ab, 1);
    ROADS.forEach((r) => g.fillRect(r.x - SW, r.y - SW, r.w + 2 * SW, r.h + 2 * SW));

    // Asfalto
    g.fillStyle(0x33343b, 1);
    ROADS.forEach((r) => g.fillRect(r.x, r.y, r.w, r.h));

    const inOther = (px, py, idx) =>
      ROADS.some((r, j) => j !== idx && px >= r.x - 6 && px <= r.x + r.w + 6 && py >= r.y - 6 && py <= r.y + r.h + 6);

    // Linhas laterais (pula cruzamentos)
    g.fillStyle(0xdedede, 0.7);
    ROADS.forEach((r, i) => {
      if (r.w > r.h) {
        for (let x = 0; x < W; x += 20) {
          if (inOther(x + 10, r.y + 10, i)) continue;
          g.fillRect(x, r.y + 8, 20, 2);
          g.fillRect(x, r.y + r.h - 10, 20, 2);
        }
      } else {
        for (let y = 0; y < H; y += 20) {
          if (inOther(r.x + 10, y + 10, i)) continue;
          g.fillRect(r.x + 8, y, 2, 20);
          g.fillRect(r.x + r.w - 10, y, 2, 20);
        }
      }
    });

    // Faixa central tracejada (pula cruzamentos)
    g.fillStyle(0xe8d44d, 1);
    ROADS.forEach((r, i) => {
      if (r.w > r.h) {
        const cy = r.y + r.h / 2;
        for (let x = 0; x < W; x += 80) {
          if (!inOther(x + 20, cy, i)) g.fillRect(x, cy - 2, 40, 4);
        }
      } else {
        const cx = r.x + r.w / 2;
        for (let y = 0; y < H; y += 80) {
          if (!inOther(cx, y + 20, i)) g.fillRect(cx - 2, y, 4, 40);
        }
      }
    });

    // Faixas de pedestre nos cruzamentos
    g.fillStyle(0xf2f2f2, 0.85);
    const hRoads = ROADS.filter((r) => r.w > r.h);
    const vRoads = ROADS.filter((r) => r.h > r.w);
    hRoads.forEach((h) => vRoads.forEach((v) => {
      for (let x = v.x + 12; x < v.x + v.w - 12; x += 24) {
        g.fillRect(x, h.y - 30, 12, 20);
        g.fillRect(x, h.y + h.h + 10, 12, 20);
      }
      for (let y = h.y + 12; y < h.y + h.h - 12; y += 24) {
        g.fillRect(v.x - 30, y, 20, 12);
        g.fillRect(v.x + v.w + 10, y, 20, 12);
      }
    }));

    // Praça e caminho em frente ao escritório
    g.fillStyle(0xc9c3b4, 1);
    g.fillRect(1140, 770, 420, 96);
    g.fillStyle(0xb2ac9d, 0.7);
    for (let x = 1140; x <= 1560; x += 30) g.fillRect(x, 770, 1, 96);
    for (let y = 770; y <= 866; y += 24) g.fillRect(1140, y, 420, 1);
    g.fillStyle(0xe1dccd, 1);
    g.fillRect(1316, 770, 68, 96);
    g.lineStyle(2, 0xb2ac9d, 1);
    g.strokeRect(1316, 770, 68, 96);

    // Sebes
    HEDGES.forEach((h) => {
      g.fillStyle(0x24502a, 1);
      g.fillRoundedRect(h.x, h.y, h.w, h.h, 8);
      g.fillStyle(0x3a7a41, 1);
      g.fillRoundedRect(h.x + 3, h.y + 3, h.w - 6, h.h - 6, 6);
      g.fillStyle(0x4f9a56, 0.8);
      for (let y = h.y + 10; y < h.y + h.h - 6; y += 18) g.fillCircle(h.x + h.w / 2, y, 4);
    });

    // Borda do mundo (faixa escura discreta)
    g.fillStyle(0x1f3f25, 1);
    g.fillRect(0, 0, W, 14);
    g.fillRect(0, H - 14, W, 14);
    g.fillRect(0, 0, 14, H);
    g.fillRect(W - 14, 0, 14, H);
  }

  // ---------- ESCRITÓRIO (visão de cima com fachada sul visível) ----------
  // Textura 390x320. O prédio fica em (10,20) dentro dela.
  function drawOfficeTexture(g) {
    const bx = 10, by = 20, bw = OFFICE.w, bh = OFFICE.h, roofH = 170;

    // sombra projetada
    g.fillStyle(0x000000, 0.28);
    g.fillRoundedRect(bx + 10, by + 12, bw, bh, 8);

    // fachada (parede frontal) + rodapé
    g.fillStyle(0xe9e0cb, 1);
    g.fillRect(bx, by + roofH, bw, bh - roofH);
    g.fillStyle(0xcdbf9f, 1);
    g.fillRect(bx, by + bh - 8, bw, 8);

    // telhado com platibanda
    g.fillStyle(0x56677f, 1);
    g.fillRoundedRect(bx, by, bw, roofH, 6);
    g.lineStyle(5, 0x9fb0c6, 1);
    g.strokeRoundedRect(bx + 2.5, by + 2.5, bw - 5, roofH - 5, 5);
    g.lineStyle(1, 0x6b7d96, 0.9);
    for (let x = bx + 30; x < bx + bw - 10; x += 30) g.lineBetween(x, by + 8, x, by + roofH - 8);

    // beiral (sombra sob o telhado)
    g.fillStyle(0x000000, 0.2);
    g.fillRect(bx, by + roofH, bw, 7);

    // aparelhos de ar-condicionado
    [bx + 28, bx + bw - 88].forEach((ax) => {
      g.fillStyle(0x000000, 0.2);
      g.fillRect(ax + 4, by + 16, 60, 40);
      g.fillStyle(0xcfd6df, 1);
      g.fillRect(ax, by + 12, 60, 40);
      g.lineStyle(2, 0x8c97a6, 1);
      g.strokeRect(ax, by + 12, 60, 40);
      g.fillStyle(0x5f6b7a, 1);
      g.fillCircle(ax + 30, by + 32, 15);
      g.fillStyle(0x3d4652, 1);
      g.fillCircle(ax + 30, by + 32, 4);
      g.lineStyle(2, 0x3d4652, 1);
      g.lineBetween(ax + 15, by + 32, ax + 45, by + 32);
      g.lineBetween(ax + 30, by + 17, ax + 30, by + 47);
    });

    // claraboias
    [bx + 24, bx + bw - 80].forEach((sx) => {
      g.fillStyle(0x2e3b4c, 1);
      g.fillRect(sx, by + 112, 56, 42);
      g.fillStyle(0x9fd6ee, 1);
      g.fillRect(sx + 3, by + 115, 50, 36);
      g.fillStyle(0xd6f1fb, 0.7);
      g.fillTriangle(sx + 3, by + 115, sx + 34, by + 115, sx + 3, by + 146);
      g.lineStyle(2, 0x2e3b4c, 1);
      g.lineBetween(sx + 28, by + 115, sx + 28, by + 151);
      g.lineBetween(sx + 3, by + 133, sx + 53, by + 133);
    });

    // janelas da fachada
    const wy = by + 182;
    [bx + 24, bx + 96, bx + bw - 74, bx + bw - 146].forEach((wx) => {
      g.fillStyle(0x3b4a5c, 1);
      g.fillRect(wx, wy, 50, 36);
      g.fillStyle(0x7fb6d6, 1);
      g.fillRect(wx + 3, wy + 3, 44, 30);
      g.fillStyle(0xb9e0f2, 0.55);
      g.fillTriangle(wx + 3, wy + 3, wx + 30, wy + 3, wx + 3, wy + 30);
      g.lineStyle(2, 0x3b4a5c, 1);
      g.lineBetween(wx + 25, wy + 3, wx + 25, wy + 33);
      g.fillStyle(0xcfc3a5, 1);
      g.fillRect(wx - 3, wy + 36, 56, 4);
    });

    // porta de entrada
    const dx = bx + 158, dy = by + 196;
    g.fillStyle(0x5b3a26, 1);
    g.fillRect(dx, dy, 44, bh - 196 + 0);
    g.fillStyle(0x9ed3e6, 0.95);
    g.fillRect(dx + 6, dy + 8, 32, 34);
    g.lineStyle(2, 0x5b3a26, 1);
    g.lineBetween(dx + 22, dy + 8, dx + 22, dy + 42);
    g.fillStyle(0xe0b341, 1);
    g.fillRect(dx + 36, dy + 30, 4, 5);

    // toldo listrado
    const ax0 = bx + 140;
    for (let i = 0; i < 8; i++) {
      g.fillStyle(i % 2 ? 0xf4efe6 : 0xc0392b, 1);
      g.fillRect(ax0 + i * 10, by + 176, 10, 20);
    }
    g.fillStyle(0x000000, 0.22);
    g.fillRect(ax0, by + 196, 80, 6);

    // degraus
    g.fillStyle(0xd8d2c2, 1);
    g.fillRect(bx + 130, by + bh, 100, 7);
    g.fillStyle(0xcbc5b4, 1);
    g.fillRect(bx + 122, by + bh + 7, 116, 7);

    // vasos de flores ao lado da porta
    [bx + 112, bx + 248].forEach((px) => {
      g.fillStyle(0x8a4b2a, 1);
      g.fillRect(px - 10, by + bh - 20, 20, 14);
      g.fillStyle(0x2f8f4a, 1);
      g.fillCircle(px, by + bh - 24, 10);
      g.fillStyle(0xf06292, 1);
      g.fillCircle(px - 4, by + bh - 27, 3);
      g.fillStyle(0xffd54f, 1);
      g.fillCircle(px + 4, by + bh - 23, 3);
    });
  }

  // ---------- ÁRVORE (copa vista de cima) 72x72 ----------
  function drawTree(g) {
    g.fillStyle(0x000000, 0.22);
    g.fillEllipse(40, 46, 56, 40);
    g.fillStyle(0x2d6a34, 1);
    g.fillCircle(36, 34, 28);
    g.fillStyle(0x3b8a43, 1);
    g.fillCircle(30, 28, 20);
    g.fillCircle(44, 30, 16);
    g.fillStyle(0x56b05a, 1);
    g.fillCircle(28, 24, 10);
    g.fillCircle(42, 22, 7);
    g.fillStyle(0x24562b, 1);
    g.fillCircle(46, 44, 5);
    g.fillCircle(24, 42, 4);
  }

  // ---------- SALA INTERNA 800x560 ----------
  function drawRoom(g) {
    const W = ROOM.w, H = ROOM.h;
    const rnd = mulberry32(11);

    // piso de madeira
    g.fillStyle(0xb5834f, 1);
    g.fillRect(0, 0, W, H);
    for (let y = 100, i = 0; y < H; y += 28, i++) {
      g.fillStyle(i % 2 ? 0xad7a47 : 0xbb8a56, 1);
      g.fillRect(0, y, W, 28);
      g.fillStyle(0x8f6339, 0.6);
      g.fillRect(0, y, W, 1);
      for (let x = (i * 97) % 160; x < W; x += 160) g.fillRect(x, y, 1, 28);
    }

    // parede dos fundos
    g.fillStyle(0xe6e0d1, 1);
    g.fillRect(0, 0, W, 100);
    g.fillStyle(0xc9d2dc, 1);
    g.fillRect(0, 62, W, 32);
    g.fillStyle(0xaab6c4, 1);
    g.fillRect(0, 62, W, 3);
    g.fillStyle(0x5d4a37, 1);
    g.fillRect(0, 94, W, 6);
    g.fillStyle(0x4a3b2c, 1);
    g.fillRect(0, 0, W, 6);

    // paredes laterais e inferior
    g.fillStyle(0x6e5d49, 1);
    g.fillRect(0, 0, 26, H);
    g.fillRect(W - 26, 0, 26, H);
    g.fillRect(0, H - 26, W, 26);

    // porta de saída (vão na parede inferior) + tapete de entrada
    g.fillStyle(0xd9c9a8, 1);
    g.fillRect(360, H - 26, 80, 26);
    g.lineStyle(3, 0x4a3b2c, 1);
    g.strokeRect(360, H - 26, 80, 26);
    g.fillStyle(0x7a2e2e, 1);
    g.fillRect(366, H - 52, 68, 24);
    g.lineStyle(2, 0x5a1f1f, 1);
    g.strokeRect(366, H - 52, 68, 24);

    // janelas
    [50, 170].forEach((x) => {
      const y = 22;
      g.fillStyle(0xf4efe3, 1);
      g.fillRect(x - 4, y - 4, 108, 62);
      g.fillStyle(0x86c5e8, 1);
      g.fillRect(x, y, 100, 54);
      g.fillStyle(0xbfe6f7, 0.7);
      g.fillTriangle(x, y, x + 60, y, x, y + 54);
      g.fillStyle(0xf4efe3, 1);
      g.fillRect(x + 48, y, 4, 54);
      g.fillRect(x, y + 25, 100, 4);
    });

    // relógio
    g.fillStyle(0x4a3b2c, 1);
    g.fillCircle(320, 40, 20);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(320, 40, 17);
    g.lineStyle(2, 0x222222, 1);
    g.lineBetween(320, 40, 320, 28);
    g.lineBetween(320, 40, 329, 44);

    // quadros e calendário
    [[480, 24], [570, 24]].forEach(([x, y], i) => {
      g.fillStyle(0x3b3b3b, 1);
      g.fillRect(x, y, 70, 48);
      g.fillStyle(i ? 0xc9a86a : 0x6aa0c8, 1);
      g.fillRect(x + 4, y + 4, 62, 40);
      g.fillStyle(i ? 0x8a6b3a : 0x3e7aa8, 1);
      g.fillTriangle(x + 4, y + 44, x + 30, y + 18, x + 56, y + 44);
    });
    g.fillStyle(0xffffff, 1);
    g.fillRect(680, 28, 40, 52);
    g.fillStyle(0xc0392b, 1);
    g.fillRect(680, 28, 40, 12);

    // estante de livros (40,100,190,56)
    g.fillStyle(0x6b4a2f, 1);
    g.fillRect(40, 100, 190, 56);
    g.fillStyle(0x4d3420, 1);
    g.fillRect(44, 104, 182, 24);
    g.fillRect(44, 130, 182, 22);
    const cols = [0xc0392b, 0x2980b9, 0x27ae60, 0xf1c40f, 0x8e44ad, 0xe67e22, 0x16a085];
    [[104, 24], [130, 22]].forEach(([ry, rh]) => {
      let x = 46;
      while (x < 220) {
        const bw = 6 + Math.floor(rnd() * 6);
        const bh = rh - 4 - Math.floor(rnd() * 6);
        g.fillStyle(cols[Math.floor(rnd() * cols.length)], 1);
        g.fillRect(x, ry + (rh - bh) - 2, bw, bh);
        x += bw + 1;
      }
    });

    // arquivos (250,100,44,50) e (298,100,44,50)
    [250, 298].forEach((x) => {
      g.fillStyle(0x8e98a5, 1);
      g.fillRect(x, 100, 44, 50);
      g.lineStyle(2, 0x5f6975, 1);
      g.strokeRect(x, 100, 44, 50);
      for (let i = 0; i < 3; i++) {
        g.lineBetween(x + 2, 116 + i * 16, x + 42, 116 + i * 16);
        g.fillStyle(0x333a43, 1);
        g.fillRect(x + 16, 106 + i * 16, 12, 3);
      }
    });

    // bebedouro (370,104,28,36)
    g.fillStyle(0xeef2f6, 1);
    g.fillRect(370, 120, 28, 20);
    g.fillStyle(0x7ec8ee, 0.9);
    g.fillCircle(384, 112, 12);
    g.fillStyle(0xffffff, 0.6);
    g.fillCircle(380, 108, 4);

    // planta do canto (716,104,40,40)
    drawPlant(g, 736, 124);

    // mesa do computador (460,100,220,100)
    g.fillStyle(0x000000, 0.2);
    g.fillRect(464, 106, 220, 100);
    g.fillStyle(0x7a5232, 1);
    g.fillRect(460, 100, 220, 100);
    g.fillStyle(0x92643c, 1);
    g.fillRect(464, 104, 212, 92);
    g.lineStyle(1, 0x6b4527, 0.6);
    [128, 152, 176].forEach((y) => g.lineBetween(464, y, 676, y));

    // monitor (visto de frente)
    g.fillStyle(0x14171c, 1);
    g.fillRoundedRect(516, 104, 108, 58, 4);
    // tela: degradê em faixas
    ['#1b4f8f', '#1f5a9e', '#2466ad', '#2a72bb'].forEach((hex, i) => {
      g.fillStyle(parseInt(hex.slice(1), 16), 1);
      g.fillRect(521, 109 + i * 11, 98, 12);
    });
    g.fillStyle(0xf3f6fb, 1);
    g.fillRect(528, 114, 52, 30);
    g.fillStyle(0x2d6cdf, 1);
    g.fillRect(528, 114, 52, 6);
    g.fillStyle(0x9aa7b8, 1);
    g.fillRect(532, 124, 30, 3);
    g.fillRect(532, 131, 40, 3);
    g.fillRect(532, 138, 24, 3);
    g.fillStyle(0xf39c12, 1);
    g.fillRect(588, 116, 10, 10);
    g.fillStyle(0x2ecc71, 1);
    g.fillRect(588, 132, 10, 10);
    g.fillStyle(0x0f2742, 1);
    g.fillRect(521, 150, 98, 7);
    g.fillStyle(0x6fb4ff, 1);
    g.fillCircle(526, 153.5, 2.5);
    g.fillStyle(0x2b2f36, 1);
    g.fillRect(566, 162, 8, 6);
    g.fillRect(548, 168, 44, 5);

    // teclado e mouse
    g.fillStyle(0xd5d9df, 1);
    g.fillRect(532, 176, 76, 16);
    g.fillStyle(0xaab0b9, 1);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 11; c++) g.fillRect(534 + c * 6.8, 178 + r * 4.6, 5, 3);
    }
    g.fillStyle(0xe9ecf0, 1);
    g.fillEllipse(626, 184, 12, 16);
    g.lineStyle(1, 0x9aa1ab, 1);
    g.lineBetween(626, 177, 626, 184);

    // caneca, papéis e luminária
    g.fillStyle(0xffffff, 1);
    g.fillCircle(482, 120, 7);
    g.fillStyle(0x5b3a26, 1);
    g.fillCircle(482, 120, 4.5);
    g.fillStyle(0xf8f8f8, 1);
    g.fillRect(636, 112, 30, 22);
    g.fillStyle(0xe6e6e6, 1);
    g.fillRect(642, 116, 30, 22);
    g.fillStyle(0x333333, 1);
    g.fillCircle(660, 176, 5);
    g.lineStyle(3, 0x333333, 1);
    g.lineBetween(660, 176, 650, 160);
    g.fillStyle(0xf6c445, 1);
    g.fillCircle(648, 158, 8);

    // cadeira do escritório
    g.fillStyle(0x000000, 0.2);
    g.fillCircle(573, 254, 22);
    g.fillStyle(0x2f3640, 1);
    g.fillCircle(570, 250, 22);
    g.fillStyle(0x3d4654, 1);
    g.fillCircle(570, 250, 15);
    g.fillStyle(0x252b33, 1);
    g.fillRoundedRect(552, 268, 36, 10, 5);
    g.fillRect(542, 240, 6, 22);
    g.fillRect(592, 240, 6, 22);

    // tapete + mesa de reunião (90,330,200,110)
    g.fillStyle(0x4f6b8a, 1);
    g.fillRect(60, 290, 260, 190);
    g.lineStyle(3, 0x2f435c, 1);
    g.strokeRect(60, 290, 260, 190);
    g.lineStyle(2, 0x6d89a8, 1);
    g.strokeRect(72, 302, 236, 166);

    [[120, 308], [260, 308], [120, 462], [260, 462], [70, 385], [310, 385]].forEach(([cx, cy]) => {
      g.fillStyle(0x000000, 0.2);
      g.fillCircle(cx + 2, cy + 3, 16);
      g.fillStyle(0x3a4452, 1);
      g.fillCircle(cx, cy, 16);
      g.fillStyle(0x4a566a, 1);
      g.fillCircle(cx, cy, 10);
    });

    g.fillStyle(0x000000, 0.2);
    g.fillRoundedRect(94, 335, 200, 110, 14);
    g.fillStyle(0x7a5232, 1);
    g.fillRoundedRect(90, 330, 200, 110, 14);
    g.fillStyle(0x92643c, 1);
    g.fillRoundedRect(96, 336, 188, 98, 10);
    g.fillStyle(0x9aa3ad, 1);
    g.fillRect(140, 360, 36, 24);
    g.fillStyle(0x2d6cdf, 1);
    g.fillRect(143, 363, 30, 16);
    g.fillStyle(0xf8f8f8, 1);
    g.fillRect(210, 358, 34, 24);
    g.fillRect(216, 388, 34, 22);

    // sofá (540,420,170,70) + mesa de centro (570,350,110,50)
    g.fillStyle(0x000000, 0.2);
    g.fillRoundedRect(544, 425, 170, 70, 10);
    g.fillStyle(0x3d6a77, 1);
    g.fillRoundedRect(540, 420, 170, 70, 10);
    g.fillStyle(0x2f535e, 1);
    g.fillRoundedRect(540, 470, 170, 20, 8);
    [546, 598, 650].forEach((x) => {
      g.fillStyle(0x4f8798, 1);
      g.fillRoundedRect(x, 424, 52, 44, 6);
    });
    g.fillStyle(0x2f535e, 1);
    g.fillRect(540, 420, 8, 70);
    g.fillRect(702, 420, 8, 70);

    g.fillStyle(0x000000, 0.2);
    g.fillRoundedRect(574, 355, 110, 50, 8);
    g.fillStyle(0xcbb89a, 1);
    g.fillRoundedRect(570, 350, 110, 50, 8);
    g.fillStyle(0xdccdb0, 1);
    g.fillRoundedRect(575, 355, 100, 40, 6);
    g.fillStyle(0xc0392b, 1);
    g.fillRect(590, 365, 24, 16);
    g.fillStyle(0x2980b9, 1);
    g.fillRect(620, 368, 24, 16);

    // plantas dos cantos inferiores
    drawPlant(g, 60, 490);
    drawPlant(g, 750, 490);
  }

  function drawPlant(g, cx, cy) {
    g.fillStyle(0x000000, 0.2);
    g.fillCircle(cx + 3, cy + 4, 16);
    g.fillStyle(0x9a5a34, 1);
    g.fillCircle(cx, cy, 15);
    g.fillStyle(0x6e3f22, 1);
    g.fillCircle(cx, cy, 11);
    g.fillStyle(0x2f8f4a, 1);
    g.fillCircle(cx - 7, cy - 5, 11);
    g.fillCircle(cx + 8, cy - 3, 10);
    g.fillCircle(cx, cy + 8, 10);
    g.fillStyle(0x4fb36a, 1);
    g.fillCircle(cx - 5, cy - 7, 6);
    g.fillCircle(cx + 6, cy - 5, 5);
  }

  /* ================= CENA PRINCIPAL ================= */
  class WorldScene extends Phaser.Scene {
    constructor() {
      super('World');
    }

    create() {
      this.state = 'driving';   // 'driving' | 'foot'
      this.indoor = false;      // a pé dentro do escritório?
      this.uiOpen = false;      // interface do computador aberta?
      this.busy = false;        // transição (fade) em andamento?
      this.target = null;
      this.stuckTime = 0;
      this.interaction = null;
      this.zoneInside = { cargo: false, work: false };
      this.zoneGfx = {};
      this.outSolids = [];
      this.inSolids = [];

      this.buildTextures();
      this.buildOutdoor();
      this.buildIndoor();
      this.createTruck();
      this.createPlayer();
      this.createInput();

      const cam = this.cameras.main;
      cam.setBounds(0, 0, WORLD.w, WORLD.h);
      cam.startFollow(this.truckView, true, 0.08, 0.08);
      cam.centerOn(this.truckView.x, this.truckView.y);

      this.scale.on('resize', this.applyZoom, this);
      this.applyZoom();

      // Liga/desliga o botão contextual após cada frame renderizado
      this.events.on(Phaser.Scenes.Events.RENDER, this.positionAction, this);

      TC.ui.setDriving(true);
    }

    applyZoom() {
      const cam = this.cameras.main;
      const w = this.scale.width;
      const h = this.scale.height;
      if (this.indoor) {
        // sala interna: câmera fixa, centralizada, enquadrando o cômodo inteiro
        const z = clamp(Math.min(w / (ROOM.w + 80), h / (ROOM.h + 80)), 0.35, 1.4);
        cam.setZoom(z);
        cam.centerOn(ROOM.x + ROOM.w / 2, ROOM.y + ROOM.h / 2);
      } else {
        cam.setZoom(clamp(Math.min(w, h) / 620, 0.7, 1.2));
      }
    }

    /* ---------------- TEXTURAS ---------------- */
    makeTexture(key, w, h, drawFn) {
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      drawFn(g);
      g.generateTexture(key, w, h);
      g.destroy();
    }

    buildTextures() {
      this.makeTexture('tex-ground', WORLD.w, WORLD.h, drawGround);
      this.makeTexture('tex-office', 390, 320, drawOfficeTexture);
      this.makeTexture('tex-tree', 72, 72, drawTree);
      this.makeTexture('tex-room', ROOM.w, ROOM.h, drawRoom);
    }

    addSolid(list, x, y, w, h) {
      list.push({ x: x, y: y, w: w, h: h, cx: x + w / 2, cy: y + h / 2, r: Math.hypot(w, h) / 2 });
    }

    /* ---------------- MAPA EXTERNO ---------------- */
    buildOutdoor() {
      this.add.image(0, 0, 'tex-ground').setOrigin(0).setDepth(0);

      Object.keys(ZONES).forEach((key) => this.makeZone(key));

      // prédio do escritório
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

      this.addSolid(this.outSolids, OFFICE.x, OFFICE.y, OFFICE.w, OFFICE.h);
      HEDGES.forEach((h) => this.addSolid(this.outSolids, h.x, h.y, h.w, h.h));

      // árvores (copa acima do caminhão, tronco sólido)
      TREES.forEach((p) => {
        this.add.image(p[0], p[1], 'tex-tree').setOrigin(0.5, 0.47).setDepth(12);
        this.addSolid(this.outSolids, p[0] - 17, p[1] - 17, 34, 34);
      });
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
      g.fillStyle(z.color, active ? 0.75 : 0.32);
      g.fillRect(z.x, z.y, z.w, z.h);
      // hachura diagonal
      g.lineStyle(2, z.color, active ? 0.5 : 0.28);
      for (let d = 24; d < z.w + z.h; d += 24) {
        g.lineBetween(
          z.x + Math.min(d, z.w), z.y + Math.max(0, d - z.w),
          z.x + Math.max(0, d - z.h), z.y + Math.min(d, z.h)
        );
      }
      g.lineStyle(4, z.color, 1);
      g.strokeRect(z.x, z.y, z.w, z.h);
    }

    /* ---------------- SALA INTERNA ---------------- */
    buildIndoor() {
      this.add.image(ROOM.x, ROOM.y, 'tex-room').setOrigin(0).setDepth(1);

      const S = (x, y, w, h) => this.addSolid(this.inSolids, ROOM.x + x, ROOM.y + y, w, h);
      S(40, 100, 190, 56);   // estante
      S(250, 100, 44, 50);   // arquivo 1
      S(298, 100, 44, 50);   // arquivo 2
      S(370, 104, 28, 36);   // bebedouro
      S(460, 100, 220, 100); // mesa do computador
      S(716, 104, 40, 40);   // planta
      S(90, 330, 200, 110);  // mesa de reunião
      S(540, 420, 170, 70);  // sofá
      S(570, 350, 110, 50);  // mesa de centro
      S(40, 470, 40, 40);    // planta inferior esquerda
      S(730, 470, 40, 40);   // planta inferior direita

      // brilho sutil da tela do computador
      const glow = this.add
        .rectangle(ROOM.x + 570, ROOM.y + 133, 98, 48, 0x6fb4ff, 0.1)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(2);
      this.tweens.add({ targets: glow, alpha: 0.2, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    /* ---------------- CAMINHÃO (Fase 1, intacto + sombra) ---------------- */
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
        cx: T.spawn.x,
        cy: T.spawn.y,
      };

      const c = this.add.container(T.spawn.x, T.spawn.y).setDepth(10);
      const shadow = this.add.rectangle(3, 5, 140, 54, 0x000000, 0.25);
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

      c.add([shadow, g, this.tailL, this.tailR, this.wheelFL, this.wheelFR]);
      this.truckView = c;
    }

    /* ---------------- PERSONAGEM ---------------- */
    createPlayer() {
      const shadow = this.add.ellipse(2, 3, 24, 22, 0x000000, 0.25);
      const body = this.add.circle(0, 0, PLAYER.radius, 0x2d7ff9).setStrokeStyle(2, 0xffffff);
      const nose = this.add.rectangle(9, 0, 8, 4, 0xffffff);
      this.p = this.add.container(0, 0, [shadow, body, nose]).setDepth(20).setVisible(false);

      this.marker = this.add
        .circle(0, 0, 10, 0xffffff, 0.15)
        .setStrokeStyle(2, 0xffffff)
        .setDepth(5)
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
        if (this.state !== 'foot' || this.busy || this.uiOpen) return;
        this.setTarget(pointer.worldX, pointer.worldY);
      });
    }

    // Área onde o jogador pode andar (fora ou dentro do escritório)
    walkArea() {
      const R = PLAYER.radius;
      if (this.indoor) {
        return { x0: ROOM_WALK.x0 + R, y0: ROOM_WALK.y0 + R, x1: ROOM_WALK.x1 - R, y1: ROOM_WALK.y1 - R };
      }
      return { x0: R, y0: R, x1: WORLD.w - R, y1: WORLD.h - R };
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

      const frozen = this.uiOpen || this.busy;
      let inp = this.readInput(); // sempre lê, para não acumular "teclas pendentes"
      if (frozen) {
        inp = { left: 0, right: 0, up: 0, down: 0, throttle: 0, brake: 0, steer: 0, action: false };
      }

      this.interaction = frozen ? null : this.computeInteraction();

      if (this.state === 'driving') {
        this.updateTruck(dt, inp, false);
      } else {
        // sem motorista: freio de mão e volante volta ao centro
        this.updateTruck(dt, { throttle: 0, brake: 0, steer: 0 }, true);
        if (!frozen) this.updatePlayer(dt, inp);
      }

      if (inp.action) this.handleAction();

      this.syncVisuals();
      this.updateZonesAndHud();
    }

    /* ---------------- FÍSICA DO CAMINHÃO (Ackermann / bicicleta) - Fase 1 ---------------- */
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

      const prev = { rx: t.rx, ry: t.ry, heading: t.heading };

      // Rotação SÓ muda com a velocidade (v = 0 -> não gira)
      t.heading += (v / T.wheelbase) * Math.tan(t.steer) * dt;

      // Movimento do eixo traseiro ao longo do heading
      t.rx += Math.cos(t.heading) * v * dt;
      t.ry += Math.sin(t.heading) * v * dt;

      let cx = t.rx + Math.cos(t.heading) * T.rearToCenter;
      let cy = t.ry + Math.sin(t.heading) * T.rearToCenter;

      // [Fase 2] Colisão com prédio, árvores e sebes: volta ao frame anterior
      if (COLLISIONS.truck && Math.abs(v) > 0.01 && this.truckHitsSolid(cx, cy, t.heading)) {
        t.rx = prev.rx;
        t.ry = prev.ry;
        t.heading = prev.heading;
        cx = t.rx + Math.cos(t.heading) * T.rearToCenter;
        cy = t.ry + Math.sin(t.heading) * T.rearToCenter;
        v = -v * 0.2; // pequeno "quique" para trás
      }

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

    // Retângulo girado (caminhão) x retângulo alinhado (SAT em 4 eixos)
    truckHitsSolid(cx, cy, heading) {
      const hx = TRUCK.halfL;
      const hy = TRUCK.halfW;
      const cos = Math.cos(heading);
      const sin = Math.sin(heading);
      const ac = Math.abs(cos);
      const as = Math.abs(sin);
      const ex = ac * hx + as * hy; // meia-extensão do caminhão no eixo X do mundo
      const ey = as * hx + ac * hy; // ... no eixo Y

      const list = this.outSolids;
      for (let i = 0; i < list.length; i++) {
        const s = list[i];
        const dx = s.cx - cx;
        const dy = s.cy - cy;
        const rr = TRUCK_RADIUS + s.r;
        if (dx * dx + dy * dy > rr * rr) continue;       // rejeição rápida
        const hw = s.w / 2;
        const hh = s.h / 2;
        if (Math.abs(dx) >= ex + hw) continue;           // eixo X
        if (Math.abs(dy) >= ey + hh) continue;           // eixo Y
        const du = dx * cos + dy * sin;                   // eixo do caminhão (comprimento)
        if (Math.abs(du) >= hx + (hw * ac + hh * as)) continue;
        const dv = -dx * sin + dy * cos;                  // eixo do caminhão (largura)
        if (Math.abs(dv) >= hy + (hw * as + hh * ac)) continue;
        return true;
      }
      return false;
    }

    /* ---------------- PERSONAGEM A PÉ (Fase 1 + colisões) ---------------- */
    updatePlayer(dt, inp) {
      const p = this.p;
      const A = this.walkArea();
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

      if (!this.indoor) this.pushPlayerOutOfTruck();
      if (COLLISIONS.player) this.collidePlayerSolids();
      p.x = clamp(p.x, A.x0, A.x1);
      p.y = clamp(p.y, A.y0, A.y1);

      // se o alvo está bloqueado (ex.: dentro do caminhão/prédio), desiste
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

    // [Fase 2] Jogador x prédio/árvores/sebes (fora) ou móveis (dentro)
    collidePlayerSolids() {
      const p = this.p;
      const R = PLAYER.radius;
      const list = this.indoor ? this.inSolids : this.outSolids;
      for (let i = 0; i < list.length; i++) {
        const s = list[i];
        const qx = clamp(p.x, s.x, s.x + s.w);
        const qy = clamp(p.y, s.y, s.y + s.h);
        const dx = p.x - qx;
        const dy = p.y - qy;
        const d2 = dx * dx + dy * dy;
        if (d2 >= R * R) continue;
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const k = (R - d) / d;
          p.x += dx * k;
          p.y += dy * k;
        } else {
          const l = p.x - s.x, r = s.x + s.w - p.x, tp = p.y - s.y, b = s.y + s.h - p.y;
          const m = Math.min(l, r, tp, b);
          if (m === l) p.x = s.x - R;
          else if (m === r) p.x = s.x + s.w + R;
          else if (m === tp) p.y = s.y - R;
          else p.y = s.y + s.h + R;
        }
      }
    }

    /* ---------------- INTERAÇÕES CONTEXTUAIS ---------------- */
    doorWorld() {
      return toWorld(this.truck, TRUCK.door.x, TRUCK.door.y);
    }

    // Decide qual interação está disponível AGORA (ou null = botão oculto)
    computeInteraction() {
      const t = this.truck;
      const p = this.p;

      if (this.state === 'driving') {
        if (Math.abs(t.speed) > TRUCK.exitMaxSpeed) return null; // em movimento: sem botão
        return { id: 'truck-exit', label: 'Sair do Caminhão' };
      }

      const cands = [];
      if (!this.indoor) {
        const d = this.doorWorld();
        cands.push({ id: 'truck-enter', label: 'Entrar no Caminhão', x: d.x, y: d.y, r: PLAYER.enterDist });
        cands.push({ id: 'office-enter', label: 'Entrar no Prédio', x: OFFICE_DOOR.x, y: OFFICE_DOOR.y, r: OFFICE_DOOR.r });
      } else {
        cands.push({ id: 'pc-use', label: 'Usar Computador', x: ROOM_PC.x, y: ROOM_PC.y, r: ROOM_PC.r });
        cands.push({ id: 'office-exit', label: 'Sair do Prédio', x: ROOM_EXIT.x, y: ROOM_EXIT.y, r: ROOM_EXIT.r });
      }

      let best = null;
      let bestD = Infinity;
      cands.forEach((c) => {
        const d = Phaser.Math.Distance.Between(p.x, p.y, c.x, c.y);
        if (d <= c.r && d < bestD) { best = c; bestD = d; }
      });
      if (!best) return null;
      return { id: best.id, label: best.label };
    }

    // [UX] O botão contextual é FIXO no canto inferior direito (definido no CSS).
    // Aqui só decidimos se ele aparece (perto de um objeto interativo) ou some.
    positionAction() {
      const it = this.interaction;
      TC.ui.setAction(it ? { label: it.label } : null);
    }

    handleAction() {
      const it = this.interaction;
      if (it) { this.perform(it.id); return; }
      if (this.state === 'driving') TC.ui.flash('Reduza a velocidade para sair do caminhão.');
      else if (this.indoor) TC.ui.flash('Aproxime-se do computador ou da porta.');
      else TC.ui.flash('Chegue perto da porta do caminhão ou do escritório.');
    }

    perform(id) {
      switch (id) {
        case 'truck-exit': this.tryExit(); break;
        case 'truck-enter': this.tryEnter(); break;
        case 'office-enter': this.enterBuilding(); break;
        case 'office-exit': this.exitBuilding(); break;
        case 'pc-use': this.openComputer(); break;
        default: break;
      }
    }

    /* ---------------- ENTRAR / SAIR DO CAMINHÃO (Fase 1) ---------------- */
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
      this.state = 'driving';
      this.p.setVisible(false);
      this.clearTarget();
      this.cameras.main.startFollow(this.truckView, true, 0.08, 0.08);
      TC.ui.setDriving(true);
    }

    /* ---------------- ESCRITÓRIO: ENTRAR / SAIR (transição com fade) ---------------- */
    enterBuilding() {
      this.busy = true;
      this.clearTarget();
      const cam = this.cameras.main;
      cam.fadeOut(220, 0, 0, 0);
      this.time.delayedCall(240, () => {
        this.indoor = true;
        this.p.setPosition(ROOM_SPAWN.x, ROOM_SPAWN.y);
        this.p.rotation = -Math.PI / 2; // entrou olhando para o fundo da sala
        cam.stopFollow();
        cam.removeBounds();
        cam.setBackgroundColor('#0d1117');
        this.applyZoom();
        TC.ui.resetInputs();
        cam.fadeIn(260, 0, 0, 0);
        this.busy = false;
      });
    }

    exitBuilding() {
      this.busy = true;
      this.clearTarget();
      const cam = this.cameras.main;
      cam.fadeOut(220, 0, 0, 0);
      this.time.delayedCall(240, () => {
        this.indoor = false;
        this.p.setPosition(OFFICE_EXIT.x, OFFICE_EXIT.y);
        this.p.rotation = Math.PI / 2; // saiu olhando para a rua
        cam.setBackgroundColor('rgba(0,0,0,0)');
        cam.setBounds(0, 0, WORLD.w, WORLD.h);
        this.applyZoom();
        cam.centerOn(this.p.x, this.p.y);
        cam.startFollow(this.p, true, 0.08, 0.08);
        TC.ui.resetInputs();
        cam.fadeIn(260, 0, 0, 0);
        this.busy = false;
      });
    }

    /* ---------------- COMPUTADOR ---------------- */
    openComputer() {
      this.uiOpen = true;
      this.clearTarget();
      this.input.keyboard.enabled = false; // WASD/E não mexem no jogo enquanto o sistema está aberto
      TC.ui.resetInputs();
      TC.pc.open(() => {
        this.uiOpen = false;
        this.input.keyboard.enabled = true;
        this.input.keyboard.resetKeys();
        TC.consumeAction();
      });
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

      let line;
      if (this.indoor) {
        line = 'Escritório';
        status = '';
      } else if (this.state === 'driving') {
        const kmh = Math.round(Math.abs(t.speed) / 4);
        const gear = t.speed < -1 ? 'R' : Math.abs(t.speed) < 1 ? 'N' : 'D';
        const steerDeg = Math.round(Phaser.Math.RadToDeg(t.steer));
        line = kmh + ' km/h · ' + gear + ' · ' + steerDeg + '°';
      } else {
        line = 'A pé';
      }
      TC.ui.setHud(line, status);

      this.positionAction();
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
