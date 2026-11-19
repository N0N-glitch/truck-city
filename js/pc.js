/* ============================================================
   TRUCK CITY - pc.js  (Fase 2)
   Sistema de gerenciamento do computador do escritório (TruckOS).
   Apps: Contratos e Estoque. Dados de exemplo em memória.
   Uso: TC.pc.open(callbackAoFechar)
   ============================================================ */
(function () {
  'use strict';

  const TC = window.TC;
  const $ = (s) => document.querySelector(s);
  const money = (v) => 'R$ ' + v.toLocaleString('pt-BR');

  /* ---------- DADOS DE EXEMPLO (troque/expanda nas próximas fases) ---------- */
  const CONTRACTS = [
    { id: 'c1', client: 'Construtora Aurora',   title: 'Obra do Centro Cívico', cargo: 'Cimento - 40 sacos',   from: 'Zona de Carga', to: 'Zona de Obra', pay: 1800, days: 3, risk: 'baixo' },
    { id: 'c2', client: 'Porto Seco Ltda',      title: 'Reposição de armazém',  cargo: 'Paletes - 12 un',      from: 'Zona de Carga', to: 'Escritório',   pay: 2400, days: 2, risk: 'medio' },
    { id: 'c3', client: 'Prefeitura Municipal', title: 'Praça da Matriz',       cargo: 'Areia - 8 m³',         from: 'Zona de Carga', to: 'Zona de Obra', pay: 3200, days: 5, risk: 'baixo' },
    { id: 'c4', client: 'Madeireira Boa Vista', title: 'Entrega expressa',      cargo: 'Madeira - 60 peças',   from: 'Zona de Carga', to: 'Zona de Obra', pay: 4100, days: 1, risk: 'alto'  },
  ];
  const RISK_LABEL = { baixo: 'Risco baixo', medio: 'Risco médio', alto: 'Risco alto' };

  const STOCK = [
    { name: 'Cimento', unit: 'sacos',  qty: 320, cap: 500 },
    { name: 'Areia',   unit: 'm³',     qty: 45,  cap: 120 },
    { name: 'Tijolos', unit: 'un',     qty: 9000, cap: 12000 },
    { name: 'Madeira', unit: 'peças',  qty: 40,  cap: 400 },
    { name: 'Aço',     unit: 'barras', qty: 210, cap: 300 },
    { name: 'Brita',   unit: 'm³',     qty: 18,  cap: 100 },
  ];
  const level = (pct) => (pct < 0.25 ? 'low' : pct < 0.6 ? 'mid' : 'ok');

  /* ---------- ESTADO ---------- */
  const state = { accepted: new Set(), tab: 'available', app: null, isOpen: false, onClose: null, clock: null };

  const el = {
    root: $('#pc-ui'),
    title: $('#pc-title'),
    back: $('#pc-back'),
    close: $('#pc-close'),
    home: $('#pc-home'),
    appContracts: $('#app-contracts'),
    appStock: $('#app-stock'),
    contractsList: $('#contracts-list'),
    stockList: $('#stock-list'),
    stockSummary: $('#stock-summary'),
    countActive: $('#count-active'),
    badgeContracts: $('#badge-contracts'),
    badgeStock: $('#badge-stock'),
    tray: $('#pc-tray'),
  };

  /* ---------- RENDERIZAÇÃO ---------- */
  function contractCard(c, active) {
    return (
      '<article class="card">' +
        '<header><span class="tag risk-' + c.risk + '">' + RISK_LABEL[c.risk] + '</span>' +
        '<strong>' + c.title + '</strong></header>' +
        '<p class="muted">' + c.client + '</p>' +
        '<dl>' +
          '<div><dt>Carga</dt><dd>' + c.cargo + '</dd></div>' +
          '<div><dt>Rota</dt><dd>' + c.from + ' &rarr; ' + c.to + '</dd></div>' +
          '<div><dt>Prazo</dt><dd>' + c.days + (c.days > 1 ? ' dias' : ' dia') + '</dd></div>' +
        '</dl>' +
        '<footer><span class="pay">' + money(c.pay) + '</span>' +
        '<button class="pc-btn ' + (active ? 'danger' : 'primary') + '" data-act="' + (active ? 'cancel' : 'accept') + '" data-id="' + c.id + '">' +
        (active ? 'Cancelar' : 'Aceitar') + '</button></footer>' +
      '</article>'
    );
  }

  function renderContracts() {
    const wantActive = state.tab === 'active';
    const list = CONTRACTS.filter((c) => state.accepted.has(c.id) === wantActive);
    el.contractsList.innerHTML = list.length
      ? list.map((c) => contractCard(c, wantActive)).join('')
      : '<div class="empty">' + (wantActive ? 'Nenhum contrato em andamento.' : 'Nenhum contrato disponível.') + '</div>';

    document.querySelectorAll('#app-contracts .tab').forEach((t) => {
      t.classList.toggle('active', t.dataset.tab === state.tab);
    });
    refreshCounters();
  }

  function renderStock() {
    const totalQty = STOCK.reduce((s, i) => s + i.qty, 0);
    const totalCap = STOCK.reduce((s, i) => s + i.cap, 0);
    const pctAll = Math.round((totalQty / totalCap) * 100);
    const lows = STOCK.filter((i) => level(i.qty / i.cap) === 'low').length;

    el.stockSummary.innerHTML =
      '<strong>Armazém: ' + pctAll + '% da capacidade</strong>' +
      (lows ? ' &nbsp;·&nbsp; <span style="color:#ffb35c">' + lows + ' item(ns) com estoque baixo</span>' : '');

    el.stockList.innerHTML = STOCK.map((i) => {
      const pct = i.qty / i.cap;
      return (
        '<article class="card">' +
          '<div class="stock-head"><strong>' + i.name + '</strong>' +
          '<span class="stock-qty">' + i.qty.toLocaleString('pt-BR') + ' / ' + i.cap.toLocaleString('pt-BR') + ' ' + i.unit + '</span></div>' +
          '<div class="bar"><i class="lvl-' + level(pct) + '" style="width:' + Math.round(pct * 100) + '%"></i></div>' +
        '</article>'
      );
    }).join('');
  }

  function refreshCounters() {
    const active = state.accepted.size;
    const available = CONTRACTS.length - active;
    el.countActive.textContent = String(active);
    el.badgeContracts.textContent = String(available);
    const lows = STOCK.filter((i) => level(i.qty / i.cap) === 'low').length;
    el.badgeStock.textContent = String(lows);
    el.badgeStock.classList.toggle('hidden', lows === 0);
    updateTray();
  }

  function updateTray() {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    el.tray.textContent = 'Contratos em andamento: ' + state.accepted.size + '  ·  ' + hh + ':' + mm;
  }

  /* ---------- NAVEGAÇÃO ---------- */
  function showHome() {
    state.app = null;
    el.home.classList.remove('hidden');
    el.appContracts.classList.add('hidden');
    el.appStock.classList.add('hidden');
    el.back.classList.add('hidden');
    el.title.textContent = 'TruckOS - Área de Trabalho';
    refreshCounters();
  }

  function showApp(name) {
    state.app = name;
    el.home.classList.add('hidden');
    el.back.classList.remove('hidden');
    el.appContracts.classList.toggle('hidden', name !== 'contracts');
    el.appStock.classList.toggle('hidden', name !== 'stock');
    if (name === 'contracts') { el.title.textContent = 'Contratos'; renderContracts(); }
    if (name === 'stock') { el.title.textContent = 'Estoque'; renderStock(); }
    $('#pc-body').scrollTop = 0;
  }

  document.querySelectorAll('.app-icon').forEach((b) => {
    b.addEventListener('click', () => showApp(b.dataset.app));
  });
  el.back.addEventListener('click', showHome);
  el.close.addEventListener('click', close);

  document.querySelectorAll('#app-contracts .tab').forEach((t) => {
    t.addEventListener('click', () => { state.tab = t.dataset.tab; renderContracts(); });
  });

  el.contractsList.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    if (btn.dataset.act === 'accept') state.accepted.add(btn.dataset.id);
    else state.accepted.delete(btn.dataset.id);
    renderContracts();
  });

  document.addEventListener('keydown', (e) => {
    if (state.isOpen && e.key === 'Escape') close();
  });

  /* ---------- ABRIR / FECHAR ---------- */
  function open(onClose) {
    state.isOpen = true;
    state.onClose = onClose || null;
    el.root.classList.remove('hidden');
    showHome();
    clearInterval(state.clock);
    state.clock = setInterval(updateTray, 30000);
  }

  function close() {
    if (!state.isOpen) return;
    state.isOpen = false;
    clearInterval(state.clock);
    el.root.classList.add('hidden');
    const cb = state.onClose;
    state.onClose = null;
    if (cb) cb();
  }

  TC.pc = { open: open, close: close };
})();
