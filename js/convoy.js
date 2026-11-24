/* ============================================================
   TRUCK CITY - convoy.js  (Fase 4C)
   Comboio VISUAL: os caminhões da frota seguem o seu por "waypoints"
   (pontos gravados do caminho que o seu caminhão percorreu).
   - não usa IA nem colisão: cada seguidor só lê um ponto da trilha
   - atravessa teleportes (a trilha é refeita atrás do caminhão)
   - fica parado quando você sai do caminhão ou dá ré
   Carrega DEPOIS do game.js: embrulha o TC.startGame para achar a cena.
   ============================================================ */
(function () {
  'use strict';

  const TC = window.TC;
  const S = TC.store;

  const GAP = 190;        // distância entre caminhões (px, centro a centro)
  const STEP = 6;         // distância mínima entre dois pontos gravados (px)
  const MAX_POINTS = 320; // tamanho máximo da trilha

  let scene = null;
  let segId = null;
  let total = 0;          // distância total gravada (cresce conforme o caminhão anda)
  const trail = [];       // pontos { x, y, d }
  const followers = [];   // sprites { img, key }

  // Textura do caminhão seguidor (visto de cima, apontando para +x)
  function textureFor(color) {
    const key = 'fleet-truck-' + color.slice(1);
    if (scene.textures.exists(key)) return key;
    const base = Phaser.Display.Color.HexStringToColor(color).color;
    const dark = Phaser.Display.Color.HexStringToColor(color).darken(32).color;
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x000000, 0.25);
    g.fillRect(7, 8, 140, 54);
    g.fillStyle(0xc4cad1, 1);               // baú
    g.fillRect(4, 4, 92, 54);
    g.lineStyle(2, 0x6b7480, 1);
    g.strokeRect(4, 4, 92, 54);
    g.fillStyle(base, 1);                   // cabine
    g.fillRect(98, 6, 46, 50);
    g.lineStyle(2, dark, 1);
    g.strokeRect(98, 6, 46, 50);
    g.fillStyle(0x1b2a3a, 1);               // para-brisa
    g.fillRect(126, 11, 12, 40);
    g.fillStyle(0xfff3a0, 1);               // faróis
    g.fillRect(142, 9, 3, 9);
    g.fillRect(142, 44, 3, 9);
    g.fillStyle(0x0b0b0b, 1);               // rodas
    g.fillRect(18, 0, 22, 8);
    g.fillRect(18, 54, 22, 8);
    g.fillRect(108, 0, 22, 8);
    g.fillRect(108, 54, 22, 8);
    g.generateTexture(key, 148, 62);
    g.destroy();
    return key;
  }

  // Refaz a trilha em linha reta ATRÁS do caminhão (início e depois de teleportes)
  function rebuild(t) {
    trail.length = 0;
    const n = Math.ceil((5 * GAP + 120) / STEP);
    const cos = Math.cos(t.heading);
    const sin = Math.sin(t.heading);
    for (let i = n; i >= 0; i--) {
      trail.push({ x: t.cx - cos * i * STEP, y: t.cy - sin * i * STEP, d: (n - i) * STEP });
    }
    total = n * STEP;
  }

  // Grava um novo ponto quando o caminhão andou o suficiente (de ré: não grava)
  function record(t) {
    if (t.speed < -1) return;
    const last = trail[trail.length - 1];
    const dist = Math.hypot(t.cx - last.x, t.cy - last.y);
    if (dist < STEP) return;
    total += dist;
    trail.push({ x: t.cx, y: t.cy, d: total });
    if (trail.length > MAX_POINTS) trail.splice(0, 80);
  }

  // Posição e direção na trilha, a "dist" de distância gravada
  function pointAt(dist) {
    for (let i = trail.length - 1; i > 0; i--) {
      const a = trail[i - 1];
      const b = trail[i];
      if (a.d <= dist) {
        const u = (dist - a.d) / ((b.d - a.d) || 1);
        return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, a: Math.atan2(b.y - a.y, b.x - a.x) };
      }
    }
    return { x: trail[0].x, y: trail[0].y, a: 0 };
  }

  // Roda uma vez por frame, DEPOIS do update da cena (o caminhão já se moveu)
  function tick() {
    if (!scene.truck || !scene.seg || scene.teleporting) return;
    const t = scene.truck;
    if (scene.seg.id !== segId) {
      segId = scene.seg.id;
      rebuild(t);
    }
    record(t);

    const fleet = S.convoyFleet();
    const count = Math.max(fleet.length, followers.length);
    for (let k = 0; k < count; k++) {
      if (k >= fleet.length) {
        if (followers[k]) followers[k].img.setVisible(false);
        continue;
      }
      const key = textureFor(fleet[k].color);
      let f = followers[k];
      if (!f) {
        f = followers[k] = { img: scene.add.image(0, 0, key).setDepth(9.5), key: key };
      } else if (f.key !== key) {
        f.img.setTexture(key);
        f.key = key;
      }
      const p = pointAt(total - (k + 1) * GAP);
      f.img.setVisible(!scene.indoor).setPosition(p.x, p.y).setRotation(p.a);
    }
  }

  // Descobre a cena do jogo assim que ela existir
  const startGame = TC.startGame;
  TC.startGame = function () {
    startGame();
    const timer = setInterval(function () {
      const game = Phaser.GAMES[Phaser.GAMES.length - 1];
      const sc = game && game.scene && game.scene.getScene('World');
      if (sc && sc.truck && sc.seg) {
        clearInterval(timer);
        scene = sc;
        scene.events.on(Phaser.Scenes.Events.POST_UPDATE, tick);
      }
    }, 100);
  };
})();
