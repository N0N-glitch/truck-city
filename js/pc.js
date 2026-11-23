/* ============================================================
   TRUCK CITY - pc.js  (Atualização 4.0) - TruckOS
   Computador da transportadora: Contratos, Loja/Estoque, Banco, Garagem, Frota e Empresa.
   ============================================================ */
(function () {
  'use strict';

  const TC = window.TC;
  const S = TC.store;
  const $ = (s) => document.querySelector(s);

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  const ICON = {
    clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5V3h6v1.5"/><path d="M9 13l2.2 2.2L15.5 11"/>',
    wallet: '<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18"/><circle cx="16.5" cy="14.5" r="1.3"/>',
    truck: '<path d="M2 6.5h11V16H2z"/><path d="M13 9.5h4l3 3.2V16h-7z"/><circle cx="6.5" cy="17.5" r="2"/><circle cx="16.5" cy="17.5" r="2"/>',
    building: '<path d="M4 21V6l8-3 8 3v15"/><path d="M9 9h2M13 9h2M9 13h2M13 13h2"/><path d="M10 21v-4h4v4"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1L3.2 9.4l6.1-.8z"/>',
    road: '<path d="M8 3L5 21M16 3l3 18M12 4v3M12 10.5v3M12 17v3"/>',
    box: '<path d="M3 7.5L12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5L12 12l9-4.5M12 12v9"/>',
    route: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3.5 17.5a1.8 1.8 0 0 0 2.5 2.5l5.8-5.8a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    down: '<path d="M3 7l6 6 4-4 8 8"/><path d="M15 17h6v-6"/>',
    paint: '<path d="M12 3c4.5 4.5 7 7.6 7 10.5a7 7 0 0 1-14 0C5 10.6 7.5 7.5 12 3z"/>',
    engine: '<path d="M4 9h3l1-2h6l1 2h3v7h-3l-1 2H8l-1-2H4z"/><path d="M2 12h2M20 12h2"/>',
    brake: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 4v2M12 18v2M4 12h2M18 12h2"/>',
    wheel: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><path d="M12 3v7M5 16l6-3M19 16l-6-3"/>',
  };
  const ic = (name, cls) =>
    '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[name] + '</svg>';

  const APPS = [
    { id: 'contracts', name: 'Contratos', icon: 'clipboard', tone: 'blue' },
    { id: 'store',     name: 'Loja & Estoque', icon: 'box', tone: 'orange' },
    { id: 'fleet',     name: 'Frota',     icon: 'truck',     tone: 'purple' },
    { id: 'bank',      name: 'Banco',     icon: 'wallet',    tone: 'green' },
    { id: 'garage',    name: 'Garagem',   icon: 'wrench',    tone: 'orange' },
    { id: 'company',   name: 'Empresa',   icon: 'building',  tone: 'blue' },
  ];
  const appById = (id) => APPS.filter((a) => a.id === id)[0];

  const RISK = { baixo: 'Risco baixo', medio: 'Risco médio', alto: 'Risco alto' };

  const el = {
    root: $('#pc-ui'),
    company: $('#os-company'),
    money: $('#os-money'),
    clock: $('#os-clock'),
    icons: $('#os-icons'),
    widgets: $('#os-widgets'),
    win: $('#os-window'),
    winIco: $('#win-ico'),
    winTitle: $('#win-title'),
    winBody: $('#win-body'),
    dockApps: $('#dock-apps'),
    toast: $('#os-toast'),
  };

  const ui = { open: false, app: null, tab: 'available', onClose: null, clock: null, toastTimer: null, confirmReset: false };

  function fmtTime(sec) {
    sec = Math.max(0, Math.round(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function fmtDate(t) {
    const d = new Date(t);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function toast(msg, type) {
    el.toast.textContent = msg;
    el.toast.className = 'show ' + (type || '');
    clearTimeout(ui.toastTimer);
    ui.toastTimer = setTimeout(() => { el.toast.className = ''; }, 2600);
  }

  function tickClock() {
    const d = new Date();
    el.clock.textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function renderChrome() {
    el.company.textContent = S.data.company;
    el.money.textContent = S.fmt(S.data.money);
  }

  function renderIcons() {
    el.icons.innerHTML = APPS.map((a) =>
      '<button class="desk-icon" data-act="open" data-app="' + a.id + '">' +
        '<span class="tile tone-' + a.tone + '">' + ic(a.icon) + '</span>' +
        '<span>' + a.name + '</span>' +
      '</button>'
    ).join('');
  }

  function renderDock() {
    el.dockApps.innerHTML = APPS.map((a) =>
      '<button class="dock-btn' + (ui.app === a.id ? ' active' : '') + '" data-act="open" data-app="' + a.id + '" title="' + a.name + '">' +
        '<span class="tile tone-' + a.tone + '">' + ic(a.icon) + '</span>' +
        '<span class="dlbl">' + a.name + '</span>' +
      '</button>'
    ).join('');
  }

  function renderWidgets() {
    const d = S.data;
    const m = d.mission;
    const lvl = S.level();
    const lp = S.levelProgress();

    let missionHtml;
    if (m) {
      const c = S.contract(m.id);
      const dest = S.DEST[c.to];
      missionHtml =
        '<h4>' + esc(c.title) + '</h4>' +
        '<div class="w-sub">' + (m.stage === 'pickup' ? 'Carregar na Zona de Carga' : 'Entregar em ' + esc(dest.name)) + '</div>' +
        '<div class="w-row"><button class="btn sm primary" data-act="open" data-app="contracts">Ver contrato</button></div>';
    } else {
      missionHtml =
        '<h4>Nenhuma missão ativa</h4>' +
        '<div class="w-sub">Estoque atual: <b>' + d.stock + ' un</b></div>' +
        '<div class="w-row"><button class="btn sm primary" data-act="open" data-app="store">Repor Estoque</button></div>';
    }

    el.widgets.innerHTML =
      '<div class="w-card"><div class="w-label">' + ic('wallet') + ' SALDO & ESTOQUE</div>' +
        '<div class="w-big">' + S.fmt(d.money) + '</div>' +
        '<div class="w-sub">Estoque disponível: <b>' + d.stock + ' cargas</b></div></div>' +
      '<div class="w-card"><div class="w-label">' + ic('clipboard') + ' MISSÃO ATUAL</div>' + missionHtml + '</div>' +
      '<div class="w-card"><div class="w-label">' + ic('star') + ' NÍVEL DA TRANSPORTADORA</div>' +
        '<div class="w-big" style="color:#ffd978">Nível ' + lvl + ' / ' + S.MAX_LEVEL + '</div>' +
        '<div class="meter"><i style="width:' + Math.round(lp.pct * 100) + '%"></i></div>' +
        '<div class="w-sub" style="margin-top:6px">' + (lp.max ? 'Nível máximo!' : lp.done + '/' + lp.need + ' entregas para o próximo nível') + '</div></div>';
  }

  /* ---------- APP: CONTRATOS ---------- */
  function contractCard(c, lvl, hasMission, stock) {
    const dest = S.DEST[c.to];
    const locked = c.level > lvl;
    const noStock = stock < 1;
    return (
      '<article class="c-card risk-' + c.risk + (locked ? ' locked' : '') + '">' +
        '<div class="c-top"><span class="tag tag-' + c.risk + '">' + RISK[c.risk] + '</span>' +
        (dest.far ? '<span class="tag tag-far">' + ic('road') + ' Via BR-116</span>' : '<span class="tag tag-near">Na cidade</span>') + '</div>' +
        '<h3>' + esc(c.title) + '</h3>' +
        '<p class="client">' + esc(c.client) + '</p>' +
        '<ul class="c-info">' +
          '<li>' + ic('box') + '<span><i style="background:' + c.color + '"></i>' + esc(c.cargo) + '</span></li>' +
          '<li>' + ic('route') + '<span>Zona de Carga → ' + esc(dest.name) + '</span></li>' +
          '<li>' + ic('clock') + '<span>Prazo: ' + fmtTime(c.time) + ' · Requer 1 Estoque</span></li>' +
        '</ul>' +
        '<div class="c-foot"><span class="pay">' + S.fmt(c.pay) + '</span>' +
        (locked
          ? '<span class="lock">' + ic('lock') + ' Nível ' + c.level + '</span>'
          : noStock
            ? '<span class="lock" style="color:#ff6b6b">Sem estoque</span>'
            : '<button class="btn primary sm" data-act="accept" data-id="' + c.id + '"' + (hasMission ? ' disabled' : '') + '>Aceitar</button>') +
        '</div>' +
      '</article>'
    );
  }

  function renderContracts() {
    const d = S.data;
    const m = d.mission;
    const lvl = S.level();
    let h =
      '<div class="app-head"><div><h2>Central de Contratos</h2>' +
      '<p class="sub">Estoque atual: <b>' + d.stock + ' unidades</b>. Aceite contratos e faça entregas.</p></div>' +
      '<span class="lvl-pill">' + ic('star') + ' Nível ' + lvl + '</span></div>';

    if (m) {
      const c = S.contract(m.id);
      const dest = S.DEST[c.to];
      const picked = m.stage === 'transit';
      h +=
        '<div class="mission-panel">' +
          '<div class="row-between"><b style="font-size:16px">Contrato ativo · ' + esc(c.title) + '</b><span class="pay">' + S.fmt(c.pay) + '</span></div>' +
          '<div class="w-sub">' + esc(c.client) + ' · ' + esc(c.cargo) + '</div>' +
          '<div class="steps">' +
            '<div class="step ' + (picked ? 'done' : 'now') + '"><span class="num">' + (picked ? ic('check') : '1') + '</span><span>Carregar na <b>Zona de Carga</b></span></div>' +
            '<div class="step ' + (picked ? 'now' : '') + '"><span class="num">2</span><span>Entregar em <b>' + esc(dest.name) + '</b></span></div>' +
          '</div>' +
          '<button class="btn danger sm" data-act="cancel">Cancelar contrato (multa ' + S.fmt(S.cancelPenalty()) + ')</button>' +
        '</div>';
    }

    h +=
      '<div class="seg-tabs">' +
        '<button class="seg-tab' + (ui.tab === 'available' ? ' active' : '') + '" data-act="tab" data-tab="available">Disponíveis</button>' +
        '<button class="seg-tab' + (ui.tab === 'history' ? ' active' : '') + '" data-act="tab" data-tab="history">Histórico</button>' +
      '</div>';

    if (ui.tab === 'available') {
      h += '<div class="c-grid">' + S.CONTRACTS.map((c) => contractCard(c, lvl, !!m, d.stock)).join('') + '</div>';
    } else if (!d.history.length) {
      h += '<div class="empty">Nenhuma entrega concluída.</div>';
    } else {
      h += '<div class="tx-list">' + d.history.map((x) =>
        '<div class="tx in"><span class="dot">' + ic('check') + '</span><div class="t"><b>' + esc(x.title) + '</b><span>' + fmtDate(x.t) + '</span></div><span class="amt">+ ' + S.fmt(x.total) + '</span></div>'
      ).join('') + '</div>';
    }
    return h;
  }

  /* ---------- APP: LOJA & ESTOQUE ---------- */
  function renderStore() {
    const d = S.data;
    return (
      '<div class="app-head"><div><h2>Loja & Reposição de Estoque</h2>' +
      '<p class="sub">Compre mercadorias para o seu estoque e adquira melhorias especiais como o Celular Móvel e a Lanterna.</p></div></div>' +
      '<div class="panel-card" style="margin-bottom:16px">' +
        '<h3>Repor Estoque de Cargas</h3>' +
        '<div class="row-between" style="margin:10px 0"><span>Estoque atual: <b>' + d.stock + ' unidades</b></span></div>' +
        '<div class="w-row">' +
          '<button class="btn primary" data-act="buy-stock" data-qty="5" data-cost="800">Comprar 5 Cargas ($ 800)</button>' +
          '<button class="btn primary" data-act="buy-stock" data-qty="15" data-cost="2200">Comprar 15 Cargas ($ 2.200)</button>' +
        '</div>' +
      '</div>' +
      '<div class="panel-card"><h3>Upgrades Especiais</h3>' +
        '<div class="upg"><span class="tile tone-blue">' + ic('box') + '</span>' +
          '<div class="info"><b>Celular Móvel</b><span>Permite abrir a Loja e gerenciar contratos de qualquer lugar do mundo.</span></div>' +
          (d.upgrades.mobile > 0 ? '<span class="lock">' + ic('check') + ' Adquirido</span>' : '<button class="btn primary sm" data-act="special-upg" data-key="mobile">' + S.fmt(S.UPGRADES.mobile.costs[0]) + '</button>') +
        '</div>' +
        '<div class="upg"><span class="tile tone-orange">' + ic('wrench') + '</span>' +
          '<div class="info"><b>Lanterna de Alta Potência</b><span>Necessária para explorar o porão escuro atrás do escritório.</span></div>' +
          (d.upgrades.flashlight > 0 ? '<span class="lock">' + ic('check') + ' Adquirido</span>' : '<button class="btn primary sm" data-act="special-upg" data-key="flashlight">' + S.fmt(S.UPGRADES.flashlight.costs[0]) + '</button>') +
        '</div>' +
        '<div class="upg"><span class="tile tone-purple">' + ic('truck') + '</span>' +
          '<div class="info"><b>Funcionário Responsável</b><span>Permite despachar caminhões da frota para entregas automáticas.</span></div>' +
          (d.upgrades.fleetManager > 0 ? '<span class="lock">' + ic('check') + ' Adquirido</span>' : '<button class="btn primary sm" data-act="special-upg" data-key="fleetManager">' + S.fmt(S.UPGRADES.fleetManager.costs[0]) + '</button>') +
        '</div>' +
      '</div>'
    );
  }

  /* ---------- APP: FROTA ---------- */
  function renderFleet() {
    const d = S.data;
    const maxFleet = 5;
    const nextTruckCost = 20000 + d.fleetCount * 10000;
    return (
      '<div class="app-head"><div><h2>Gerenciamento de Frota</h2>' +
      '<p class="sub">Contrate até 5 caminhões para o seu comboio ou para realizar entregas automáticas.</p></div></div>' +
      '<div class="panel-card">' +
        '<h3>Caminhões na Frota: ' + d.fleetCount + ' / ' + maxFleet + '</h3>' +
        '<div class="w-sub" style="margin:8px 0 16px">Cada caminhão contratado pode seguir você no modo comboio ou trabalhar na transportadora.</div>' +
        (d.fleetCount < maxFleet
          ? '<button class="btn primary" data-act="buy-truck">Contratar Novo Caminhão (' + S.fmt(nextTruckCost) + ')</button>'
          : '<div class="lvl-pill">Frota máxima atingida!</div>') +
      '</div>'
    );
  }

  /* ---------- APP: BANCO ---------- */
  function renderBank() {
    const d = S.data;
    const avg = d.deliveries ? Math.round(d.earned / d.deliveries) : 0;
    let h =
      '<div class="app-head"><div><h2>Banco da Transportadora</h2><p class="sub">Finanças da empresa.</p></div></div>' +
      '<div class="bal-card"><div class="lbl">SALDO DISPONÍVEL</div><div class="val">' + S.fmt(d.money) + '</div><div class="owner">' + esc(d.company) + '</div></div>' +
      '<div class="stat-tiles">' +
        '<div class="stat-tile"><div class="k">RECEITA</div><div class="v" style="color:#7dffb0">' + S.fmt(d.earned) + '</div></div>' +
        '<div class="stat-tile"><div class="k">DESPESAS</div><div class="v" style="color:#ff9c9c">' + S.fmt(d.spent) + '</div></div>' +
        '<div class="stat-tile"><div class="k">ENTREGAS</div><div class="v">' + d.deliveries + '</div></div>' +
      '</div>' +
      '<div class="panel-card"><h3>Extrato</h3>';
    if (!d.log.length) h += '<div class="empty">Nenhuma movimentação.</div>';
    else {
      h += '<div class="tx-list">' + d.log.slice(0, 20).map((x) => {
        const inn = x.amount >= 0;
        return '<div class="tx ' + (inn ? 'in' : 'out') + '"><span class="dot">' + ic(inn ? 'trend' : 'down') + '</span>' +
          '<div class="t"><b>' + esc(x.label) + '</b><span>' + fmtDate(x.t) + '</span></div>' +
          '<span class="amt">' + (inn ? '+ ' : '- ') + S.fmt(Math.abs(x.amount)) + '</span></div>';
      }).join('') + '</div>';
    }
    return h + '</div>';
  }

  /* ---------- APP: GARAGEM ---------- */
  function darken(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgb(' + Math.round(((n >> 16) & 255) * k) + ',' + Math.round(((n >> 8) & 255) * k) + ',' + Math.round((n & 255) * k) + ')';
  }

  function truckSvg(color) {
    return (
      '<svg class="truck-prev" viewBox="0 0 220 100" aria-hidden="true">' +
        '<rect x="14" y="26" width="26" height="9" rx="3" fill="#111"/><rect x="14" y="66" width="26" height="9" rx="3" fill="#111"/>' +
        '<rect x="6" y="18" width="130" height="64" rx="7" fill="#c4cad1" stroke="#6b7480" stroke-width="2"/>' +
        '<rect x="140" y="20" width="66" height="60" rx="9" fill="' + color + '" stroke="' + darken(color, 0.65) + '" stroke-width="2"/>' +
        '<rect x="176" y="27" width="15" height="46" rx="3" fill="#1b2a3a"/>' +
        '<rect x="200" y="26" width="5" height="12" rx="2" fill="#fff3a0"/><rect x="200" y="62" width="5" height="12" rx="2" fill="#fff3a0"/>' +
      '</svg>'
    );
  }

  function renderGarage() {
    const d = S.data;
    const cond = Math.round(d.condition);
    const repairCost = S.repairCost();

    let left =
      '<div class="panel-card"><h3>' + esc(d.company) + '</h3>' + truckSvg(d.paint) +
      '<div class="row-between"><span>Condição</span><b>' + cond + '%</b></div>' +
      '<div class="w-row"><button class="btn success" data-act="repair"' + (repairCost === 0 ? ' disabled' : '') + '>' + ic('wrench') + ' ' +
      (repairCost === 0 ? 'Perfeito' : 'Reparar · ' + S.fmt(repairCost)) + '</button></div></div>';

    let right = '<div class="panel-card"><h3>Upgrades do Veículo</h3>' + ['engine', 'brakes', 'steering'].map((key) => {
      const u = S.UPGRADES[key];
      const lvl = S.upgradeLevel(key);
      const cost = S.upgradeCost(key);
      return '<div class="upg"><b>' + u.name + ' · nível ' + lvl + '/3</b>' +
        (cost == null ? '<span>Máx</span>' : '<button class="btn primary sm" data-act="upgrade" data-key="' + key + '"' + (d.money < cost ? ' disabled' : '') + '>' + S.fmt(cost) + '</button>') +
        '</div>';
    }).join('') + '</div>';

    return '<div class="app-head"><div><h2>Garagem</h2></div></div><div class="garage-grid"><div>' + left + '</div><div>' + right + '</div></div>';
  }

  /* ---------- APP: EMPRESA ---------- */
  function renderCompany() {
    const d = S.data;
    const lvl = S.level();
    const lp = S.levelProgress();
    return (
      '<div class="app-head"><div><h2>Minha Transportadora</h2><p class="sub">Nível ' + lvl + ' de ' + S.MAX_LEVEL + '</p></div></div>' +
      '<div class="co-grid">' +
        '<div class="panel-card"><h3>Identidade</h3>' +
          '<div class="field"><input id="co-name" type="text" maxlength="24" value="' + esc(d.company) + '" />' +
          '<button class="btn primary" data-act="rename">Salvar</button></div>' +
          '<div class="lvl-bar"><div class="row-between"><span>Progresso de Nível</span><b>' + lp.done + '/' + lp.need + '</b></div>' +
          '<div class="meter"><i style="width:' + Math.round(lp.pct * 100) + '%"></i></div></div>' +
        '</div>' +
      '</div>'
    );
  }

  function renderApp() {
    if (!ui.app) return;
    let html = '';
    if (ui.app === 'contracts') html = renderContracts();
    else if (ui.app === 'store') html = renderStore();
    else if (ui.app === 'fleet') html = renderFleet();
    else if (ui.app === 'bank') html = renderBank();
    else if (ui.app === 'garage') html = renderGarage();
    else if (ui.app === 'company') html = renderCompany();
    el.winBody.innerHTML = html;
  }

  function openApp(id) {
    const app = appById(id);
    if (!app) return;
    ui.app = id;
    ui.confirmReset = false;
    el.win.classList.remove('hidden');
    el.winIco.innerHTML = '<span class="tile tone-' + app.tone + '">' + ic(app.icon) + '</span>';
    el.winTitle.textContent = app.name;
    renderApp();
    renderDock();
    el.winBody.scrollTop = 0;
  }

  function closeApp() {
    ui.app = null;
    ui.confirmReset = false;
    el.win.classList.add('hidden');
    renderDock();
    renderWidgets();
  }

  el.root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const act = b.dataset.act;
    let r;
    switch (act) {
      case 'open': openApp(b.dataset.app); break;
      case 'desktop': closeApp(); break;
      case 'power': close(); break;
      case 'tab': ui.tab = b.dataset.tab; renderApp(); break;
      case 'accept':
        r = S.acceptContract(b.dataset.id);
        toast(r.msg, r.ok ? 'ok' : 'err');
        renderApp();
        break;
      case 'cancel':
        r = S.cancelMission();
        toast(r.msg, r.ok ? 'ok' : 'err');
        renderApp();
        break;
      case 'repair':
        r = S.repair();
        toast(r.msg, r.ok ? 'ok' : 'err');
        renderApp();
        break;
      case 'upgrade':
        r = S.buyUpgrade(b.dataset.key);
        toast(r.msg, r.ok ? 'ok' : 'err');
        renderApp();
        break;
      case 'buy-stock':
        r = S.buyStock(parseInt(b.dataset.qty, 10), parseInt(b.dataset.cost, 10));
        toast(r.msg, r.ok ? 'ok' : 'err');
        renderApp();
        break;
      case 'buy-truck':
        r = S.buyTruck();
        toast(r.msg, r.ok ? 'ok' : 'err');
        renderApp();
        break;
      case 'special-upg':
        r = S.buyUpgrade(b.dataset.key);
        toast(r.msg, r.ok ? 'ok' : 'err');
        renderApp();
        break;
      case 'rename':
        r = S.rename($('#co-name') ? $('#co-name').value : '');
        toast(r.msg, r.ok ? 'ok' : 'err');
        renderApp();
        break;
      default: break;
    }
  });

  S.subscribe(() => {
    if (!ui.open) return;
    renderChrome();
    renderWidgets();
  });

  function open(onClose) {
    ui.open = true;
    ui.onClose = onClose || null;
    ui.app = null;
    ui.tab = 'available';
    ui.confirmReset = false;
    el.root.classList.remove('hidden');
    el.win.classList.add('hidden');
    renderChrome();
    renderIcons();
    renderDock();
    renderWidgets();
    tickClock();
    clearInterval(ui.clock);
    ui.clock = setInterval(tickClock, 15000);
  }

  function close() {
    if (!ui.open) return;
    ui.open = false;
    clearInterval(ui.clock);
    el.root.classList.add('hidden');
    S.save();
    const cb = ui.onClose;
    ui.onClose = null;
    if (cb) cb();
  }

  TC.pc = { open: open, close: close };
})();
