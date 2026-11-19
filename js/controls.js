/* ============================================================
   TRUCK CITY - controls.js
   Setup de dispositivo, HUD e controles mobile (HTML).
   Expõe tudo em window.TC para o game.js usar.
   ============================================================ */
(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const TC = (window.TC = {
    device: null,       // 'pc' | 'mobile'
    mobileMode: null,   // 'buttons' | 'wheel' | null
    input: {
      up: 0, down: 0, left: 0, right: 0, // botões direcionais
      gas: 0, brake: 0,                  // pedais
      wheel: 0,                          // volante: -1 (esquerda) a 1 (direita)
      action: false,                     // botão Entrar/Sair
    },
    ui: {},
    startGame: function () { console.error('game.js não foi carregado.'); },
  });

  TC.consumeAction = function () {
    const a = TC.input.action;
    TC.input.action = false;
    return a;
  };

  const el = {
    setup: $('#setup'),
    stepDevice: $('#step-device'),
    stepMobile: $('#step-mobile'),
    hud: $('#hud'),
    speed: $('#hud-speed'),
    gear: $('#hud-gear'),
    steer: $('#hud-steer'),
    status: $('#hud-status'),
    help: $('#hud-help'),
    msg: $('#hud-msg'),
    controls: $('#controls'),
    wheelWrap: $('#wheel-wrap'),
    wheel: $('#wheel'),
    enter: $('#btn-enter'),
  };

  document.addEventListener('contextmenu', (e) => e.preventDefault());

  /* ---------------- SETUP ---------------- */
  document.querySelectorAll('[data-device]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.device === 'pc') {
        begin('pc', null);
      } else {
        el.stepDevice.classList.add('hidden');
        el.stepMobile.classList.remove('hidden');
      }
    });
  });

  document.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => begin('mobile', btn.dataset.mode));
  });

  $('#btn-back').addEventListener('click', () => {
    el.stepMobile.classList.add('hidden');
    el.stepDevice.classList.remove('hidden');
  });

  function begin(device, mode) {
    TC.device = device;
    TC.mobileMode = mode;

    el.setup.classList.add('hidden');
    el.hud.classList.remove('hidden');

    if (device === 'mobile') {
      el.controls.classList.remove('hidden');
      el.controls.classList.add('mode-' + mode);
      el.help.textContent = 'Toque no mapa para andar até o ponto.';
    } else {
      el.help.textContent = 'WASD/Setas: andar e dirigir · E ou Espaço: entrar/sair · Clique: andar até o ponto';
    }

    TC.startGame();
  }

  /* ---------------- BOTÕES SEGURADOS (D-pad e pedais) ---------------- */
  function bindHold(btn, key) {
    const release = () => {
      TC.input[key] = 0;
      btn.classList.remove('active');
    };
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { btn.setPointerCapture(e.pointerId); } catch (_) { /* ignora */ }
      TC.input[key] = 1;
      btn.classList.add('active');
    });
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('lostpointercapture', release);
  }

  document.querySelectorAll('[data-hold]').forEach((btn) => bindHold(btn, btn.dataset.hold));

  /* ---------------- BOTÃO ENTRAR / SAIR ---------------- */
  el.enter.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    TC.input.action = true;
  });

  /* ---------------- VOLANTE VIRTUAL ---------------- */
  const WHEEL_MAX = Math.PI * 0.75; // 135 graus para cada lado
  const wheel = { angle: 0, held: false, pointerId: null, lastA: 0 };

  function pointerAngle(e) {
    const r = el.wheelWrap.getBoundingClientRect();
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
  }

  el.wheelWrap.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    wheel.held = true;
    wheel.pointerId = e.pointerId;
    try { el.wheelWrap.setPointerCapture(e.pointerId); } catch (_) { /* ignora */ }
    wheel.lastA = pointerAngle(e);
  });

  el.wheelWrap.addEventListener('pointermove', (e) => {
    if (!wheel.held || e.pointerId !== wheel.pointerId) return;
    const a = pointerAngle(e);
    let d = a - wheel.lastA;
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    wheel.angle = clamp(wheel.angle + d, -WHEEL_MAX, WHEEL_MAX);
    wheel.lastA = a;
  });

  const releaseWheel = (e) => {
    if (e.pointerId === wheel.pointerId) {
      wheel.held = false;
      wheel.pointerId = null;
    }
  };
  el.wheelWrap.addEventListener('pointerup', releaseWheel);
  el.wheelWrap.addEventListener('pointercancel', releaseWheel);
  el.wheelWrap.addEventListener('lostpointercapture', releaseWheel);

  /* ---------------- API DE UI USADA PELO JOGO ---------------- */
  const cache = {};
  function setText(key, node, value) {
    if (cache[key] !== value) {
      cache[key] = value;
      node.textContent = value;
    }
  }

  TC.ui.setHud = function (kmh, gear, steerDeg, status) {
    setText('speed', el.speed, String(kmh));
    setText('gear', el.gear, gear);
    setText('steer', el.steer, steerDeg + '\u00B0');
    setText('status', el.status, status || '');
  };

  let flashTimer = null;
  TC.ui.flash = function (text, ms) {
    el.msg.textContent = text;
    el.msg.classList.add('show');
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => el.msg.classList.remove('show'), ms || 2200);
  };

  TC.ui.setEnterButton = function (label, enabled) {
    setText('enterLabel', el.enter, label);
    if (cache.enterEnabled !== enabled) {
      cache.enterEnabled = enabled;
      el.enter.classList.toggle('disabled', !enabled);
    }
  };

  TC.ui.setDriving = function (driving) {
    el.controls.classList.toggle('is-driving', driving);
    // zera tudo ao trocar de modo para não ficar tecla "presa"
    Object.keys(TC.input).forEach((k) => { if (k !== 'action') TC.input[k] = 0; });
    document.querySelectorAll('[data-hold]').forEach((b) => b.classList.remove('active'));
    wheel.held = false;
    wheel.angle = 0;
  };

  // Chamado todo frame pelo jogo: volta o volante ao centro e gira o desenho
  TC.ui.update = function (dt) {
    if (TC.mobileMode !== 'wheel') return;
    if (!wheel.held && wheel.angle !== 0) {
      const step = 5 * dt; // velocidade com que o volante volta ao centro
      wheel.angle = Math.abs(wheel.angle) <= step ? 0 : wheel.angle - Math.sign(wheel.angle) * step;
    }
    TC.input.wheel = wheel.angle / WHEEL_MAX;
    el.wheel.style.transform = 'rotate(' + wheel.angle + 'rad)';
  };
})();
