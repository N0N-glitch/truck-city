/* ============================================================
   TRUCK CITY - basement.js  (Atualização 4.0)
   Easter egg do porão e história do morador de rua.
   Não altera o game.js: acopla-se à cena (como o comboio) e
   sobrescreve, só nesta instância, os métodos de interação e câmera.
   - entrada secreta: parede de trás (norte) do escritório
   - porão escuro (precisa de lanterna), NPC e diálogo com escolha
   - casinha que aparece no mapa quando a história termina
   Carrega DEPOIS do game.js (embrulha o TC.startGame).
   ============================================================ */
(function () {
  'use strict';

  const TC = window.TC;
  const S = TC.store;
  const clamp = Phaser.Math.Clamp;

  /* ---------- LAYOUT ---------- */
  // O porão fica numa região distante da mesma cena (como a sala do escritório)
  const B = { x: 30000, y: 200, w: 800, h: 560 };
  const SPAWN = { x: B.x + 400, y: B.y + 470 };
  const STAIRS = { x: B.x + 400, y: B.y + 520, r: 64 };
  const NPC_POS = { x: B.x + 400, y: B.y + 150 };
  const WALK = { x0: B.x + 40, y0: B.y + 76, x1: B.x + B.w - 40, y1: B.y + 530 };
  const P_RADIUS = 11;

  // entrada secreta: encostar na parede norte do escritório (no meio)
  const WALL = { x: 1350, y: 508, r: 40 };
  const WALL_EXIT = { x: 1350, y: 494 };

  // casinha: na praça, ao lado da entrada do escritório
  const HOUSE = { x: 1416, y: 776, w: 96, h: 84, solid: { x: 1420, y: 780, w: 88, h: 76 }, npc: { x: 1398, y: 846 } };

  // obstáculos do porão (x, y, w, h locais)
  const SHELVES = [[40, 80, 150, 50], [610, 80, 150, 50]];
  const CRATES = [[50, 300, 90, 60], [60, 380, 70, 50]];
  const BARRELS = [[660, 350], [700, 400]];
  const SOFA = [560, 210, 120, 50];

  /* ---------- ESTADO ---------- */
  let scene = null;
  let inBase = false;
  let officeSolids = null;
  let dark = null;
  let npc = null;
  let house = null;
  let noticeUntil = 0;
  const bSolids = [];

  const pcEl = document.getElementById('pc-ui');
  const dlg = {
    root: document.getElementById('dlg'),
    name: document.getElementById('dlg-name'),
    text: document.getElementById('dlg-text'),
    choices: document.getElementById('dlg-choices'),
    hint: document.getElementById('dlg-hint'),
    steps: [], i: -1, onEnd: null, open: false, openedAt: 0,
  };

  /* ============================================================
     ARTE (desenhada uma única vez e vira textura)
     ============================================================ */
  function makeTex(key, w, h, drawFn) {
    if (scene.textures.exists(key)) return;
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    drawFn(g);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  function drawBasement(g) {
    const W = B.w, H = B.h;
    const rnd = TC.art.mulberry32(77);

    // piso de concreto com manchas
    g.fillStyle(0x4a4b50, 1);
    g.fillRect(0, 0, W, H);
    g.lineStyle(1, 0x3a3b40, 1);
    for (let x = 0; x <= W; x += 80) g.lineBetween(x, 70, x, H);
    for (let y = 70; y <= H; y += 80) g.lineBetween(0, y, W, y);
    for (let i = 0; i < 40; i++) {
      g.fillStyle(0x000000, 0.12 + rnd() * 0.1);
      g.fillEllipse(30 + rnd() * (W - 60), 90 + rnd() * (H - 140), 20 + rnd() * 50, 12 + rnd() * 30);
    }

    // paredes de tijolo (fundo, laterais e inferior com abertura da escada)
    const brick = (x0, y0, w, h) => {
      g.fillStyle(0x5a3a30, 1);
      g.fillRect(x0, y0, w, h);
      g.lineStyle(1, 0x3b241d, 1);
      for (let y = y0, r = 0; y < y0 + h; y += 14, r++) {
        g.lineBetween(x0, y, x0 + w, y);
        for (let x = x0 + (r % 2 ? 0 : 20); x < x0 + w; x += 40) g.lineBetween(x, y, x, Math.min(y + 14, y0 + h));
      }
    };
    brick(0, 0, W, 70);
    brick(0, 70, 30, H - 70);
    brick(W - 30, 70, 30, H - 70);
    brick(0, H - 30, 360, 30);
    brick(440, H - 30, 360, 30);

    // degraus da escada (saída)
    for (let i = 0; i < 5; i++) {
      const c = 0x7a7a80 - i * 0x0a0a0a;
      g.fillStyle(c, 1);
      g.fillRect(360, H - 30 + i * 6, 80, 6);
    }

    // canos no teto e lâmpada apagada
    g.lineStyle(8, 0x6e757c, 1);
    g.lineBetween(0, 28, W, 28);
    g.lineStyle(5, 0x8a7355, 1);
    g.lineBetween(0, 48, W, 48);
    g.fillStyle(0x4d5359, 1);
    for (let x = 70; x < W; x += 140) g.fillRect(x - 8, 20, 16, 16);
    g.fillStyle(0x777777, 1);
    g.fillCircle(400, 34, 7);

    // estantes com caixas
    SHELVES.forEach((s) => {
      g.fillStyle(0x6b4a2f, 1);
      g.fillRect(s[0], s[1], s[2], s[3]);
      g.fillStyle(0x4d3420, 1);
      g.fillRect(s[0] + 4, s[1] + 4, s[2] - 8, s[3] - 8);
      for (let i = 0; i < 5; i++) {
        g.fillStyle([0x8a6d4b, 0x9b7a50, 0x6f8a9b, 0x8b5a5a, 0xa9a28a][i % 5], 1);
        g.fillRect(s[0] + 8 + i * 28, s[1] + 8, 22, 16 + (i % 2) * 6);
        g.fillRect(s[0] + 14 + i * 26, s[1] + 28, 20, 14);
      }
    });

    // caixotes de madeira
    CRATES.forEach((c) => {
      g.fillStyle(0x8a6a43, 1);
      g.fillRect(c[0], c[1], c[2], c[3]);
      g.lineStyle(3, 0x5c4328, 1);
      g.strokeRect(c[0] + 1, c[1] + 1, c[2] - 2, c[3] - 2);
      g.lineBetween(c[0], c[1], c[0] + c[2], c[1] + c[3]);
      g.lineBetween(c[0] + c[2], c[1], c[0], c[1] + c[3]);
    });

    // barris
    BARRELS.forEach((b) => {
      g.fillStyle(0x000000, 0.25);
      g.fillCircle(b[0] + 3, b[1] + 4, 26);
      g.fillStyle(0x2c5d7a, 1);
      g.fillCircle(b[0], b[1], 26);
      g.lineStyle(3, 0x1d3f54, 1);
      g.strokeCircle(b[0], b[1], 26);
      g.strokeCircle(b[0], b[1], 15);
    });

    // sofá velho
    g.fillStyle(0x5a4a3a, 1);
    g.fillRoundedRect(SOFA[0], SOFA[1], SOFA[2], SOFA[3], 8);
    g.fillStyle(0x6c5a47, 1);
    g.fillRoundedRect(SOFA[0] + 6, SOFA[1] + 6, SOFA[2] - 12, SOFA[3] - 22, 6);

    // cantinho do morador: papelão, colchão, cobertor, panela e latas
    g.fillStyle(0xa07f55, 1);
    g.fillRect(300, 120, 70, 60);
    g.fillRect(430, 170, 60, 38);
    g.fillStyle(0xb9b3a2, 1);
    g.fillRoundedRect(340, 108, 120, 78, 8);
    g.lineStyle(2, 0x8d877a, 1);
    for (let i = 1; i < 5; i++) g.lineBetween(340, 108 + i * 15, 460, 108 + i * 15);
    g.fillStyle(0x7a5c44, 1);
    g.fillRoundedRect(358, 140, 100, 44, 6);
    g.fillStyle(0xd7d1c0, 1);
    g.fillRoundedRect(346, 114, 40, 20, 6);
    g.fillStyle(0x333333, 1);
    g.fillCircle(500, 130, 12);
    g.fillStyle(0x555555, 1);
    g.fillCircle(500, 130, 8);
    g.fillStyle(0x9aa0a6, 1);
    g.fillCircle(520, 160, 5);
    g.fillCircle(530, 168, 5);
  }

  // Textura de "escuridão": centro transparente (luz) e borda preta
  function makeLight(key, inner, outer) {
    if (scene.textures.exists(key)) return;
    const tex = scene.textures.createCanvas(key, 512, 512);
    const ctx = tex.getContext();
    const grad = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(inner, 'rgba(0,0,0,0)');
    grad.addColorStop(outer, 'rgba(0,0,0,0.97)');
    grad.addColorStop(1, 'rgba(0,0,0,0.97)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);
    tex.refresh();
  }

  // Casinha (96x84): telhado de telha e fachada com porta e janelas
  function drawHouse(g) {
    g.fillStyle(0x000000, 0.25);
    g.fillRect(8, 12, 88, 70);
    // fachada
    g.fillStyle(0xf1e6cf, 1);
    g.fillRect(4, 50, 88, 30);
    g.fillStyle(0xcdbf9f, 1);
    g.fillRect(4, 76, 88, 4);
    // porta e janelas
    g.fillStyle(0x7a4b2a, 1);
    g.fillRect(40, 54, 16, 26);
    g.fillStyle(0xe0b341, 1);
    g.fillRect(52, 68, 2, 3);
    [12, 68].forEach((x) => {
      g.fillStyle(0x3b4a5c, 1);
      g.fillRect(x, 57, 16, 16);
      g.fillStyle(0x8fcdea, 1);
      g.fillRect(x + 2, 59, 12, 12);
      g.fillStyle(0x3b4a5c, 1);
      g.fillRect(x + 7, 59, 2, 12);
    });
    // telhado
    g.fillStyle(0xb5432f, 1);
    g.fillRect(2, 4, 92, 48);
    g.lineStyle(1, 0x8e2f20, 1);
    for (let y = 10; y < 50; y += 8) g.lineBetween(2, y, 94, y);
    g.fillStyle(0x8e2f20, 1);
    g.fillRect(2, 26, 92, 4);
    g.fillStyle(0x000000, 0.2);
    g.fillRect(2, 50, 92, 4);
    // chaminé e vaso de flor
    g.fillStyle(0x8a8a8a, 1);
    g.fillRect(70, 8, 12, 14);
    g.fillStyle(0x6a6a6a, 1);
    g.fillRect(70, 8, 12, 3);
    g.fillStyle(0x2f8f4a, 1);
    g.fillCircle(20, 78, 6);
    g.fillStyle(0xf06292, 1);
    g.fillCircle(18, 76, 2);
  }

  // Figura do morador (vista de cima)
  function makeNpcFigure(x, y, depth) {
    const c = scene.add.container(x, y).setDepth(depth);
    c.add([
      scene.add.ellipse(2, 3, 34, 30, 0x000000, 0.25),
      scene.add.circle(0, 0, 15, 0x7a6a55).setStrokeStyle(2, 0x3a3226),
      scene.add.circle(0, -2, 9, 0xe0b48a),
      scene.add.rectangle(0, -8, 16, 6, 0x3b3b44),
    ]);
    return c;
  }

  /* ============================================================
     DIÁLOGO (DOM)
     ============================================================ */
  function freeze(on) {
    if (on) {
      scene.uiOpen = true;
      scene.clearTarget();
      scene.input.keyboard.enabled = false;
      TC.ui.resetInputs();
    } else {
      scene.uiOpen = false;
      scene.input.keyboard.enabled = true;
      scene.input.keyboard.resetKeys();
      TC.consumeAction();
    }
  }

  function showStep() {
    const st = dlg.steps[dlg.i];
    dlg.name.textContent = st.who || '';
    dlg.name.className = 'dlg-name ' + (st.tone || '');
    dlg.text.textContent = st.text;
    dlg.choices.classList.toggle('hidden', !st.choice);
    dlg.hint.classList.toggle('hidden', !!st.choice);
  }

  function next() {
    dlg.i++;
    if (dlg.i >= dlg.steps.length) closeDialog();
    else showStep();
  }

  function choose(value) {
    const st = dlg.steps[dlg.i];
    if (!st || !st.choice) return;
    const follow = st.onChoose(value) || [];
    dlg.steps = dlg.steps.slice(0, dlg.i + 1).concat(follow);
    next();
  }

  function runDialog(steps, onEnd) {
    if (dlg.open) return;
    dlg.open = true;
    dlg.steps = steps;
    dlg.i = -1;
    dlg.onEnd = onEnd || null;
    dlg.openedAt = performance.now();
    dlg.root.classList.remove('hidden');
    freeze(true);
    next();
  }

  function closeDialog() {
    dlg.open = false;
    dlg.root.classList.add('hidden');
    freeze(false);
    const cb = dlg.onEnd;
    dlg.onEnd = null;
    if (cb) cb();
  }

  dlg.root.addEventListener('click', (e) => {
    if (performance.now() - dlg.openedAt < 350) return; // evita o "toque duplo" ao abrir
    const b = e.target.closest('[data-ch]');
    if (b) { choose(b.dataset.ch); return; }
    const st = dlg.steps[dlg.i];
    if (st && !st.choice) next();
  });

  // teclado (captura: roda antes do Phaser)
  window.addEventListener('keydown', (e) => {
    if (!dlg.open) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    if (e.repeat || performance.now() - dlg.openedAt < 350) return;
    const st = dlg.steps[dlg.i];
    if (!st) return;
    const k = e.key.toLowerCase();
    if (st.choice) {
      if (k === 's') choose('yes');
      else if (k === 'n') choose('no');
    } else if (k === 'enter' || k === ' ' || k === 'e') {
      next();
    }
  }, true);

  /* ============================================================
     HISTÓRIA
     ============================================================ */
  function firstDialog() {
    runDialog([
      { who: 'Jogador', tone: 'me', text: 'O que você está fazendo aqui?' },
      { who: 'Morador', tone: 'npc', text: 'Não tenho casa, por isso estou aqui.' },
      { who: 'Morador', tone: 'npc', text: 'Estou vendo seu uniforme, você trabalha em uma construtora, não é?' },
      { who: 'Jogador', tone: 'me', text: 'Sim.' },
      {
        who: 'Morador', tone: 'npc', text: 'Você poderia construir uma casa para mim?', choice: true,
        onChoose: (v) => {
          if (v === 'yes') {
            S.questAccept();
            return [{ who: 'Aviso', tone: 'sys', text: 'Missões especiais desbloqueadas! Abra Contratos no computador (ou no celular) e compre os materiais na Loja. Essas missões não pagam dinheiro.' }];
          }
          S.questReport();
          return [{ who: 'Aviso', tone: 'sys', text: 'Você denunciou o morador de rua à polícia e ele foi preso.' }];
        },
      },
    ], () => {
      if (S.data.quest.stage === 'reported') arrestNpc();
    });
  }

  // Conversa curta depois de aceitar a casinha
  function talkAgain() {
    const done = S.data.quest.step;
    runDialog([{
      who: 'Morador', tone: 'npc',
      text: done
        ? 'Obrigado por tudo! Já recebi ' + done + ' de ' + S.QUEST.length + ' etapas da casa.'
        : 'Estou esperando o material para a casa. Obrigado por ajudar.',
    }]);
  }

  function arrestNpc() {
    scene.tweens.add({
      targets: npc, alpha: 0, duration: 900,
      onComplete: () => { npc.setVisible(false); npc.alpha = 1; syncNpc(); },
    });
  }

  function syncNpc() {
    const stage = S.data.quest.stage;
    npc.setVisible(stage === 'none' || stage === 'accepted');
  }

  /* ============================================================
     CASINHA NO MAPA PRINCIPAL
     ============================================================ */
  function syncHouse(announce) {
    const done = S.data.quest.stage === 'done';
    if (done && !house) {
      const img = scene.add.image(HOUSE.x, HOUSE.y, 'tex-house').setOrigin(0).setDepth(4);
      const s = HOUSE.solid;
      const solid = { x: s.x, y: s.y, w: s.w, h: s.h, cx: s.x + s.w / 2, cy: s.y + s.h / 2, r: Math.hypot(s.w, s.h) / 2 };
      scene.solids.city.push(solid);
      const figure = makeNpcFigure(HOUSE.npc.x, HOUSE.npc.y, 15);
      house = { img: img, solid: solid, figure: figure };
      if (announce) TC.ui.flash('A casinha ficou pronta, ao lado do escritório!', 4200);
    } else if (!done && house) {
      house.img.destroy();
      house.figure.destroy();
      const list = scene.solids.city;
      const k = list.indexOf(house.solid);
      if (k !== -1) list.splice(k, 1);
      house = null;
    }
  }

  /* ============================================================
     ENTRAR / SAIR DO PORÃO (mesma lógica de fade do escritório)
     ============================================================ */
  function applyLight() {
    dark.setTexture(S.data.flashlight ? 'light-lit' : 'light-blind');
    dark.setDisplaySize(3000, 3000);
  }

  function enter() {
    scene.busy = true;
    scene.clearTarget();
    const cam = scene.cameras.main;
    cam.fadeOut(220, 0, 0, 0);
    scene.time.delayedCall(240, () => {
      inBase = true;
      scene.indoor = true;
      officeSolids = scene.inSolids;
      scene.inSolids = bSolids;
      scene.p.setPosition(SPAWN.x, SPAWN.y);
      scene.p.rotation = -Math.PI / 2;
      cam.stopFollow();
      cam.removeBounds();
      cam.setBackgroundColor('#05070a');
      applyLight();
      dark.setVisible(true).setPosition(scene.p.x, scene.p.y);
      syncNpc();
      scene.applyZoom();
      TC.ui.resetInputs();
      cam.fadeIn(260, 0, 0, 0);
      scene.busy = false;
      if (S.data.flashlight) TC.ui.flash('Lanterna acesa.', 2200);
      else TC.ui.flash('Está escuro demais aqui. Você precisa de uma lanterna: compre na Loja (computador ou celular).', 5000);
    });
  }

  function exit() {
    scene.busy = true;
    scene.clearTarget();
    const cam = scene.cameras.main;
    cam.fadeOut(220, 0, 0, 0);
    scene.time.delayedCall(240, () => {
      inBase = false;
      scene.indoor = false;
      scene.inSolids = officeSolids;
      dark.setVisible(false);
      scene.p.setPosition(WALL_EXIT.x, WALL_EXIT.y);
      scene.p.rotation = -Math.PI / 2;
      cam.setBackgroundColor('#1d2b20');
      scene.applyBounds();
      scene.applyZoom();
      cam.centerOn(scene.p.x, scene.p.y);
      cam.startFollow(scene.p, true, 0.08, 0.08);
      TC.ui.resetInputs();
      cam.fadeIn(260, 0, 0, 0);
      scene.busy = false;
    });
  }

  /* ============================================================
     ACOPLAMENTO À CENA
     ============================================================ */
  function nearWall() {
    const st = S.data.quest.stage;
    if (st !== 'none' && st !== 'accepted') return false; // denunciado ou concluído: porão fechado
    return Math.hypot(scene.p.x - WALL.x, scene.p.y - WALL.y) <= WALL.r;
  }

  function attach(sc) {
    scene = sc;
    officeSolids = sc.inSolids;

    // texturas e objetos
    makeTex('tex-basement', B.w, B.h, drawBasement);
    makeTex('tex-house', HOUSE.w, HOUSE.h, drawHouse);
    makeLight('light-lit', 0.09, 0.24);
    makeLight('light-blind', 0.02, 0.06);
    scene.add.image(B.x, B.y, 'tex-basement').setOrigin(0).setDepth(1);
    npc = makeNpcFigure(NPC_POS.x, NPC_POS.y, 18);
    dark = scene.add.image(0, 0, 'light-blind').setDepth(40).setVisible(false);
    dark.setDisplaySize(3000, 3000);

    // sólidos do porão
    const addSolid = (x, y, w, h) => bSolids.push({ x: B.x + x, y: B.y + y, w: w, h: h, cx: B.x + x + w / 2, cy: B.y + y + h / 2, r: Math.hypot(w, h) / 2 });
    SHELVES.concat(CRATES).forEach((s) => addSolid(s[0], s[1], s[2], s[3]));
    BARRELS.forEach((b) => addSolid(b[0] - 26, b[1] - 26, 52, 52));
    addSolid(SOFA[0], SOFA[1], SOFA[2], SOFA[3]);

    // --- sobrescreve métodos desta instância da cena ---
    const baseWalk = sc.walkArea;
    sc.walkArea = function () {
      if (!inBase) return baseWalk.call(this);
      return { x0: WALK.x0 + P_RADIUS, y0: WALK.y0 + P_RADIUS, x1: WALK.x1 - P_RADIUS, y1: WALK.y1 - P_RADIUS };
    };

    const baseZoom = sc.applyZoom;
    sc.applyZoom = function () {
      if (!inBase) return baseZoom.call(this);
      const cam = this.cameras.main;
      const z = clamp(Math.min(this.scale.width / (B.w + 80), this.scale.height / (B.h + 80)), 0.35, 1.4);
      cam.setZoom(z);
      cam.centerOn(B.x + B.w / 2, B.y + B.h / 2);
    };
    // o listener de resize original aponta para o método antigo: reaplicamos depois dele
    sc.scale.on('resize', () => { if (inBase) sc.applyZoom(); });

    const baseInteraction = sc.computeInteraction;
    sc.computeInteraction = function () {
      const p = this.p;
      if (inBase) {
        if (Math.hypot(p.x - STAIRS.x, p.y - STAIRS.y) <= STAIRS.r) return { id: 'bs-exit', label: 'Sair do porão' };
        if (S.data.quest.stage === 'accepted' && Math.hypot(p.x - NPC_POS.x, p.y - NPC_POS.y) <= 85) return { id: 'bs-talk', label: 'Conversar' };
        return null;
      }
      const base = baseInteraction.call(this);
      if (base) return base;
      if (this.state === 'foot' && this.seg.id === 'city' && nearWall()) return { id: 'bs-enter', label: 'Entrar no porão' };
      return null;
    };

    const basePerform = sc.perform;
    sc.perform = function (id) {
      if (id === 'bs-enter') enter();
      else if (id === 'bs-exit') exit();
      else if (id === 'bs-talk') talkAgain();
      else basePerform.call(this, id);
    };

    // HUD: no porão mostra "Porão" e o estado da lanterna
    const baseHud = TC.ui.setHud;
    TC.ui.setHud = function (line, status) {
      if (inBase) baseHud('Porão', S.data.flashlight ? 'Lanterna acesa' : 'Sem lanterna');
      else baseHud(line, status);
    };

    // reage a mudanças do estado (compra da lanterna, história, reset)
    S.subscribe(() => {
      if (inBase) applyLight();
      syncNpc();
      syncHouse(true);
    });
    syncNpc();
    syncHouse(false);

    sc.events.on(Phaser.Scenes.Events.POST_UPDATE, tick);
  }

  // Todo frame: luz segue o jogador e dispara a conversa perto do morador
  function tick() {
    if (!inBase) return;
    const p = scene.p;
    dark.setPosition(p.x, p.y);
    const s = 3000 / 512;
    dark.setScale(s * (1 + 0.012 * Math.sin(performance.now() / 90)));

    if (scene.busy || scene.teleporting || scene.uiOpen || dlg.open || !pcEl.classList.contains('hidden')) return;
    if (S.data.quest.stage !== 'none') return;

    const dist = Math.hypot(p.x - NPC_POS.x, p.y - NPC_POS.y);
    if (S.data.flashlight) {
      if (dist <= 105) firstDialog();
    } else if (dist <= 140 && performance.now() > noticeUntil) {
      noticeUntil = performance.now() + 6000;
      TC.ui.flash('Você ouve alguém respirando no escuro... precisa de uma lanterna.', 3500);
    }
  }

  // Descobre a cena do jogo assim que ela existir (mesma técnica do convoy.js)
  const startGame = TC.startGame;
  TC.startGame = function () {
    startGame();
    const timer = setInterval(function () {
      const game = Phaser.GAMES[Phaser.GAMES.length - 1];
      const sc = game && game.scene && game.scene.getScene('World');
      if (sc && sc.truck && sc.seg && sc.p && sc.keys && sc.solids) {
        clearInterval(timer);
        attach(sc);
      }
    }, 100);
  };
})();
