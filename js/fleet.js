/* ============================================================
   TRUCK CITY - fleet.js  (Fase 4D: sem estoque)
   Extensão do store (store.js continua separado):
   - frota: até 5 caminhões extras (além do seu)
   - comboio: quantos caminhões seguem você (visual, ver convoy.js)
   - Funcionário Responsável: despacha caminhões em segundo plano
     (entregas automáticas dos contratos)
   - contratos de carga pesada (exigem comboio)
   Carrega DEPOIS de store.js e content.js e ANTES de pc.js.
   ============================================================ */
(function () {
  'use strict';

  const TC = window.TC;
  const S = TC.store;
  const KEY = 'truckcity.save.v1';

  /* ---------- CONFIGURAÇÃO ---------- */
  const MAX_FLEET = 5;
  const TRUCK_PRICES = [4000, 7500, 12000, 18000, 26000]; // preço do 1º ao 5º caminhão
  const EMPLOYEE_PRICE = 60000;                           // upgrade de late-game
  const EMPLOYEE_LEVEL = 3;
  const JOB_CUT = 0.7;           // entrega automática paga 70% do contrato

  /* ---------- CONTRATOS DE CARGA PESADA ----------
     heavy = total de caminhões (você + comboio). Pagam muito mais. */
  const HEAVY = [
    { id: 'h1', client: 'Prefeitura Municipal',   title: 'Módulos de ponte (carga pesada)',     cargo: 'Módulos · 3 un',       color: '#d35400', to: 'build',     pay: 16000, time: 300, risk: 'alto', level: 3, heavy: 2 },
    { id: 'h2', client: 'Metalúrgica Norte',      title: 'Turbinas industriais (carga pesada)', cargo: 'Turbinas · 4 un',      color: '#16a085', to: 'warehouse', pay: 24000, time: 320, risk: 'alto', level: 4, heavy: 3 },
    { id: 'h3', client: 'Horizonte Engenharia',   title: 'Guindaste desmontado (carga pesada)', cargo: 'Guindaste · 1 conj.',  color: '#f39c12', to: 'build',     pay: 38000, time: 340, risk: 'alto', level: 4, heavy: 4 },
    { id: 'h4', client: 'Consórcio Nova Cidade',  title: 'Usina de concreto (carga pesada)',    cargo: 'Usina · 1 conjunto',   color: '#7f8c8d', to: 'build',     pay: 62000, time: 360, risk: 'alto', level: 5, heavy: 6 },
  ];
  HEAVY.forEach((c) => { if (!S.contract(c.id)) S.CONTRACTS.push(c); });

  /* ---------- ESTADO EXTRA (salvo junto com o resto) ----------
     O store.js só carrega campos que ele conhece; por isso lemos o save
     de novo aqui e restauramos frota, comboio, funcionário e a missão ativa. */
  function validTruck(t) {
    return t && typeof t === 'object' && isFinite(t.id) && typeof t.name === 'string' && typeof t.color === 'string' &&
      (t.job == null || (typeof t.job === 'object' && isFinite(t.job.endsAt) && isFinite(t.job.duration)));
  }

  function initExtras(raw) {
    const d = S.data;
    const r = raw || {};
    d.fleet = Array.isArray(r.fleet) ? r.fleet.filter(validTruck).slice(0, MAX_FLEET) : [];
    d.fleet.forEach((t) => {
      if (!t.job) t.job = null;
      // viagens de reposição de estoque (sistema removido) são encerradas sem efeito
      if (t.job && t.job.kind !== 'delivery') t.job = null;
    });
    d.convoy = isFinite(r.convoy) ? Math.max(0, Math.min(MAX_FLEET, Math.floor(r.convoy))) : 0;
    d.employee = !!r.employee;
  }

  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { raw = null; }
  initExtras(raw);
  // missão salva de contrato criado depois do store (ex.: carga pesada)
  if (raw && raw.mission && !S.data.mission && S.contract(raw.mission.id)) S.data.mission = raw.mission;

  // "Reiniciar progresso" também zera a frota
  const baseReset = S.reset;
  S.reset = function () {
    baseReset();
    initExtras(null);
    S.save();
    S.touch();
  };

  /* ---------- AUXILIARES ---------- */
  const fail = (msg) => ({ ok: false, msg: msg });

  function pickTruck() {
    const free = S.dispatchableTrucks();
    return free.length ? free[free.length - 1] : null;
  }

  function noTruckMsg() {
    if (!S.data.fleet.length) return 'Compre um caminhão na aba Frota primeiro.';
    if (S.idleTrucks().length) return 'Todos os caminhões livres estão no comboio. Reduza o comboio na Frota.';
    return 'Nenhum caminhão livre agora.';
  }

  /* ---------- API NOVA ---------- */
  Object.assign(S, {
    MAX_FLEET: MAX_FLEET,
    EMPLOYEE_PRICE: EMPLOYEE_PRICE,
    EMPLOYEE_LEVEL: EMPLOYEE_LEVEL,
    JOB_CUT: JOB_CUT,

    // --- frota ---
    nextTruckPrice: function () {
      const n = S.data.fleet.length;
      return n >= MAX_FLEET ? null : TRUCK_PRICES[n];
    },

    buyTruck: function () {
      const d = S.data;
      const price = S.nextTruckPrice();
      if (price == null) return fail('Frota completa (' + MAX_FLEET + ' caminhões).');
      if (!S.spend(price, 'Compra de caminhão')) return fail('Saldo insuficiente.');
      const n = d.fleet.length;
      const id = d.fleet.reduce((m, t) => Math.max(m, t.id), 0) + 1;
      d.fleet.push({ id: id, name: 'Caminhão ' + (n + 2), color: S.PAINTS[(n + 1) % S.PAINTS.length].color, job: null });
      S.touch();
      S.save();
      return { ok: true, msg: 'Caminhão ' + (n + 2) + ' adicionado à frota!' };
    },

    idleTrucks: function () {
      return S.data.fleet.filter((t) => !t.job);
    },

    // --- comboio ---
    // caminhões que o contrato de carga pesada ativo trava no comboio
    convoyLock: function () {
      const m = S.data.mission;
      const c = m && S.contract(m.id);
      return c && c.heavy ? c.heavy - 1 : 0;
    },

    // quantos estão realmente seguindo (limitado aos caminhões livres)
    convoyCount: function () {
      return Math.min(S.data.convoy, S.idleTrucks().length);
    },

    convoyFleet: function () {
      return S.idleTrucks().slice(0, S.convoyCount());
    },

    setConvoy: function (n) {
      const idle = S.idleTrucks().length;
      n = Math.max(0, Math.min(idle, Math.floor(n) || 0));
      if (n < S.convoyLock()) return fail('A carga pesada ativa exige ' + S.convoyLock() + ' caminhão(ões) no comboio.');
      S.data.convoy = n;
      S.touch();
      S.save();
      return { ok: true, msg: n ? 'Comboio: ' + n + ' caminhão(ões) seguindo você.' : 'Comboio desfeito.' };
    },

    // --- Funcionário Responsável ---
    hireEmployee: function () {
      const d = S.data;
      if (d.employee) return fail('Você já contratou o Funcionário Responsável.');
      if (S.level() < EMPLOYEE_LEVEL) return fail('Exige nível ' + EMPLOYEE_LEVEL + ' da transportadora.');
      if (!S.spend(EMPLOYEE_PRICE, 'Funcionário Responsável')) return fail('Saldo insuficiente.');
      d.employee = true;
      S.touch();
      S.save();
      return { ok: true, msg: 'Funcionário Responsável contratado! Despache caminhões na aba Despacho.' };
    },

    // caminhões livres que NÃO estão no comboio nem travados por carga pesada
    dispatchableTrucks: function () {
      return S.idleTrucks().slice(Math.max(S.convoyLock(), S.convoyCount()));
    },

    dispatchDelivery: function (contractId) {
      const d = S.data;
      const c = S.contract(contractId);
      if (!d.employee) return fail('Contrate o Funcionário Responsável primeiro.');
      if (!c) return fail('Contrato não encontrado.');
      if (c.heavy) return fail('Cargas pesadas exigem o comboio comandado por você.');
      if (c.level > S.level()) return fail('Nível da transportadora insuficiente.');
      const truck = pickTruck();
      if (!truck) return fail(noTruckMsg());

      const dur = Math.round(c.time + 30); // tempo de viagem simulado (segundos)
      truck.job = { kind: 'delivery', title: c.title, duration: dur, endsAt: Date.now() + dur * 1000, reward: Math.round(c.pay * JOB_CUT) };
      S.touch();
      S.save();
      return { ok: true, msg: truck.name + ' saiu para: ' + c.title };
    },

    // Fecha as viagens que já terminaram (roda a cada segundo e ao abrir o jogo)
    tickJobs: function () {
      const d = S.data;
      const now = Date.now();
      let changed = false;
      d.fleet.forEach((t) => {
        const j = t.job;
        if (!j || now < j.endsAt) return;
        d.money += j.reward;
        d.earned += j.reward;
        d.deliveries += 1;
        S.logTx('Entrega automática: ' + j.title, j.reward);
        d.history.unshift({ t: now, title: j.title + ' (' + t.name + ')', total: j.reward });
        if (d.history.length > 12) d.history.length = 12;
        TC.ui.flash(t.name + ' entregou: +' + S.fmt(j.reward), 3200);
        t.job = null;
        changed = true;
      });
      if (changed) {
        S.touch();
        S.save();
      }
    },
  });

  /* ---------- REGRAS DE CARGA PESADA (embrulham funções do store) ---------- */
  const baseAccept = S.acceptContract;
  S.acceptContract = function (id) {
    const c = S.contract(id);
    if (c && c.heavy && !S.data.mission && c.level <= S.level()) {
      const need = c.heavy - 1;
      if (S.convoyCount() < need) return fail('Carga pesada: monte um comboio com ' + need + ' caminhão(ões) no app Frota.');
    }
    return baseAccept(id);
  };

  // O jogo chama isto ao descarregar; devolver null mantém a missão em andamento
  const baseComplete = S.completeMission;
  S.completeMission = function () {
    const m = S.data.mission;
    const c = m && S.contract(m.id);
    if (c && c.heavy && S.convoyCount() < c.heavy - 1) {
      TC.ui.flash('Carga pesada: o comboio precisa ter ' + (c.heavy - 1) + ' caminhão(ões) com você.', 2800);
      return null;
    }
    return baseComplete();
  };

  S.tickJobs();
  setInterval(S.tickJobs, 1000);
})();
