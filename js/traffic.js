/* ============================================================
   TRUCK CITY - traffic.js  (Fase 4A)
   Tráfego de carros NPC na BR.
   - Os veículos nascem FORA da tela, andam nas pistas (mão direita)
     e somem quando ficam longe da câmera (poucos objetos = leve).
   - Cada veículo mantém distância do da frente e freia para o caminhão.
   - Cada veículo expõe um retângulo sólido para a colisão do caminhão.
   Uso: const traffic = TC.createTraffic(scene);
        traffic.setSegment(seg); traffic.update(dt, view, blockers, n);
   ============================================================ */
(function () {
  'use strict';

  const TC = window.TC;

  const MAX_CARS = 12;

  // len/w em pixels; speed = faixa de velocidade de cruzeiro (px/s)
  const KINDS = [
    { id: 'car',   len: 56,  w: 30, speed: [115, 175] },
    { id: 'van',   len: 66,  w: 33, speed: [100, 150] },
    { id: 'truck', len: 118, w: 38, speed: [80, 120] },
  ];
  const COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#ecf0f1', '#2ecc71', '#8e44ad', '#95a5a6', '#e67e22'];

  const approach = (v, target, step) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target));

  function shade(hex, amount) {
    const c = Phaser.Display.Color.HexStringToColor(hex);
    return (amount >= 0 ? c.brighten(amount) : c.darken(-amount)).color;
  }

  // Desenha um veículo apontando para +x (a rotação é aplicada no sprite)
  function drawVehicle(g, kind, hex) {
    const L = kind.len, W = kind.w, x = 4, y = 4;
    const base = shade(hex, 0);
    const dark = shade(hex, -35);
    const light = shade(hex, 22);

    g.fillStyle(0x000000, 0.25);
    g.fillRoundedRect(x + 3, y + 4, L, W, 8);

    // rodas
    g.fillStyle(0x0b0b0b, 1);
    const wheels = kind.id === 'truck' ? [10, 32, L - 26] : [10, L - 24];
    wheels.forEach((wx) => {
      g.fillRect(x + wx, y - 2, 14, 5);
      g.fillRect(x + wx, y + W - 3, 14, 5);
    });

    if (kind.id === 'truck') {
      // baú
      g.fillStyle(0xdfe3e8, 1);
      g.fillRoundedRect(x, y, L - 42, W, 4);
      g.lineStyle(2, 0x9aa1ab, 1);
      g.strokeRoundedRect(x, y, L - 42, W, 4);
      g.fillStyle(0xc4cad1, 1);
      for (let i = 1; i < 4; i++) g.fillRect(x + i * ((L - 42) / 4), y + 2, 2, W - 4);
      // cabine
      g.fillStyle(base, 1);
      g.fillRoundedRect(x + L - 40, y + 1, 40, W - 2, 6);
      g.lineStyle(2, dark, 1);
      g.strokeRoundedRect(x + L - 40, y + 1, 40, W - 2, 6);
      g.fillStyle(0x1b2a3a, 1);
      g.fillRect(x + L - 14, y + 5, 8, W - 10);
    } else {
      const van = kind.id === 'van';
      g.fillStyle(base, 1);
      g.fillRoundedRect(x, y, L, W, 8);
      g.lineStyle(2, dark, 1);
      g.strokeRoundedRect(x, y, L, W, 8);
      // teto
      g.fillStyle(light, 1);
      g.fillRoundedRect(x + L * (van ? 0.1 : 0.26), y + 4, L * (van ? 0.5 : 0.34), W - 8, 4);
      // vidros
      g.fillStyle(0x1b2a3a, 1);
      g.fillRect(x + L * 0.62, y + 4, 9, W - 8);
      if (!van) g.fillRect(x + L * 0.16, y + 5, 6, W - 10);
    }

    // faróis e lanternas
    g.fillStyle(0xfff3a0, 1);
    g.fillRect(x + L - 3, y + 4, 3, 6);
    g.fillRect(x + L - 3, y + W - 10, 3, 6);
    g.fillStyle(0xff3030, 1);
    g.fillRect(x, y + 3, 3, 6);
    g.fillRect(x, y + W - 9, 3, 6);
  }

  function ensureTextures(scene) {
    KINDS.forEach((k) => {
      COLORS.forEach((c, i) => {
        const key = 'veh-' + k.id + '-' + i;
        if (scene.textures.exists(key)) return;
        const g = scene.make.graphics({ x: 0, y: 0, add: false });
        drawVehicle(g, k, c);
        g.generateTexture(key, k.len + 8, k.w + 8);
        g.destroy();
      });
    });
  }

  TC.createTraffic = function (scene) {
    ensureTextures(scene);

    const active = [];  // veículos em cena
    const pool = [];    // sprites reaproveitados
    const solids = [];  // retângulos sólidos (lidos pelo game.js)
    let seg = null;     // segmento atual (precisa ter seg.traffic = lista de faixas)
    let timer = 0.5;

    function release(car) {
      car.img.setVisible(false);
      pool.push(car.img);
    }

    function clear() {
      active.forEach(release);
      active.length = 0;
      solids.length = 0;
    }

    // Cria um veículo fora da tela (acima ou abaixo da câmera). Devolve true se criou.
    function spawn(view) {
      const lane = seg.traffic[Math.floor(Math.random() * seg.traffic.length)];
      const r = Math.random();
      const kind = KINDS[r < 0.6 ? 0 : r < 0.84 ? 1 : 2];

      const y = Math.random() < 0.5
        ? view.y - 140 - Math.random() * 140
        : view.bottom + 140 + Math.random() * 140;
      if (y < seg.oy + 60 || y > seg.oy + seg.h - 60) return false; // fora da pista

      for (let i = 0; i < active.length; i++) {
        if (active[i].lane === lane && Math.abs(active[i].y - y) < 280) return false; // faixa ocupada
      }

      const x = seg.ox + lane.x + (Math.random() - 0.5) * 8;
      const key = 'veh-' + kind.id + '-' + Math.floor(Math.random() * COLORS.length);
      let img = pool.pop();
      if (img) img.setTexture(key).setVisible(true);
      else img = scene.add.image(0, 0, key).setDepth(9);
      img.setPosition(x, y).setRotation(lane.dir > 0 ? Math.PI / 2 : -Math.PI / 2);

      const base = kind.speed[0] + Math.random() * (kind.speed[1] - kind.speed[0]);
      const car = {
        img: img, lane: lane, dir: lane.dir, x: x, y: y,
        len: kind.len, w: kind.w, base: base, speed: base, stun: 0,
        solid: { x: x - kind.w / 2, y: y - kind.len / 2, w: kind.w, h: kind.len, cx: x, cy: y, r: Math.hypot(kind.w, kind.len) / 2, car: null },
      };
      car.solid.car = car;
      active.push(car);
      return true;
    }

    // blockers = [{ x, y, r (meio comprimento), hw (meia largura) }], n = quantos valem
    function update(dt, view, blockers, n) {
      if (!seg) return;

      timer -= dt;
      if (timer <= 0 && active.length < MAX_CARS) {
        timer = spawn(view) ? 0.7 + Math.random() * 1.1 : 0.25;
      }

      solids.length = 0;
      for (let i = active.length - 1; i >= 0; i--) {
        const c = active[i];

        // menor distância livre até algo à frente na mesma faixa
        let gap = 1e9;
        let aheadSpeed = 0;
        for (let k = 0; k < active.length; k++) {
          const o = active[k];
          if (o === c || o.lane !== c.lane) continue;
          const d = (o.y - c.y) * c.dir - (o.len + c.len) / 2;
          if (d > -4 && d < gap) { gap = d; aheadSpeed = o.speed; }
        }
        for (let k = 0; k < n; k++) {
          const b = blockers[k];
          if (Math.abs(b.x - c.x) > c.w / 2 + b.hw + 8) continue; // outra faixa
          const d = (b.y - c.y) * c.dir - c.len / 2 - b.r;
          if (d > -4 && d < gap) { gap = d; aheadSpeed = 0; }
        }

        // velocidade desejada: cruzeiro, ou freia conforme a distância
        let target = c.base;
        if (gap < 170) target = Math.min(target, Math.max(0, aheadSpeed + (gap - 36) * 1.5));
        if (c.stun > 0) { c.stun -= dt; target = 0; }
        c.speed = approach(c.speed, target, (target < c.speed ? 300 : 80) * dt);
        c.y += c.dir * c.speed * dt;

        // some quando fica longe da câmera ou sai da pista
        if (c.y < view.y - 1000 || c.y > view.bottom + 1000 || c.y < seg.oy - 150 || c.y > seg.oy + seg.h + 150) {
          release(c);
          active.splice(i, 1);
          continue;
        }

        c.img.setPosition(c.x, c.y);
        const s = c.solid;
        s.x = c.x - c.w / 2;
        s.y = c.y - c.len / 2;
        s.cx = c.x;
        s.cy = c.y;
        solids.push(s);
      }
    }

    return {
      solids: solids,
      setSegment: function (s) {
        clear();
        seg = s && s.traffic ? s : null;
        timer = 0.3;
      },
      update: update,
      // Veículo atingido: para por um instante
      hit: function (car) {
        car.stun = 1.4;
        car.speed = 0;
      },
    };
  };
})();
