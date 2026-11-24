/* ============================================================
   TRUCK CITY - art2.js  (Fase 4A)
   Texturas novas desenhadas uma única vez (otimização):
   terra, canteiro de obras, guindaste, pedreira e serraria.
   Depende de art.js (usa TC.art.mulberry32).
   ============================================================ */
(function () {
  'use strict';

  const TC = window.TC;
  const rng = TC.art.mulberry32;

  // Faixa zebrada (amarelo/preto) na borda de uma textura
  function hazard(g, x, y, w, h) {
    for (let i = 0; i < w / 20; i++) {
      g.fillStyle(i % 2 ? 0x1c1c1c : 0xf2c200, 1);
      g.fillRect(x + i * 20, y, 20, h);
    }
  }

  /* ---------- Terra batida (ladrilho 128x128) ---------- */
  function drawDirtTile(g) {
    const r = rng(17);
    g.fillStyle(0x8c6e4b, 1);
    g.fillRect(0, 0, 128, 128);
    g.fillStyle(0x82643f, 1);
    g.fillRect(0, 0, 64, 64);
    g.fillRect(64, 64, 64, 64);
    for (let i = 0; i < 90; i++) {
      g.fillStyle(r() < 0.5 ? 0x9d805a : 0x6f5436, 0.6);
      g.fillRect(Math.floor(r() * 125), Math.floor(r() * 125), 3, 2);
    }
    for (let i = 0; i < 10; i++) {
      g.fillStyle(0x6a6a66, 0.7);
      g.fillCircle(r() * 124 + 2, r() * 124 + 2, 1.6);
    }
  }

  /* ---------- Canteiro de obras da Nova Cidade (640x420) ---------- */
  function drawSite(g) {
    const W = 640, H = 420;

    // terreno compactado
    g.fillStyle(0x9a7b55, 1);
    g.fillRect(0, 0, W, H);
    g.fillStyle(0x8a6c49, 0.5);
    for (let y = 0; y < H; y += 40) g.fillRect(0, y, W, 2);

    // fundações escavadas (3 poços com armação)
    [[40, 50, 150, 110], [230, 50, 170, 110], [440, 50, 160, 110]].forEach((p) => {
      g.fillStyle(0x3f2f20, 1);
      g.fillRect(p[0] - 6, p[1] - 6, p[2] + 12, p[3] + 12);
      g.fillStyle(0x5d4733, 1);
      g.fillRect(p[0], p[1], p[2], p[3]);
      g.lineStyle(2, 0x9aa1a9, 0.75);
      for (let x = p[0] + 14; x < p[0] + p[2]; x += 22) g.lineBetween(x, p[1] + 6, x, p[1] + p[3] - 6);
      for (let y = p[1] + 14; y < p[1] + p[3]; y += 22) g.lineBetween(p[0] + 6, y, p[0] + p[2] - 6, y);
    });

    // laje de concreto com paredes de tijolo em andamento
    g.fillStyle(0xb9b9b3, 1);
    g.fillRect(40, 210, 250, 120);
    g.fillStyle(0xb5543a, 1);
    g.fillRect(40, 210, 250, 10);
    g.fillRect(40, 210, 10, 120);
    g.fillRect(150, 210, 8, 60);
    g.fillStyle(0x8f9aa5, 1);
    [[40, 320], [280, 210], [280, 320], [160, 270]].forEach((c) => g.fillRect(c[0], c[1], 10, 10));

    // andaimes
    g.lineStyle(3, 0x3a3f46, 1);
    g.strokeRect(330, 210, 270, 120);
    g.lineStyle(2, 0xe0a52b, 1);
    for (let x = 330; x <= 600; x += 30) g.lineBetween(x, 210, x, 330);
    for (let y = 210; y <= 330; y += 30) g.lineBetween(330, y, 600, y);

    // escritório do canteiro
    g.fillStyle(0x000000, 0.25);
    g.fillRect(488, 358, 120, 50);
    g.fillStyle(0xf2f2f2, 1);
    g.fillRect(480, 350, 120, 50);
    g.fillStyle(0x3b82f6, 1);
    g.fillRect(480, 350, 120, 14);
    g.fillStyle(0x5b3a26, 1);
    g.fillRect(560, 372, 20, 28);

    // pilha de areia e de tijolos
    g.fillStyle(0xd9c07a, 1);
    g.fillEllipse(110, 372, 96, 56);
    g.fillStyle(0xe7d28f, 1);
    g.fillEllipse(100, 364, 54, 30);
    g.fillStyle(0xb5543a, 1);
    for (let k = 0; k < 3; k++) g.fillRect(230 + k * 36, 360, 30, 26);

    // cones nos cantos
    g.fillStyle(0xff7a1a, 1);
    [[10, 10], [W - 24, 10], [10, H - 24], [W - 24, H - 24]].forEach((c) => g.fillTriangle(c[0] + 7, c[1], c[0], c[1] + 14, c[0] + 14, c[1] + 14));

    // cerca de proteção
    g.lineStyle(6, 0x5b5f66, 1);
    g.strokeRect(3, 3, W - 6, H - 6);
    g.fillStyle(0x3a3d42, 1);
    for (let x = 0; x < W; x += 40) {
      g.fillRect(x, 0, 6, 10);
      g.fillRect(x, H - 10, 6, 10);
    }
  }

  /* ---------- Guindaste (vista de cima) 220x220 ---------- */
  function drawCrane(g) {
    g.fillStyle(0x000000, 0.22);
    g.fillRect(16, 112, 196, 12);
    g.fillRect(100, 104, 24, 24);
    // contra-lança e lança
    g.fillStyle(0xf2c200, 1);
    g.fillRect(14, 104, 98, 9);
    g.fillRect(108, 104, 100, 9);
    g.lineStyle(1, 0x8a6d00, 1);
    for (let x = 18; x < 206; x += 12) g.lineBetween(x, 104, x + 6, 113);
    // contrapeso, torre, cabine, carrinho e gancho
    g.fillStyle(0x6b727a, 1);
    g.fillRect(18, 100, 22, 17);
    g.fillStyle(0x3a3f46, 1);
    g.fillRect(98, 98, 26, 26);
    g.fillStyle(0xf2f2f2, 1);
    g.fillRect(114, 90, 16, 14);
    g.fillStyle(0x1b2a3a, 1);
    g.fillRect(124, 93, 5, 8);
    g.fillStyle(0xd0d3d7, 1);
    g.fillRect(168, 102, 14, 13);
    g.fillStyle(0xd62f2f, 1);
    g.fillCircle(176, 109, 5);
  }

  /* ---------- Pedreira (700x280): cava em terraços ---------- */
  function drawQuarry(g) {
    const W = 700, H = 280;
    g.fillStyle(0x8f8b84, 1);
    g.fillRect(0, 0, W, H);

    // cava em terraços
    [[560, 220, 0x7d7973], [470, 178, 0x6e6a64], [380, 136, 0x5f5b56], [290, 96, 0x504d49], [190, 56, 0x3f3d3a]].forEach((e) => {
      g.fillStyle(e[2], 1);
      g.fillEllipse(360, 120, e[0], e[1]);
    });

    // correia transportadora e pilhas de brita
    g.lineStyle(10, 0x3b3b3b, 1);
    g.lineBetween(250, 150, 90, 225);
    g.fillStyle(0xb0aca4, 1);
    g.fillCircle(76, 232, 42);
    g.fillCircle(650, 228, 38);
    g.fillStyle(0xc4c0b8, 1);
    g.fillCircle(70, 224, 24);
    g.fillCircle(644, 220, 22);

    // escavadeira
    g.fillStyle(0x1c1c1c, 1);
    g.fillRect(584, 54, 62, 9);
    g.fillRect(584, 96, 62, 9);
    g.fillStyle(0xf2b705, 1);
    g.fillRect(590, 62, 50, 36);
    g.fillStyle(0x1b2a3a, 1);
    g.fillRect(622, 68, 12, 24);
    g.lineStyle(8, 0xe0a300, 1);
    g.lineBetween(590, 80, 538, 52);
    g.fillStyle(0x555555, 1);
    g.fillRect(526, 44, 16, 16);

    hazard(g, 0, H - 10, W, 10);
  }

  /* ---------- Serraria (700x280) ---------- */
  function drawSawmill(g) {
    const W = 700, H = 280;
    g.fillStyle(0xa58a63, 1);
    g.fillRect(0, 0, W, H);

    // galpão principal (telhado de telha)
    g.fillStyle(0x000000, 0.22);
    g.fillRect(36, 36, 230, 120);
    g.fillStyle(0x8a5a3b, 1);
    g.fillRect(30, 30, 230, 120);
    g.lineStyle(1, 0x6c4429, 1);
    for (let x = 40; x < 260; x += 14) g.lineBetween(x, 32, x, 148);
    g.fillStyle(0x6c4429, 1);
    g.fillRect(30, 86, 230, 6);

    // galpão de secagem (chapa metálica)
    g.fillStyle(0x6f7f8a, 1);
    g.fillRect(290, 40, 150, 110);
    g.lineStyle(1, 0x55646e, 1);
    for (let y = 46; y < 150; y += 12) g.lineBetween(292, y, 438, y);
    g.lineStyle(3, 0x4a5760, 1);
    g.strokeRect(290, 40, 150, 110);

    // pilha de toras (vistas de topo)
    for (let row = 0; row < 4; row++) {
      for (let c = 0; c < 6 - (row % 2); c++) {
        const cx = 480 + c * 24 + (row % 2) * 12;
        const cy = 50 + row * 22;
        g.fillStyle(0x7a4d28, 1);
        g.fillCircle(cx, cy, 11);
        g.fillStyle(0xc79a62, 1);
        g.fillCircle(cx, cy, 8);
        g.lineStyle(1, 0x7a4d28, 1);
        g.strokeCircle(cx, cy, 4);
      }
    }

    // madeira serrada empilhada
    g.fillStyle(0xd6b27a, 1);
    g.fillRect(40, 190, 200, 50);
    g.lineStyle(1, 0x9a7a45, 1);
    for (let x = 48; x < 240; x += 9) g.lineBetween(x, 190, x, 240);

    // serra de bancada
    g.fillStyle(0x8c949c, 1);
    g.fillRect(300, 190, 150, 30);
    g.fillStyle(0xdfe3e8, 1);
    g.fillCircle(375, 205, 18);
    g.fillStyle(0x4a4f55, 1);
    g.fillCircle(375, 205, 4);

    hazard(g, 0, H - 10, W, 10);
  }

  TC.art2 = {
    drawDirtTile: drawDirtTile,
    drawSite: drawSite,
    drawCrane: drawCrane,
    drawQuarry: drawQuarry,
    drawSawmill: drawSawmill,
  };
})();
