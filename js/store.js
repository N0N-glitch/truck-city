/* ============================================================
   TRUCK CITY - store.js  (Atualización 4.0)
   Economia, contratos, estoque, frota, níveis até 20 e missões especiais.
   ============================================================ */
(function () {
  'use strict';

  const TC = window.TC;
  const KEY = 'truckcity.save.v4';

  const DEST = {
    work:      { name: 'Zona de Obra',    where: 'Truck City',                       far: false },
    warehouse: { name: 'Armazém Central', where: 'Distrito Industrial · via BR-116', far: true  },
    port:      { name: 'Porto Seco',      where: 'Distrito Industrial · via BR-116', far: true  },
  };

  const CONTRACTS = [
    { id: 'c1', client: 'Construtora Aurora',   title: 'Cimento para o Centro Cívico', cargo: 'Cimento · 40 sacos',      color: '#b9b9b9', to: 'work',      pay: 900,  time: 110, risk: 'baixo', level: 1, stockCost: 200 },
    { id: 'c2', client: 'Prefeitura Municipal', title: 'Areia para a Praça da Matriz', cargo: 'Areia · 8 m³',            color: '#d8b66a', to: 'work',      pay: 1300, time: 100, risk: 'baixo', level: 1, stockCost: 300 },
    { id: 'c4', client: 'Porto Seco Ltda',      title: 'Reposição do Armazém Central', cargo: 'Paletes · 12 un',         color: '#d9a441', to: 'warehouse', pay: 2800, time: 160, risk: 'medio', level: 1, stockCost: 600 },
    { id: 'c3', client: 'Madeireira Boa Vista', title: 'Entrega expressa de madeira',  cargo: 'Madeira · 60 peças',      color: '#a0693a', to: 'work',      pay: 2100, time: 70,  risk: 'alto',  level: 2, stockCost: 500 },
    { id: 'c5', client: 'TechLog',              title: 'Eletrônicos para o Armazém',   cargo: 'Eletrônicos · 30 caixas', color: '#4f8cff', to: 'warehouse', pay: 4000, time: 150, risk: 'alto',  level: 2, stockCost: 1000 },
    { id: 'c6', client: 'Mar & Terra Export',   title: 'Contêiner para o Porto Seco',  cargo: 'Contêiner · 1 un',        color: '#2fb7a0', to: 'port',      pay: 4600, time: 170, risk: 'medio', level: 2, stockCost: 1200 },
    { id: 'c8', client: 'Metalúrgica Norte',    title: 'Máquinas pesadas',             cargo: 'Maquinário · 3 un',       color: '#8a8fa3', to: 'warehouse', pay: 5600, time: 180, risk: 'medio', level: 3, stockCost: 1500 },
    { id: 'c7', client: 'PetroSul',             title: 'Combustível especial',         cargo: 'Tambores · 20 un',        color: '#e4572e', to: 'port',      pay: 6800, time: 160, risk: 'alto',  level: 3, stockCost: 1800 },
    // Contratos de Carga Pesada (Exigem Frota)
    { id: 'cp1', client: 'Mega Construtora',    title: 'Super Lote de Vigas de Aço',   cargo: 'Vigas · Exige Frota (3)', color: '#ff5722', to: 'work',      pay: 18000, time: 240, risk: 'alto', level: 5, fleetReq: 3, stockCost: 4000 },
  ];

  const UPGRADES = {
    engine:   { name: 'Motor',   desc: '+8% velocidade máxima e +10% aceleração por nível', costs: [1500, 3500, 7000] },
    brakes:   { name: 'Freios',  desc: '+12% de força de frenagem por nível',               costs: [1000, 2500, 5000] },
    steering: { name: 'Direção', desc: '+10% de resposta do volante e curvas melhores em velocidade', costs: [1200, 3000, 6000] },
    mobile:   { name: 'Celular Móvel', desc: 'Acesse a loja e contratos de qualquer lugar do mapa', costs: [25000] },
    flashlight: { name: 'Lanterna', desc: 'Permite explorar o porão escuro atrás do escritório', costs: [500] },
    fleetManager: { name: 'Funcionário Responsável', desc: 'Permite despachar até 5 caminhões da frota para entregas automáticas', costs: [50000] },
  };

  const PAINTS = [
    { color: '#d64541', name: 'Vermelho' },
    { color: '#2f7df6', name: 'Azul' },
    { color: '#2ea66b', name: 'Verde' },
    { color: '#f0a020', name: 'Laranja' },
    { color: '#7a5cff', name: 'Roxo' },
    { color: '#2b2f36', name: 'Grafite' },
  ];
  const PAINT_COST = 200;
  const MAX_LEVEL = 20;
  const REPAIR_PER_POINT = 15;

  function fresh() {
    return {
      v: 4,
      company: 'Transportes Aurora',
      money: 1500,
      earned: 0,
      spent: 0,
      deliveries: 0,
      condition: 100,
      upgrades: { engine: 0, brakes: 0, steering: 0, mobile: 0, flashlight: 0, fleetManager: 0 },
      paint: '#d64541',
      paintsOwned: ['#d64541'],
      stock: 5, // Estoque inicial de mercadorias
      fleetCount: 0, // Número de caminhões na frota (máx 5)
      storyState: 'none', // 'none' | 'met' | 'refused' | 'accepted' | 'completed'
      mission: null,
      log: [],
      history: [],
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return fresh();
      const s = JSON.parse(raw);
      const d = fresh();
      Object.keys(d).forEach((k) => {
        if (s[k] !== undefined && typeof s[k] === typeof d[k]) d[k] = s[k];
      });
      d.upgrades = Object.assign({ engine: 0, brakes: 0, steering: 0, mobile: 0, flashlight: 0, fleetManager: 0 }, s.upgrades || {});
      if (!Array.isArray(d.log)) d.log = [];
      if (!Array.isArray(d.history)) d.history = [];
      if (!Array.isArray(d.paintsOwned) || !d.paintsOwned.length) d.paintsOwned = [d.paint];
      if (d.mission && !contractById(d.mission.id)) d.mission = null;
      return d;
    } catch (e) {
      return fresh();
    }
  }

  function contractById(id) {
    for (let i = 0; i < CONTRACTS.length; i++) if (CONTRACTS[i].id === id) return CONTRACTS[i];
    return null;
  }

  const subs = [];
  let dirty = false;

  const store = {
    DEST: DEST,
    CONTRACTS: CONTRACTS,
    UPGRADES: UPGRADES,
    PAINTS: PAINTS,
    PAINT_COST: PAINT_COST,
    MAX_LEVEL: MAX_LEVEL,
    data: null,

    fmt: function (n) {
      return '$ ' + Math.round(n).toLocaleString('pt-BR');
    },

    subscribe: function (fn) { subs.push(fn); },

    touch: function () {
      dirty = true;
      subs.forEach((fn) => { try { fn(); } catch (e) {} });
    },

    markDirty: function () { dirty = true; },

    save: function () {
      try { localStorage.setItem(KEY, JSON.stringify(store.data)); } catch (e) {}
      dirty = false;
    },

    reset: function () {
      store.data = fresh();
      store.save();
      store.touch();
    },

    // Curva de dificuldade progressiva até o nível 20
    level: function () {
      let lvl = 1;
      let req = 3;
      let count = store.data.deliveries;
      while (lvl < MAX_LEVEL && count >= req) {
        count -= req;
        lvl++;
        req += 2; // Fica mais difícil a cada nível
      }
      return Math.min(MAX_LEVEL, lvl);
    },

    levelProgress: function () {
      const lvl = store.level();
      if (lvl >= MAX_LEVEL) return { done: 10, need: 10, pct: 1, max: true };
      let req = 3;
      let count = store.data.deliveries;
      for (let i = 1; i < lvl; i++) {
        count -= req;
        req += 2;
      }
      return { done: Math.max(0, count), need: req, pct: Math.min(1, Math.max(0, count / req)), max: false };
    },

    contract: contractById,

    logTx: function (label, amount) {
      store.data.log.unshift({ t: Date.now(), label: label, amount: amount });
      if (store.data.log.length > 40) store.data.log.length = 40;
    },

    spend: function (amount, label) {
      const d = store.data;
      if (d.money < amount) return false;
      d.money -= amount;
      d.spent += amount;
      store.logTx(label, -amount);
      return true;
    },

    acceptContract: function (id) {
      const d = store.data;
      const c = contractById(id);
      if (!c) return { ok: false, msg: 'Contrato não encontrado.' };
      if (d.mission) return { ok: false, msg: 'Termine ou cancele o contrato atual primeiro.' };
      if (c.level > store.level()) return { ok: false, msg: 'Nível da transportadora insuficiente.' };
      if (d.stock < 1) return { ok: false, msg: 'Estoque esgotado! Compre mercadorias na Loja antes de aceitar.' };
      
      d.stock -= 1; // Consome 1 unidade de estoque
      d.mission = { id: c.id, stage: 'pickup', timeLeft: null, damage: 0 };
      store.touch();
      store.save();
      return { ok: true, msg: 'Contrato aceito! Vá até a Zona de Carga.' };
    },

    cancelPenalty: function () {
      const m = store.data.mission;
      if (!m) return 0;
      const c = contractById(m.id);
      return Math.min(store.data.money, Math.max(50, Math.round(c.pay * 0.1)));
    },

    cancelMission: function () {
      const d = store.data;
      if (!d.mission) return { ok: false, msg: 'Nenhum contrato ativo.' };
      const pen = store.cancelPenalty();
      if (pen > 0) {
        d.money -= pen;
        d.spent += pen;
        store.logTx('Multa por cancelar contrato', -pen);
      }
      d.mission = null;
      store.touch();
      store.save();
      return { ok: true, msg: 'Contrato cancelado.' };
    },

    completeMission: function () {
      const d = store.data;
      const m = d.mission;
      if (!m) return null;
      const c = contractById(m.id);
      const levelBefore = store.level();

      const base = c.pay;
      const left = m.timeLeft == null ? 0 : m.timeLeft;
      const bonus = left >= c.time * 0.5 ? Math.round(base * 0.2) : 0;
      const late = left < 0 ? Math.round(base * 0.25) : 0;
      const dmgPct = Math.min(40, (m.damage || 0) * 1.5);
      const dmg = Math.round((base * dmgPct) / 100);
      const total = Math.max(0, base + bonus - late - dmg);

      d.money += total;
      d.earned += total;
      d.deliveries += 1;
      store.logTx('Entrega: ' + c.title, total);
      d.history.unshift({ t: Date.now(), title: c.title, total: total });
      if (d.history.length > 12) d.history.length = 12;
      d.mission = null;

      const levelAfter = store.level();
      store.touch();
      store.save();

      return {
        title: c.title, base: base, bonus: bonus, late: late, dmg: dmg, total: total,
        levelUp: levelAfter > levelBefore, level: levelAfter,
      };
    },

    damage: function (amount) {
      const d = store.data;
      d.condition = Math.max(0, d.condition - amount);
      if (d.mission && d.mission.stage === 'transit') d.mission.damage = (d.mission.damage || 0) + amount;
      store.markDirty();
    },

    repairCost: function () {
      const c = store.data.condition;
      if (c > 99.5) return 0;
      return Math.ceil((100 - c) * REPAIR_PER_POINT);
    },

    repair: function () {
      const cost = store.repairCost();
      if (cost === 0) return { ok: false, msg: 'O caminhão já está perfeito.' };
      if (!store.spend(cost, 'Reparo')) return { ok: false, msg: 'Saldo insuficiente.' };
      store.data.condition = 100;
      store.touch();
      store.save();
      return { ok: true, msg: 'Caminhão reparado!' };
    },

    upgradeLevel: function (key) { return store.data.upgrades[key] || 0; },

    upgradeCost: function (key) {
      const u = UPGRADES[key];
      const lvl = store.upgradeLevel(key);
      if (Array.isArray(u.costs)) {
        return lvl >= u.costs.length ? null : u.costs[lvl];
      }
      return lvl > 0 ? null : u.costs;
    },

    buyUpgrade: function (key) {
      const cost = store.upgradeCost(key);
      if (cost == null) return { ok: false, msg: 'Já adquirido.' };
      if (!store.spend(cost, 'Upgrade: ' + UPGRADES[key].name)) return { ok: false, msg: 'Saldo insuficiente.' };
      store.data.upgrades[key] = store.upgradeLevel(key) + 1;
      store.touch();
      store.save();
      return { ok: true, msg: UPGRADES[key].name + ' adquirido!' };
    },

    buyStock: function (qty, cost) {
      if (!store.spend(cost, 'Compra de Estoque')) return { ok: false, msg: 'Saldo insuficiente.' };
      store.data.stock += qty;
      store.touch();
      store.save();
      return { ok: true, msg: 'Estoque reposto com sucesso!' };
    },

    buyTruck: function () {
      const d = store.data;
      if (d.fleetCount >= 5) return { ok: false, msg: 'Limite máximo de 5 caminhões na frota atingido.' };
      const cost = 20000 + d.fleetCount * 10000;
      if (!store.spend(cost, 'Contratação de Caminhão da Frota')) return { ok: false, msg: 'Saldo insuficiente.' };
      d.fleetCount += 1;
      store.touch();
      store.save();
      return { ok: true, msg: 'Novo caminhão adicionado à frota!' };
    },

    setPaint: function (color) {
      const d = store.data;
      if (d.paint === color) return { ok: true, msg: 'Cor atual.' };
      if (d.paintsOwned.indexOf(color) === -1) {
        if (!store.spend(PAINT_COST, 'Pintura')) return { ok: false, msg: 'Saldo insuficiente.' };
        d.paintsOwned.push(color);
      }
      d.paint = color;
      store.touch();
      store.save();
      return { ok: true, msg: 'Pintura aplicada!' };
    },

    rename: function (name) {
      const n = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 24);
      if (n.length < 3) return { ok: false, msg: 'Mínimo 3 caracteres.' };
      store.data.company = n;
      store.touch();
      store.save();
      return { ok: true, msg: 'Nome atualizado.' };
    },

    mods: function () {
      const d = store.data;
      const u = d.upgrades;
      const perf = d.condition < 30 ? 0.8 : 1;
      return {
        maxFwd: (1 + 0.08 * u.engine) * perf,
        accel: (1 + 0.10 * u.engine) * perf,
        brake: 1 + 0.12 * u.brakes,
        steerRate: 1 + 0.10 * u.steering,
        steerHigh: 1 + 0.12 * u.steering,
        perf: perf,
      };
    },
  };

  store.data = load();
  TC.store = store;

  setInterval(function () { if (dirty) store.save(); }, 4000);
  window.addEventListener('pagehide', store.save);
  document.addEventListener('visibilitychange', function () { if (document.hidden) store.save(); });
})();
