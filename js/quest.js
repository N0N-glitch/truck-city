/* ============================================================
   TRUCK CITY - quest.js  (Atualização 4.0)
   História do porão (extensão do store; store.js continua separado):
   - lanterna (compra na Loja)
   - materiais da casinha (só aparecem na Loja depois do SIM ao morador)
   - 3 missões especiais gratuitas (consomem materiais, não pagam dinheiro)
   - recompensa final: dinheiro, +2 níveis e reputação
   Estados da história (data.quest.stage):
     'none' -> ainda não conversou | 'reported' -> denunciou (fim)
     'accepted' -> fazendo as missões | 'done' -> casinha construída
   Carrega DEPOIS de fleet.js e ANTES de pc.js.
   ============================================================ */
(function () {
  'use strict';

  const TC = window.TC;
  const S = TC.store;
  const KEY = 'truckcity.save.v1';

  /* ---------- CONFIGURAÇÃO ---------- */
  const FLASH_PRICE = 350;
  const REWARD = { money: 20000, levels: 2, reputation: 1000 };

  // materiais vendidos na Loja (só durante a história)
  const MATS = {
    cement: { name: 'Cimento', unit: 'sacos',  price: 12, lot: 10, cap: 300 },
    bricks: { name: 'Tijolos', unit: 'un',     price: 4,  lot: 20, cap: 600 },
    wood:   { name: 'Madeira', unit: 'peças',  price: 15, lot: 10, cap: 300 },
    tiles:  { name: 'Telhas',  unit: 'un',     price: 8,  lot: 20, cap: 600 },
  };

  // Missões especiais: carregam na Zona de Carga e entregam na Zona de Obra (to: 'work')
  const QUEST = [
    { id: 'q1', quest: 1, client: 'Morador do porão', title: 'Casinha · Fundação', cargo: 'Cimento · 20 sacos',      color: '#b9b9b9', to: 'work', pay: 0, time: 150, risk: 'baixo', level: 1, free: true, mats: { cement: 20 } },
    { id: 'q2', quest: 2, client: 'Morador do porão', title: 'Casinha · Paredes',  cargo: 'Tijolos e cimento',       color: '#b5543a', to: 'work', pay: 0, time: 150, risk: 'baixo', level: 1, free: true, mats: { bricks: 80, cement: 10 } },
    { id: 'q3', quest: 3, client: 'Morador do porão', title: 'Casinha · Telhado',  cargo: 'Madeira e telhas',        color: '#c0392b', to: 'work', pay: 0, time: 150, risk: 'baixo', level: 1, free: true, mats: { wood: 30, tiles: 60 } },
  ];
  QUEST.forEach((c) => { if (!S.contract(c.id)) S.CONTRACTS.push(c); });

  /* ---------- ESTADO EXTRA (salvo junto com o resto) ----------
     O store.js só carrega campos que ele conhece; por isso lemos o save
     de novo aqui e restauramos lanterna, materiais, história, níveis e reputação. */
  const STAGES = ['none', 'reported', 'accepted', 'done'];

  function initExtras(raw) {
    const d = S.data;
    const r = raw || {};
    d.flashlight = !!r.flashlight;
    d.mats = {};
    Object.keys(MATS).forEach((k) => {
      const n = r.mats ? Number(r.mats[k]) : 0;
      d.mats[k] = isFinite(n) && n > 0 ? Math.floor(n) : 0;
    });
    const q = r.quest || {};
    d.quest = {
      stage: STAGES.indexOf(q.stage) !== -1 ? q.stage : 'none',
      step: isFinite(q.step) ? Math.max(0, Math.min(QUEST.length, Math.floor(q.step))) : 0,
    };
    if (d.quest.stage === 'accepted' && d.quest.step >= QUEST.length) d.quest.stage = 'done';
    d.levelBonus = isFinite(r.levelBonus) ? Math.max(0, Math.min(10, Math.floor(r.levelBonus))) : 0;
    d.reputation = isFinite(r.reputation) ? Math.max(0, Math.floor(r.reputation)) : 0;
  }

  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { raw = null; }
  initExtras(raw);
  // missão salva de contrato criado depois do store (ex.: missão especial)
  if (raw && raw.mission && !S.data.mission && S.contract(raw.mission.id)) S.data.mission = raw.mission;

  // "Reiniciar progresso" também zera a história
  const baseReset = S.reset;
  S.reset = function () {
    baseReset();
    initExtras(null);
    S.save();
    S.touch();
  };

  const fail = (msg) => ({ ok: false, msg: msg });
  const ok = (msg) => ({ ok: true, msg: msg });

  /* ---------- NÍVEL (soma o bônus da recompensa) ---------- */
  S.level = function () {
    const d = S.data;
    return Math.min(S.MAX_LEVEL, 1 + Math.floor(d.deliveries / S.LEVEL_STEP) + (d.levelBonus || 0));
  };

  S.levelProgress = function () {
    if (S.level() >= S.MAX_LEVEL) return { done: S.LEVEL_STEP, need: S.LEVEL_STEP, pct: 1, max: true };
    const done = S.data.deliveries % S.LEVEL_STEP;
    return { done: done, need: S.LEVEL_STEP, pct: done / S.LEVEL_STEP, max: false };
  };

  /* ---------- API NOVA ---------- */
  Object.assign(S, {
    MATS: MATS,
    FLASH_PRICE: FLASH_PRICE,
    QUEST: QUEST,
    QUEST_REWARD: REWARD,

    matCount: function (id) { return S.data.mats[id] || 0; },

    // missão especial atual (ou null)
    questContract: function () {
      const q = S.data.quest;
      return q.stage === 'accepted' ? QUEST[q.step] || null : null;
    },

    // contratos visíveis nos apps: as missões especiais só aparecem quando liberadas, uma por vez
    visibleContracts: function () {
      const q = S.data.quest;
      return S.CONTRACTS.filter((c) => !c.quest || (q.stage === 'accepted' && c.quest === q.step + 1));
    },

    // o que falta de material para uma missão especial: [{ id, need, have }]
    missingMats: function (c) {
      const need = c.mats || {};
      return Object.keys(need)
        .filter((k) => S.matCount(k) < need[k])
        .map((k) => ({ id: k, need: need[k], have: S.matCount(k) }));
    },

    // --- escolha do jogador na conversa com o morador ---
    questAccept: function () {
      const q = S.data.quest;
      if (q.stage !== 'none') return false;
      q.stage = 'accepted';
      q.step = 0;
      S.touch();
      S.save();
      return true;
    },

    questReport: function () {
      const q = S.data.quest;
      if (q.stage !== 'none') return false;
      q.stage = 'reported';
      S.touch();
      S.save();
      return true;
    },

    // --- itens da Loja (a Loja do pc.js desenha o que esta função devolver) ---
    shopItems: function () {
      const d = S.data;
      const items = [{
        id: 'flashlight', kind: 'gear', icon: 'flash', tone: 'orange', name: 'Lanterna',
        desc: 'Ilumina ambientes escuros. Acende sozinha ao entrar em um lugar sem luz.',
        price: FLASH_PRICE, owned: !!d.flashlight,
      }];
      if (d.quest.stage === 'accepted') {
        const cur = S.questContract();
        Object.keys(MATS).forEach((k) => {
          const m = MATS[k];
          items.push({
            id: k, kind: 'goods', name: m.name, unit: m.unit, price: m.price, lot: m.lot, cap: m.cap,
            qty: S.matCount(k), need: cur && cur.mats[k] ? cur.mats[k] : 0,
          });
        });
      }
      return items;
    },

    buyShopItem: function (id, lots) {
      const d = S.data;
      if (id === 'flashlight') {
        if (d.flashlight) return fail('Você já tem a lanterna.');
        if (!S.spend(FLASH_PRICE, 'Lanterna')) return fail('Saldo insuficiente.');
        d.flashlight = true;
        S.touch();
        S.save();
        return ok('Lanterna comprada! Ela acende sozinha em lugares escuros.');
      }
      const m = MATS[id];
      if (!m || d.quest.stage !== 'accepted') return fail('Item indisponível.');
      const n = Math.max(1, Math.floor(lots) || 1);
      const qty = m.lot * n;
      if (S.matCount(id) + qty > m.cap) return fail('Limite de ' + m.name + ' no depósito: ' + m.cap + '.');
      if (!S.spend(m.price * qty, 'Compra: ' + m.name + ' ×' + qty)) return fail('Saldo insuficiente.');
      d.mats[id] = S.matCount(id) + qty;
      S.touch();
      S.save();
      return ok(m.name + ': +' + qty + ' ' + m.unit + '.');
    },
  });

  /* ---------- REGRAS DAS MISSÕES ESPECIAIS (embrulham funções do store) ---------- */

  // Aceitar: só na ordem, e consome os materiais comprados
  const baseAccept = S.acceptContract;
  S.acceptContract = function (id) {
    const c = S.contract(id);
    if (!c || !c.quest) return baseAccept(id);
    const d = S.data;
    if (d.quest.stage !== 'accepted' || c.quest !== d.quest.step + 1) return fail('Esta missão ainda não está disponível.');
    if (d.mission) return fail('Termine ou cancele o contrato atual primeiro.');
    const miss = S.missingMats(c);
    if (miss.length) return fail('Faltam materiais (' + miss.map((x) => MATS[x.id].name).join(', ') + '). Compre na Loja.');

    Object.keys(c.mats).forEach((k) => { d.mats[k] = S.matCount(k) - c.mats[k]; });
    const r = baseAccept(id);
    if (!r.ok) Object.keys(c.mats).forEach((k) => { d.mats[k] = S.matCount(k) + c.mats[k]; }); // devolve
    return r;
  };

  // Cancelar missão especial: sem multa; antes de carregar, os materiais voltam
  const basePenalty = S.cancelPenalty;
  S.cancelPenalty = function () {
    const m = S.data.mission;
    const c = m && S.contract(m.id);
    return c && c.quest ? 0 : basePenalty();
  };

  const baseCancel = S.cancelMission;
  S.cancelMission = function () {
    const d = S.data;
    const m = d.mission;
    const c = m && S.contract(m.id);
    if (!c || !c.quest) return baseCancel();
    const refund = m.stage === 'pickup';
    if (refund) Object.keys(c.mats).forEach((k) => { d.mats[k] = S.matCount(k) + c.mats[k]; });
    d.mission = null;
    S.touch();
    S.save();
    return ok('Missão cancelada.' + (refund ? ' Materiais devolvidos.' : ''));
  };

  // Funcionário automático não faz missão especial
  const baseDispatch = S.dispatchDelivery;
  S.dispatchDelivery = function (id) {
    const c = S.contract(id);
    if (c && c.quest) return fail('Esta missão especial só pode ser feita por você.');
    return baseDispatch(id);
  };

  // Entregar: sem dinheiro. Na última etapa, a recompensa e o fim da história.
  // Devolve null (o jogo não mostra o resumo padrão): mostramos o nosso.
  const baseComplete = S.completeMission;
  S.completeMission = function () {
    const d = S.data;
    const m = d.mission;
    const c = m && S.contract(m.id);
    if (!c || !c.quest) return baseComplete();

    d.mission = null;
    d.quest.step = Math.max(d.quest.step, c.quest);
    const finished = d.quest.step >= QUEST.length;
    let html;

    if (finished) {
      d.quest.stage = 'done';
      d.money += REWARD.money;
      d.earned += REWARD.money;
      d.levelBonus = Math.min(10, (d.levelBonus || 0) + REWARD.levels);
      d.reputation = (d.reputation || 0) + REWARD.reputation;
      S.logTx('Recompensa: casinha do morador', REWARD.money);
      d.history.unshift({ t: Date.now(), title: 'Casinha do morador concluída', total: REWARD.money });
      if (d.history.length > 12) d.history.length = 12;
      html =
        '<div class="sum-card">' +
          '<div class="sum-head">CASINHA CONCLUÍDA</div>' +
          '<div class="sum-title">O morador ganhou um lar!</div><dl>' +
          '<div class="plus"><dt>Dinheiro</dt><dd>+ ' + S.fmt(REWARD.money) + '</dd></div>' +
          '<div class="plus"><dt>Níveis</dt><dd>+ ' + REWARD.levels + '</dd></div>' +
          '<div class="plus"><dt>Reputação</dt><dd>+ ' + REWARD.reputation.toLocaleString('pt-BR') + ' pts</dd></div></dl>' +
          '<div class="sum-level">Sua transportadora agora é nível ' + S.level() + '!</div>' +
          '<p class="sum-note">A casinha apareceu ao lado da entrada do escritório.</p>' +
          '<button class="btn primary" data-close>Continuar</button></div>';
    } else {
      html =
        '<div class="sum-card">' +
          '<div class="sum-head">MISSÃO ESPECIAL CONCLUÍDA</div>' +
          '<div class="sum-title">' + c.title + '</div>' +
          '<p class="sum-note">Sem pagamento. Etapa ' + d.quest.step + ' de ' + QUEST.length + ' da casinha concluída.</p>' +
          '<button class="btn primary" data-close>Continuar</button></div>';
    }

    S.touch();
    S.save();
    TC.ui.showSummary(html);
    return null;
  };
})();
