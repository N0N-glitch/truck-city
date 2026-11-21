/* ============================================================
   TRUCK CITY - art.js  (Fase 3)
   Configuração de layout e funções que DESENHAM as texturas
   (cidade, escritório, árvore, sala, rodovia, distrito).
   Tudo é desenhado uma única vez e vira textura (otimização).
   ============================================================ */
(function () {
  'use strict';

  const TC = window.TC;

  /* ================= LAYOUT COMPARTILHADO ================= */
  const cfg = {
    city: { w: 2000, h: 2000 },
    sidewalk: 36,
    roads: [
      { x: 0,    y: 900, w: 2000, h: 200 },
      { x: 900,  y: 0,   w: 200,  h: 2000 },
      { x: 0,    y: 300, w: 2000, h: 160 },
      { x: 1600, y: 0,   w: 160,  h: 2000 },
    ],
    hedges: [
      { x: 1140, y: 540, w: 22, h: 210 },
      { x: 1538, y: 540, w: 22, h: 210 },
    ],
    office: { x: 1170, y: 520, w: 360, h: 250 },
    room: { x: 2400, y: 200, w: 800, h: 560 },
    // Rodovia: pista de 512 px (acostamento 64 + 4 pistas de 96 + acostamento 64)
    br: { w: 1200, h: 4800, roadX: 344, roadW: 512, shoulder: 64 },
    district: { w: 1600, h: 1600 },
  };
  TC.cfg = cfg;

  const WORLD = cfg.city;
  const SIDEWALK = cfg.sidewalk;
  const ROADS = cfg.roads;
  const HEDGES = cfg.hedges;
  const OFFICE = cfg.office;
  const ROOM = cfg.room;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ================= CIDADE ================= */
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

    // [Fase 3] Saídas para a BR-116 (sul): setas pintadas + linha de transição
    [[1000, 100], [1680, 80]].forEach((p) => {
      const cx = p[0], w = p[1];
      g.fillStyle(0xffd400, 0.55);
      g.fillRect(cx - w, 1922, w * 2, 6);
      g.fillStyle(0xffffff, 0.85);
      for (let k = 0; k < 3; k++) {
        const y = 1700 + k * 70;
        g.fillTriangle(cx, y + 46, cx - 24, y, cx + 24, y);
        g.fillRect(cx - 7, y - 26, 14, 28);
      }
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

  /* ================= TEXTURAS DE PISO (ladrilhos 128x128) ================= */
  function drawGrassTile(g) {
    const rnd = mulberry32(3);
    g.fillStyle(0x3b6e41, 1);
    g.fillRect(0, 0, 128, 128);
    g.fillStyle(0x376a3d, 1);
    g.fillRect(0, 0, 64, 64);
    g.fillRect(64, 64, 64, 64);
    for (let i = 0; i < 70; i++) {
      g.fillStyle(rnd() < 0.5 ? 0x4b8650 : 0x2f5e35, 0.55);
      g.fillRect(Math.floor(rnd() * 126), Math.floor(rnd() * 126), 3, 3);
    }
  }

  function drawAsphaltTile(g) {
    const rnd = mulberry32(8);
    g.fillStyle(0x33343b, 1);
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 160; i++) {
      g.fillStyle(rnd() < 0.5 ? 0x3e3f46 : 0x2b2c31, 0.7);
      g.fillRect(Math.floor(rnd() * 126), Math.floor(rnd() * 126), 2, 2);
    }
  }

  function drawConcreteTile(g) {
    const rnd = mulberry32(21);
    g.fillStyle(0xa3a29b, 1);
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 120; i++) {
      g.fillStyle(rnd() < 0.5 ? 0xb1b0a9 : 0x93928b, 0.6);
      g.fillRect(Math.floor(rnd() * 126), Math.floor(rnd() * 126), 3, 2);
    }
    g.lineStyle(2, 0x8a8981, 1);
    g.strokeRect(1, 1, 126, 126);
  }

  /* ================= RODOVIA BR-116 ================= */
  // Ladrilho da pista 512x256: acostamento + 4 pistas + faixa dupla amarela
  function drawHighwayTile(g) {
    const W = 512, H = 256, SH = 64;
    const rnd = mulberry32(7);

    // asfalto base e acostamentos (mais claros)
    g.fillStyle(0x34353b, 1);
    g.fillRect(0, 0, W, H);
    g.fillStyle(0x4b4c53, 1);
    g.fillRect(0, 0, SH, H);
    g.fillRect(W - SH, 0, SH, H);

    // granulação do asfalto
    for (let i = 0; i < 520; i++) {
      g.fillStyle(rnd() < 0.5 ? 0x3e3f46 : 0x2b2c31, 0.65);
      g.fillRect(Math.floor(rnd() * W), Math.floor(rnd() * H), 2, 2);
    }

    // trilhas de pneu em cada pista
    g.fillStyle(0x000000, 0.12);
    [112, 208, 304, 400].forEach((c) => {
      g.fillRect(c - 24, 0, 10, H);
      g.fillRect(c + 14, 0, 10, H);
    });

    // manchas de óleo
    for (let i = 0; i < 5; i++) {
      g.fillStyle(0x000000, 0.14);
      g.fillEllipse(80 + rnd() * 350, 30 + rnd() * 190, 16 + rnd() * 12, 26 + rnd() * 14);
    }

    // ranhuras sonoras no acostamento
    g.fillStyle(0x24252a, 0.9);
    for (let y = 4; y < H; y += 16) {
      g.fillRect(SH - 16, y, 10, 5);
      g.fillRect(W - SH + 6, y, 10, 5);
    }

    // linhas de borda (brancas contínuas)
    g.fillStyle(0xf2f2f2, 1);
    g.fillRect(SH - 2, 0, 4, H);
    g.fillRect(W - SH - 2, 0, 4, H);

    // divisórias tracejadas entre pistas do mesmo sentido
    [160, 352].forEach((x) => {
      for (let y = 0; y < H; y += 128) g.fillRect(x - 2, y, 4, 64);
    });

    // faixa dupla amarela central
    g.fillStyle(0xe8c93a, 1);
    g.fillRect(250, 0, 4, H);
    g.fillRect(258, 0, 4, H);
  }

  // Defensa metálica vista de cima (16x128)
  function drawRailTile(g) {
    g.fillStyle(0x000000, 0.25);
    g.fillRect(10, 0, 6, 128);
    g.fillStyle(0xc7ccd3, 1);
    g.fillRect(4, 0, 7, 128);
    g.fillStyle(0xe6eaef, 1);
    g.fillRect(5, 0, 2, 128);
    g.fillStyle(0x7d848d, 1);
    g.fillRect(2, 56, 12, 8);
    g.fillStyle(0xd35a2a, 1);
    g.fillRect(6, 58, 4, 3);
  }

  /* ================= DISTRITO INDUSTRIAL ================= */
  // Galpão 440x280: telhado em chapas + fachada com docas
  function drawWarehouse(g) {
    const W = 440, H = 280, roofH = 224;

    g.fillStyle(0x000000, 0.25);
    g.fillRect(10, 12, W - 12, H - 14);

    // fachada frontal
    g.fillStyle(0xcfd3d8, 1);
    g.fillRect(0, roofH, W - 8, H - roofH - 8);
    g.fillStyle(0xaeb4bb, 1);
    g.fillRect(0, H - 14, W - 8, 6);

    // portas de doca
    for (let i = 0; i < 4; i++) {
      const dx = 30 + i * 98;
      g.fillStyle(0x2c3036, 1);
      g.fillRect(dx - 3, roofH + 4, 76, 42);
      g.fillStyle(0xe67e22, 1);
      g.fillRect(dx, roofH + 7, 70, 36);
      g.fillStyle(0x000000, 0.18);
      for (let k = 1; k < 6; k++) g.fillRect(dx, roofH + 7 + k * 6, 70, 1);
    }

    // telhado
    g.fillStyle(0x7e8ea0, 1);
    g.fillRect(0, 0, W - 8, roofH);
    g.lineStyle(1, 0x6b7b8d, 1);
    for (let x = 12; x < W - 12; x += 18) g.lineBetween(x, 6, x, roofH - 6);
    g.lineStyle(6, 0x5d6b7a, 1);
    g.strokeRect(3, 3, W - 14, roofH - 6);

    // claraboias
    [50, 180, 310].forEach((sx) => {
      g.fillStyle(0x2e3b4c, 1);
      g.fillRect(sx, 30, 80, 40);
      g.fillStyle(0xa5d8ee, 1);
      g.fillRect(sx + 4, 34, 72, 32);
      g.fillStyle(0xe0f4fb, 0.6);
      g.fillTriangle(sx + 4, 34, sx + 40, 34, sx + 4, 62);
    });

    // equipamentos de ar
    [[60, 150], [320, 150]].forEach((p) => {
      g.fillStyle(0xcfd6df, 1);
      g.fillRect(p[0], p[1], 56, 40);
      g.lineStyle(2, 0x8c97a6, 1);
      g.strokeRect(p[0], p[1], 56, 40);
      g.fillStyle(0x5f6b7a, 1);
      g.fillCircle(p[0] + 28, p[1] + 20, 14);
      g.fillStyle(0x3d4652, 1);
      g.fillCircle(p[0] + 28, p[1] + 20, 4);
    });
  }

  TC.art = {
    mulberry32: mulberry32,
    drawGround: drawGround,
    drawOfficeTexture: drawOfficeTexture,
    drawTree: drawTree,
    drawRoom: drawRoom,
    drawGrassTile: drawGrassTile,
    drawAsphaltTile: drawAsphaltTile,
    drawConcreteTile: drawConcreteTile,
    drawHighwayTile: drawHighwayTile,
    drawRailTile: drawRailTile,
    drawWarehouse: drawWarehouse,
  };
})();
