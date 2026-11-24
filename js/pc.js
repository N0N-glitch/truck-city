/* ============================================================
   TRUCK CITY - pc.js  (Fase 4B) - TruckOS
   Computador da transportadora E modo "celular" (Celular Móvel):
   área de trabalho, janelas e apps (Contratos, Loja, Banco, Garagem, Empresa).
   Uso: TC.pc.open(callbackAoFechar)  -> computador do escritório
        TC.pc.openPhone()             -> celular (só se já foi comprado)
   ============================================================ */
(function () {
  'use strict';

  const TC = window.TC;
  const S = TC.store;
  const $ = (s) => document.querySelector(s);

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  /* ---------- ÍCONES (SVG de traço, 24x24) ---------- */
  const ICON = {
    clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5V3h6v1.5"/><path d="M9 13l2.2 2.2L15.5 11"/>',
    wallet: '<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18"/><circle cx="16.5" cy="14.5" r="1.3"/>',
    truck: '<path d="M2 6.5h11V16H2z"/><path d="M13 9.5h4l3 3.2V16h-7z"/><circle cx="6.5" cy="17.5" r="2"/><circle cx="16.5" cy="17.5" r="2"/>',
    building: '<path d="M4 21V6l8-3 8 3v15"/><path d="M9 9h2M13 9h2M9 13h2M13 13h2"/><path d="M10 21v-4h4v4"/>',
    cart: '<circle cx="9" cy="20" r="1.6"/><circle cx="18" cy="20" r="1.6"/><path d="M3 4h2.5l2.4 11.2a1 1 0 0 0 1 .8h8.6a1 1 0 0 0 1-.8L20 8H6.2"/>',
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.4"/><path d="M11 18.5h2"/>',
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

  // phone: true = o app também existe no Celular Móvel
  const APPS = [
    { id: 'contracts', name: 'Contratos', icon: 'clipboard', tone: 'blue',   phone: true },
    { id: 'shop',      name: 'Loja',      icon: 'cart',      tone: 'teal',   phone: true },
    { id: 'bank',      name: 'Banco',     icon: 'wallet',    tone: 'green',  phone: true },
    { id: 'garage',    name: 'Garagem',   icon: 'truck',     tone: 'orange' },
    { id: 'company',   name: 'Empresa',   icon: 'building',  tone: 'purple' },
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

  const ui = {
    open: false, phone: false, app: null, tab: 'available', shopTab: 'goods',
    onClose: null, clock: null, toastTimer: null, confirmReset: false,
  };

  // Apps visíveis: o celular mostra só os que têm phone:true
  const visibleApps = () => APPS.filter((a) => !ui.phone || a.phone);

  /* ---------- UTILITÁRIOS ---------- */
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

  /* ---------- CASCA (barra superior, ícones, dock, widgets) ---------- */
  function renderChrome() {
    el.company.textContent = S.data.company;
    el.money.textContent = S.fmt(S.data.money);
  }

  function renderIcons() {
    el.icons.innerHTML = visibleApps().map((a) =>
      '<button class="desk-icon" data-act="open" data-app="' + a.id + '">' +
        '<span class="tile tone-' + a.tone + '">' + ic(a.icon) + '</span>' +
        '<span>' + a.name + '</span>' +
      '</button>'
    ).join('');
  }

  function renderDock() {
    el.dockApps.innerHTML = visibleApps().map((a) =>
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
    const ids = Object.keys(S.GOODS);
    const have = ids.filter((id) => S.stockOf(id) > 0).length;

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
        '<div class="w-sub">Abra Contratos para aceitar uma entrega.</div>' +
        '<div class="w-row"><button class="btn sm primary" data-act="open" data-app="contracts">Abrir Contratos</button></div>';
    }

    el.widgets.innerHTML =
      '<div class="w-card"><div class="w-label">' + ic('wallet') + ' SALDO</div>' +
        '<div class="w-big">' + S.fmt(d.money) + '</div>' +
        '<div class="w-sub">' + d.deliveries + ' entregas · ' + S.fmt(d.earned) + ' ganhos</div></div>' +
      '<div class="w-card"><div class="w-label">' + ic('clipboard') + ' MISSÃO ATUAL</div>' + missionHtml + '</div>' +
      '<div class="w-card"><div class="w-label">' + ic('box') + ' ESTOQUE</div>' +
        '<h4>' + have + ' de ' + ids.length + ' mercadorias em estoque</h4>' +
        '<div class="w-sub">Cada contrato consome mercadorias ao ser aceito.</div>' +
        '<div class="w-row"><button class="btn sm primary" data-act="open" data-app="shop">Abrir Loja</button></div></div>' +
      '<div class="w-card"><div class="w-label">' + ic('star') + ' NÍVEL DA TRANSPORTADORA</div>' +
        '<div class="w-big" style="color:#ffd978">Nível ' + lvl + '</div>' +
        '<div class="meter"><i style="width:' + Math.round(lp.pct * 100) + '%"></i></div>' +
        '<div class="w-sub" style="margin-top:6px">' + (lp.max ? 'Nível máximo!' : lp.done + '/' + lp.need + ' entregas para o próximo nível') + '</div></div>';
  }

  /* ---------- APP: CONTRATOS ---------- */
  // Linhas das mercadorias que o contrato consome (verde = tem, vermelho = falta)
  function goodsLines(c) {
    const need = S.goodsFor(c);
    return Object.keys(need).map((id) => {
      const g = S.GOODS[id];
      const have = S.stockOf(id);
      return '<li>' + ic('box') + '<span>Consome ' + esc(g.name) + ' ×' + need[id] +
        ' <em class="' + (have >= need[id] ? 'need-ok' : 'need-miss') + '">(estoque ' + have + ')</em></span></li>';
    }).join('');
  }

  function contractCard(c, lvl, hasMission) {
    const dest = S.DEST[c.to];
    const locked = c.level > lvl;
    let action;
    if (locked) {
      action = '<span class="lock">' + ic('lock') + ' Nível ' + c.level + '</span>';
    } else if (S.missingGoods(c).length) {
      action = '<button class="btn sm" data-act="open" data-app="shop">Comprar estoque</button>';
    } else {
      action = '<button class="btn primary sm" data-act="accept" data-id="' + c.id + '"' + (hasMission ? ' disabled' : '') + '>Aceitar</button>';
    }
    return (
      '<article class="c-card risk-' + c.risk + (locked ? ' locked' : '') + '">' +
        '<div class="c-top"><span class="tag tag-' + c.risk + '">' + RISK[c.risk] + '</span>' +
        (dest.far ? '<span class="tag tag-far">' + ic('road') + ' Via rodovia</span>' : '<span class="tag tag-near">Na cidade</span>') + '</div>' +
        '<h3>' + esc(c.title) + '</h3>' +
        '<p class="client">' + esc(c.client) + '</p>' +
        '<ul class="c-info">' +
          '<li>' + ic('box') + '<span><i style="background:' + c.color + '"></i>' + esc(c.cargo) + '</span></li>' +
          '<li>' + ic('route') + '<span>Zona de Carga → ' + esc(dest.name) + '</span></li>' +
          '<li>' + ic('clock') + '<span>Prazo: ' + fmtTime(c.time) + ' após carregar</span></li>' +
          goodsLines(c) +
        '</ul>' +
        '<div class="c-foot"><span class="pay">' + S.fmt(c.pay) + '</span>' + action + '</div>' +
      '</article>'
    );
  }

  function renderContracts() {
    const d = S.data;
    const m = d.mission;
    const lvl = S.level();
    let h =
      '<div class="app-head"><div><h2>Central de Contratos</h2>' +
      '<p class="sub">Aceitar um contrato consome mercadorias do estoque. Depois estacione na Zona de Carga, leve a carga ao destino e receba.</p></div>' +
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
            '<div class="step ' + (picked ? 'done' : 'now') + '"><span class="num">' + (picked ? ic('check') : '1') + '</span><span>Carregar na <b>Zona de Carga</b> (Truck City)</span></div>' +
            '<div class="step ' + (picked ? 'now' : '') + '"><span class="num">2</span><span>Entregar em <b>' + esc(dest.name) + '</b><br><small style="opacity:.7">' + esc(dest.where) + '</small></span></div>' +
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
      h += '<div class="c-grid">' + S.CONTRACTS.map((c) => contractCard(c, lvl, !!m)).join('') + '</div>';
    } else if (!d.history.length) {
      h += '<div class="empty">Você ainda não concluiu nenhuma entrega.</div>';
    } else {
      h += '<div class="tx-list">' + d.history.map((x) =>
        '<div class="tx in"><span class="dot">' + ic('check') + '</span><div class="t"><b>' + esc(x.title) + '</b><span>' + fmtDate(x.t) + '</span></div><span class="amt">+ ' + S.fmt(x.total) + '</span></div>'
      ).join('') + '</div>';
    }
    return h;
  }

  /* ---------- APP: LOJA E ESTOQUE ---------- */
  function goodsCard(id) {
    const d = S.data;
    const g = S.GOODS[id];
    const qty = S.stockOf(id);
    const pct = qty / g.cap;
    const cls = pct < 0.15 ? 'low' : pct < 0.4 ? 'mid' : 'ok';

    const buyBtn = (n) => {
      const amount = g.lot * n;
      const cost = g.price * amount;
      const off = d.money < cost || qty + amount > g.cap;
      return '<button class="btn sm primary" data-act="buy" data-id="' + id + '" data-lots="' + n + '"' + (off ? ' disabled' : '') + '>+' + amount + ' · ' + S.fmt(cost) + '</button>';
    };

    return (
      '<article class="g-card">' +
        '<div class="g-head"><b>' + esc(g.name) + '</b><span class="g-price">' + S.fmt(g.price) + ' / ' + esc(g.unit) + '</span></div>' +
        '<div class="g-qty">Em estoque: <b>' + qty + '</b> / ' + g.cap + ' ' + esc(g.unit) + '</div>' +
        '<div class="meter cond"><i class="' + cls + '" style="width:' + Math.round(pct * 100) + '%"></i></div>' +
        '<div class="g-actions">' + buyBtn(1) + buyBtn(5) + '</div>' +
      '</article>'
    );
  }

  function renderShop() {
    const d = S.data;
    let h =
      '<div class="app-head"><div><h2>Loja &amp; Estoque</h2>' +
      '<p class="sub">Reponha as mercadorias que os contratos consomem e invista em equipamentos.</p></div>' +
      '<span class="chip" style="color:#7dff9a">' + S.fmt(d.money) + '</span></div>' +
      '<div class="seg-tabs">' +
        '<button class="seg-tab' + (ui.shopTab === 'goods' ? ' active' : '') + '" data-act="shop-tab" data-tab="goods">Mercadorias</button>' +
        '<button class="seg-tab' + (ui.shopTab === 'gear' ? ' active' : '') + '" data-act="shop-tab" data-tab="gear">Equipamentos</button>' +
      '</div>';

    if (ui.shopTab === 'goods') {
      h += '<div class="shop-grid">' + Object.keys(S.GOODS).map(goodsCard).join('') + '</div>';
    } else {
      const price = S.PHONE_PRICE;
      h +=
        '<div class="gear-card">' +
          '<span class="tile tone-teal">' + ic('phone') + '</span>' +
          '<div class="info"><b>Celular Móvel</b>' +
          '<span>Abra Contratos, Loja e Banco de qualquer lugar do mapa, direto do ícone no canto da tela (apenas a pé, fora do caminhão).</span>' +
          '<div class="gear-price">' + S.fmt(price) + '</div></div>' +
          (d.phone
            ? '<span class="lock">' + ic('check') + ' Adquirido</span>'
            : '<button class="btn success" data-act="buy-phone"' + (d.money < price ? ' disabled' : '') + '>Comprar</button>') +
        '</div>';
    }
    return h;
  }

  /* ---------- APP: BANCO ---------- */
  function renderBank() {
    const d = S.data;
    const avg = d.deliveries ? Math.round(d.earned / d.deliveries) : 0;
    let h =
      '<div class="app-head"><div><h2>Banco da Transportadora</h2><p class="sub">Saldo, receitas e despesas da empresa.</p></div></div>' +
      '<div class="bal-card"><div class="lbl">SALDO DISPONÍVEL</div><div class="val">' + S.fmt(d.money) + '</div><div class="owner">' + esc(d.company) + '</div></div>' +
      '<div class="stat-tiles">' +
        '<div class="stat-tile"><div class="k">RECEITA TOTAL</div><div class="v" style="color:#7dffb0">' + S.fmt(d.earned) + '</div></div>' +
        '<div class="stat-tile"><div class="k">DESPESAS</div><div class="v" style="color:#ff9c9c">' + S.fmt(d.spent) + '</div></div>' +
        '<div class="stat-tile"><div class="k">ENTREGAS</div><div class="v">' + d.deliveries + '</div></div>' +
        '<div class="stat-tile"><div class="k">TICKET MÉDIO</div><div class="v">' + S.fmt(avg) + '</div></div>' +
      '</div>' +
      '<div class="panel-card"><h3>Extrato</h3>';

    if (!d.log.length) {
      h += '<div class="empty">Nenhuma movimentação ainda.</div>';
    } else {
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
    const r = Math.round(((n >> 16) & 255) * k);
    const g = Math.round(((n >> 8) & 255) * k);
    const b = Math.round((n & 255) * k);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function truckSvg(color) {
    return (
      '<svg class="truck-prev" viewBox="0 0 220 100" aria-hidden="true">' +
        '<rect x="14" y="26" width="26" height="9" rx="3" fill="#111"/><rect x="14" y="66" width="26" height="9" rx="3" fill="#111"/>' +
        '<rect x="6" y="18" width="130" height="64" rx="7" fill="#c4cad1" stroke="#6b7480" stroke-width="2"/>' +
        '<rect x="140" y="20" width="66" height="60" rx="9" fill="' + color + '" stroke="' + darken(color, 0.65) + '" stroke-width="2"/>' +
        '<rect x="176" y="27" width="15" height="46" rx="3" fill="#1b2a3a"/>' +
        '<rect x="200" y="26" width="5" height="12" rx="2" fill="#fff3a0"/><rect x="200" y="62" width="5" height="12" rx="2" fill="#fff3a0"/>' +
        '<rect x="160" y="14" width="30" height="9" rx="3" fill="#111"/><rect x="160" y="77" width="30" height="9" rx="3" fill="#111"/>' +
      '</svg>'
    );
  }

  function renderGarage() {
    const d = S.data;
    const mods = S.mods();
    const cond = Math.round(d.condition);
    const condCls = cond >= 60 ? 'ok' : cond >= 30 ? 'mid' : 'low';
    const repairCost = S.repairCost();

    const stats = [
      ['Velocidade máxima', Math.round(70 * mods.maxFwd) + ' km/h', Math.min(1, mods.maxFwd / 1.3)],
      ['Aceleração', '+' + Math.round((mods.accel - 1) * 100) + '%', Math.min(1, mods.accel / 1.3)],
      ['Frenagem', '+' + Math.round((mods.brake - 1) * 100) + '%', Math.min(1, mods.brake / 1.4)],
      ['Direção', '+' + Math.round((mods.steerRate - 1) * 100) + '%', Math.min(1, mods.steerRate / 1.4)],
    ];

    const left =
      '<div class="panel-card"><h3>' + esc(d.company) + ' · Caminhão-baú</h3>' + truckSvg(d.paint) +
      '<div class="row-between"><span>Condição</span><b>' + cond + '%</b></div>' +
      '<div class="meter cond"><i class="' + condCls + '" style="width:' + cond + '%"></i></div>' +
      (mods.perf < 1 ? '<p class="w-sub" style="color:#ffb84d;margin:8px 0 0">Motor danificado: desempenho reduzido em 20%. Faça o reparo!</p>' : '') +
      '<div class="w-row"><button class="btn success" data-act="repair"' + (repairCost === 0 ? ' disabled' : '') + '>' + ic('wrench') + ' ' +
      (repairCost === 0 ? 'Em perfeito estado' : 'Reparar · ' + S.fmt(repairCost)) + '</button></div>' +
      '<div style="margin-top:16px">' +
      stats.map((s) =>
        '<div class="stat-line"><div class="row-between"><span>' + s[0] + '</span><b>' + s[1] + '</b></div><div class="meter"><i style="width:' + Math.round(s[2] * 100) + '%"></i></div></div>'
      ).join('') + '</div></div>';

    const upgIcons = { engine: ['engine', 'orange'], brakes: ['brake', 'red'], steering: ['wheel', 'blue'] };
    let right = '<div class="panel-card"><h3>Upgrades</h3>' + Object.keys(S.UPGRADES).map((key) => {
      const u = S.UPGRADES[key];
      const lvl = S.upgradeLevel(key);
      const cost = S.upgradeCost(key);
      const pips = [0, 1, 2].map((i) => '<i class="' + (i < lvl ? 'on' : '') + '"></i>').join('');
      return '<div class="upg"><span class="tile tone-' + upgIcons[key][1] + '">' + ic(upgIcons[key][0]) + '</span>' +
        '<div class="info"><b>' + u.name + ' · nível ' + lvl + '/3</b><span>' + u.desc + '</span><div class="pips">' + pips + '</div></div>' +
        (cost == null
          ? '<span class="lock">' + ic('check') + ' Máx.</span>'
          : '<button class="btn primary sm" data-act="upgrade" data-key="' + key + '"' + (d.money < cost ? ' disabled' : '') + '>' + S.fmt(cost) + '</button>') +
        '</div>';
    }).join('') + '</div>';

    right += '<div class="panel-card" style="margin-top:16px"><h3>' + ic('paint') + ' Pintura da cabine</h3><div class="swatches" style="padding-bottom:18px">' +
      S.PAINTS.map((p) => {
        const owned = d.paintsOwned.indexOf(p.color) !== -1;
        return '<button class="swatch' + (d.paint === p.color ? ' sel' : '') + '" style="background:' + p.color + '" data-act="paint" data-color="' + p.color + '" title="' + p.name + '">' +
          '<span class="price">' + (d.paint === p.color ? 'atual' : owned ? 'sua' : S.fmt(S.PAINT_COST)) + '</span></button>';
      }).join('') + '</div></div>';

    return '<div class="app-head"><div><h2>Garagem</h2><p class="sub">Mantenha o caminhão em dia e invista em melhorias de desempenho.</p></div></div>' +
      '<div class="garage-grid"><div>' + left + '</div><div>' + right + '</div></div>';
  }

  /* ---------- APP: EMPRESA ---------- */
  function renderCompany() {
    const d = S.data;
    const lvl = S.level();
    const lp = S.levelProgress();
    return (
      '<div class="app-head"><div><h2>Minha Transportadora</h2><p class="sub">Perfil da empresa, reputação e opções.</p></div>' +
      '<span class="lvl-pill">' + ic('star') + ' Nível ' + lvl + '</span></div>' +
      '<div class="co-grid">' +
        '<div class="panel-card"><h3>Identidade</h3>' +
          '<div class="w-sub">Nome da transportadora</div>' +
          '<div class="field"><input id="co-name" type="text" maxlength="24" value="' + esc(d.company) + '" autocomplete="off" />' +
          '<button class="btn primary" data-act="rename">Salvar</button></div>' +
          '<div class="lvl-bar"><div class="row-between"><span>Reputação</span><b>' + (lp.max ? 'Máximo' : lp.done + '/' + lp.need) + '</b></div>' +
          '<div class="meter"><i style="width:' + Math.round(lp.pct * 100) + '%"></i></div></div>' +
          '<p class="w-sub">A cada ' + S.LEVEL_STEP + ' entregas você sobe de nível e libera contratos melhores.</p></div>' +
        '<div class="panel-card"><h3>Estatísticas</h3><div class="kv">' +
          '<div><span>Entregas concluídas</span><b>' + d.deliveries + '</b></div>' +
          '<div><span>Receita total</span><b>' + S.fmt(d.earned) + '</b></div>' +
          '<div><span>Despesas</span><b>' + S.fmt(d.spent) + '</b></div>' +
          '<div><span>Saldo atual</span><b>' + S.fmt(d.money) + '</b></div>' +
          '<div><span>Condição do caminhão</span><b>' + Math.round(d.condition) + '%</b></div>' +
          '<div><span>Celular Móvel</span><b>' + (d.phone ? 'Sim' : 'Não') + '</b></div>' +
        '</div></div>' +
        '<div class="panel-card danger-zone" style="grid-column:1/-1"><h3>Opções</h3>' +
          '<p class="w-sub" style="margin:0 0 10px">Reiniciar apaga saldo, estoque, upgrades, pintura, histórico, celular e o contrato ativo. Esta ação não pode ser desfeita.</p>' +
          (ui.confirmReset
            ? '<div class="w-row" style="margin-top:0"><button class="btn danger" data-act="reset-yes">Confirmar: apagar tudo</button><button class="btn" data-act="reset-no">Cancelar</button></div>'
            : '<button class="btn danger" data-act="reset">Reiniciar progresso</button>') +
        '</div>' +
      '</div>'
    );
  }

  /* ---------- JANELA ---------- */
  function renderApp() {
    if (!ui.app) return;
    let html = '';
    if (ui.app === 'contracts') html = renderContracts();
    else if (ui.app === 'shop') html = renderShop();
    else if (ui.app === 'bank') html = renderBank();
    else if (ui.app === 'garage') html = renderGarage();
    else if (ui.app === 'company') html = renderCompany();
    // preserva a rolagem ao redesenhar (ex.: depois de comprar)
    const top = el.winBody.scrollTop;
    el.winBody.innerHTML = html;
    el.winBody.scrollTop = top;
  }

  function openApp(id) {
    const app = appById(id);
    if (!app || (ui.phone && !app.phone)) return;
    ui.app = id;
    ui.confirmReset = false;
    el.win.classList.remove('hidden');
    el.winIco.innerHTML = '<span class="tile tone-' + app.tone + '">' + ic(app.icon) + '</span>';
    el.winTitle.textContent = app.name;
    el.winBody.scrollTop = 0;
    renderApp();
    renderDock();
  }

  function closeApp() {
    ui.app = null;
    ui.confirmReset = false;
    el.win.classList.add('hidden');
    renderDock();
    renderWidgets();
  }

  /* ---------- EVENTOS ---------- */
  function run(r) {
    toast(r.msg, r.ok ? 'ok' : 'err');
    renderApp();
  }

  el.root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    switch (b.dataset.act) {
      case 'open': openApp(b.dataset.app); break;
      case 'desktop': closeApp(); break;
      case 'power': close(); break;
      case 'tab': ui.tab = b.dataset.tab; renderApp(); break;
      case 'shop-tab': ui.shopTab = b.dataset.tab; renderApp(); break;
      case 'accept': run(S.acceptContract(b.dataset.id)); break;
      case 'cancel': run(S.cancelMission()); break;
      case 'buy': run(S.buyGoods(b.dataset.id, Number(b.dataset.lots))); break;
      case 'buy-phone': run(S.buyPhone()); break;
      case 'repair': run(S.repair()); break;
      case 'upgrade': run(S.buyUpgrade(b.dataset.key)); break;
      case 'paint': run(S.setPaint(b.dataset.color)); break;
      case 'rename': {
        const input = $('#co-name');
        run(S.rename(input ? input.value : ''));
        break;
      }
      case 'reset': ui.confirmReset = true; renderApp(); break;
      case 'reset-no': ui.confirmReset = false; renderApp(); break;
      case 'reset-yes':
        ui.confirmReset = false;
        S.reset();
        toast('Progresso reiniciado.', 'ok');
        renderApp();
        break;
      default: break;
    }
  });

  // Enter no campo de nome salva
  el.root.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target && e.target.id === 'co-name') {
      run(S.rename(e.target.value));
    }
  });

  // Esc: fecha a janela; sem janela, desliga o computador/celular
  document.addEventListener('keydown', (e) => {
    if (!ui.open || e.key !== 'Escape') return;
    if (ui.app) closeApp();
    else close();
  });

  // Com o celular aberto, as teclas do jogo (WASD, E, espaço) não chegam ao Phaser.
  // (capture = roda antes do Phaser; Esc passa para poder fechar)
  window.addEventListener('keydown', (e) => {
    if (ui.open && ui.phone && e.key !== 'Escape') e.stopImmediatePropagation();
  }, true);

  /* ---------- CELULAR MÓVEL ---------- */
  // O ícone só aparece (CSS) com body.phone-owned e o jogador fora do caminhão.
  function syncPhoneFlag() {
    document.body.classList.toggle('phone-owned', !!S.data.phone);
  }
  syncPhoneFlag();

  // Atualiza o celular/barra/widgets quando o estado muda
  S.subscribe(() => {
    syncPhoneFlag();
    if (!ui.open) return;
    renderChrome();
    renderWidgets();
  });

  const phoneBtn = $('#btn-phone');
  if (phoneBtn) phoneBtn.addEventListener('click', () => openPhone());

  /* ---------- ABRIR / FECHAR ---------- */
  function open(onClose, phone) {
    ui.open = true;
    ui.phone = !!phone;
    ui.onClose = onClose || null;
    ui.app = null;
    ui.tab = 'available';
    ui.shopTab = 'goods';
    ui.confirmReset = false;
    el.root.classList.toggle('phone-mode', ui.phone);
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

  function openPhone() {
    if (ui.open || !S.data.phone) return;
    open(null, true);
  }

  function close() {
    if (!ui.open) return;
    ui.open = false;
    clearInterval(ui.clock);
    el.root.classList.add('hidden');
    el.root.classList.remove('phone-mode');
    ui.phone = false;
    S.save();
    const cb = ui.onClose;
    ui.onClose = null;
    if (cb) cb();
  }

  TC.pc = { open: open, openPhone: openPhone, close: close };
})();
