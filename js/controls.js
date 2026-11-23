/* ============================================================
   TRUCK CITY - controls.js  (Fase 3)
   Setup de dispositivo, HUD, botão contextual e controles mobile.
   ============================================================ */
(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const TC = (window.TC = {
    device: null,
    mobileMode: null,
    input: {
      up: 0, down: 0, left: 0, right: 0,
      gas: 0, brake: 0,
      wheel: 0,
      action: false,
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
    money: $('#money-val'),
    line: $('#hud-line'),
    status: $('#hud-status'),
    help: $('#hud-help'),
    msg: $('#hud-msg'),
    mission: $('#mission-box'),
    mTime: $('#m-time'),
    mTitle: $('#m-title'),
    mStep: $('#m-step'),
    mProg: $('#m-prog'),
    mProgBar: $('#m-prog-bar'),
    mProgLabel: $('#m-prog-label'),
    mNav: $('#m-nav'),
    navArrow: $('#nav-arrow'),
    navDist: $('#nav-dist'),
    banner: $('#banner'),
    bannerTitle: $('#banner-title'),
    bannerSub: $('#banner-sub'),
    summary: $('#summary'),
    controls: $('#controls'),
    wheelWrap: $('#wheel-wrap'),
    wheel: $('#wheel'),
    action: $('#btn-action'),
    actionLabel: $('#action-label'),
  };

  document.addEventListener('contextmenu', (e) => e.preventDefault());

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

    document.body.classList.add(device === 'mobile' ? 'is-mobile' : 'is-pc');
    el.setup.classList.add('hidden');
    el.hud.classList.remove('hidden');

    if (device === 'mobile') {
      el.controls.classList.remove('hidden');
      el.controls.classList.add('mode-' + mode);
      document.body.classList.add('mode-' + mode);
      el.help.textContent = 'Toque no mapa para andar. Aproxime-se de portas e objetos para interagir.';
    } else {
      el.help.textContent = 'WASD/Setas: andar e dirigir · E ou Espaço: interagir · Clique: andar até o ponto';
    }

    TC.startGame();
  }

  function bindHold(btn, key) {
    const release = () => {
      TC.input[key] = 0;
      btn.classList.remove('active');
    };
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { btn.setPointerCapture(e.pointerId); } catch (_) {}
      TC.input[key] = 1;
      btn.classList.add('active');
    });
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('lostpointercapture', release);
  }

  document.querySelectorAll('[data-hold]').forEach((btn) => bindHold(btn, btn.dataset.hold));

  el.action.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    TC.input.action = true;
  });

  const WHEEL_MAX = Math.PI * 0.75;
  const wheel = { angle: 0, held: false, pointerId: null, lastA: 0 };

  function pointerAngle(e) {
    const r = el.wheelWrap.getBoundingClientRect();
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
  }

  el.wheelWrap.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    wheel.held = true;
    wheel.pointerId = e.pointerId;
    try { el.wheelWrap.setPointerCapture(e.pointerId); } catch (_) {}
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

  const cache = {};
  function setText(key, node, value) {
    if (cache[key] !== value) {
      cache[key] = value;
      node.textContent = value;
    }
  }

  TC.ui.setMoney = function (text) { setText('money', el.money, text); };

  TC.ui.setHud = function (line, status) {
    setText('line', el.line, line);
    setText('status', el.status, status || '');
  };

  let flashTimer = null;
  TC.ui.flash = function (text, ms) {
    el.msg.textContent = text;
    el.msg.classList.add('show');
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => el.msg.classList.remove('show'), ms || 2200);
  };

  TC.ui.banner = function (title, sub) {
    el.bannerTitle.textContent = title;
    el.bannerSub.textContent = sub || '';
    el.banner.classList.remove('show');
    void el.banner.offsetWidth;
    el.banner.classList.add('show');
  };

  TC.ui.setMission = function (info) {
    if (!info) {
      if (cache.missionOn) {
        el.mission.classList.add('hidden');
        cache.missionOn = false;
      }
      return;
    }
    if (!cache.missionOn) {
      el.mission.classList.remove('hidden');
      cache.missionOn = true;
    }
    setText('mTitle', el.mTitle, info.title);
    setText('mStep', el.mStep, info.step);
    setText('mTime', el.mTime, info.time || '');
    const cls = 'm-time ' + (info.timeClass || '');
    if (cache.mTimeCls !== cls) {
      cache.mTimeCls = cls;
      el.mTime.className = cls;
    }
    if (info.progress == null) {
      if (cache.progOn) {
        el.mProg.classList.add('hidden');
        cache.progOn = false;
      }
    } else {
      if (!cache.progOn) {
        el.mProg.classList.remove('hidden');
        cache.progOn = true;
      }
      const w = Math.round(clamp(info.progress, 0, 1) * 100) + '%';
      if (cache.progW !== w) {
        cache.progW = w;
        el.mProgBar.style.width = w;
      }
      setText('mProgLabel', el.mProgLabel, info.progressLabel || '');
    }
  };

  TC.ui.setNav = function (info) {
    if (!info) {
      if (cache.navOn) {
        el.mNav.classList.add('hidden');
        cache.navOn = false;
      }
      return;
    }
    if (!cache.navOn) {
      el.mNav.classList.remove('hidden');
      cache.navOn = true;
    }
    const deg = Math.round((info.angle * 180) / Math.PI);
    if (cache.navDeg !== deg) {
      cache.navDeg = deg;
      el.navArrow.style.transform = 'rotate(' + deg + 'deg)';
    }
    setText('navDist', el.navDist, info.dist);
  };

  let summaryTimer = null;
  TC.ui.showSummary = function (html) {
    el.summary.innerHTML = html;
    el.summary.classList.remove('hidden');
    clearTimeout(summaryTimer);
    summaryTimer = setTimeout(() => el.summary.classList.add('hidden'), 10000);
  };
  el.summary.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) {
      clearTimeout(summaryTimer);
      el.summary.classList.add('hidden');
    }
  });

  TC.ui.setAction = function (info) {
    if (!info) {
      if (cache.actionOn) {
        el.action.classList.remove('show');
        cache.actionOn = false;
      }
      return;
    }
    setText('actionLabel', el.actionLabel, info.label);
    if (!cache.actionOn) {
      el.action.classList.add('show');
      cache.actionOn = true;
    }
  };

  TC.ui.resetInputs = function () {
    Object.keys(TC.input).forEach((k) => { if (k !== 'action') TC.input[k] = 0; });
    document.querySelectorAll('[data-hold]').forEach((b) => b.classList.remove('active'));
    wheel.held = false;
    wheel.angle = 0;
  };

  TC.ui.setDriving = function (driving) {
    el.controls.classList.toggle('is-driving', driving);
    document.body.classList.toggle('is-driving', driving);
    TC.ui.resetInputs();
  };

  TC.ui.update = function (dt) {
    if (TC.mobileMode !== 'wheel') return;
    if (!wheel.held && wheel.angle !== 0) {
      const step = 5 * dt;
      wheel.angle = Math.abs(wheel.angle) <= step ? 0 : wheel.angle - Math.sign(wheel.angle) * step;
    }
    TC.input.wheel = wheel.angle / WHEEL_MAX;
    el.wheel.style.transform = 'rotate(' + wheel.angle + 'rad)';
  };
})();
