/* ============================================================
   TRUCK CITY - content.js  (Fase 4A)
   Conteúdo novo de missões (destinos e contratos) somado ao store.
   Carrega DEPOIS do store.js e ANTES do pc.js e do game.js.
   A chave de cada destino é a mesma da zona no game.js.
   ============================================================ */
(function () {
  'use strict';

  const TC = window.TC;
  const S = TC.store;

  /* ---------- Destinos novos ---------- */
  S.DEST.build   = { name: 'Zona de Construção', where: 'Nova Cidade · via BR-116 Norte', far: true };
  S.DEST.quarry  = { name: 'Pedreira',           where: 'Estrada da Pedreira (oeste)',   far: true };
  S.DEST.sawmill = { name: 'Serraria',           where: 'Estrada da Serraria (leste)',   far: true };

  /* ---------- Contratos novos ---------- */
  const NEW_CONTRACTS = [
    { id: 'c9',  client: 'Construtora Horizonte',  title: 'Vigas de aço para a Nova Cidade', cargo: 'Vigas · 24 un',      color: '#7f8c9a', to: 'build',   pay: 5200, time: 230, risk: 'medio', level: 2 },
    { id: 'c10', client: 'Concreteira Rio Verde',  title: 'Concreto para as fundações',      cargo: 'Concreto · 6 m³',    color: '#9aa0a6', to: 'build',   pay: 6400, time: 210, risk: 'alto',  level: 3 },
    { id: 'c11', client: 'Pedreira São Jorge',     title: 'Peças para a britadeira',         cargo: 'Peças · 14 caixas',  color: '#c0392b', to: 'quarry',  pay: 3600, time: 170, risk: 'baixo', level: 2 },
    { id: 'c12', client: 'Serraria Pinheiro',      title: 'Serras e correntes',              cargo: 'Ferramentas · 20 un', color: '#e67e22', to: 'sawmill', pay: 3400, time: 170, risk: 'baixo', level: 2 },
    { id: 'c13', client: 'Horizonte Engenharia',   title: 'Maquinário para a Nova Cidade',   cargo: 'Máquinas · 2 un',    color: '#f1c40f', to: 'build',   pay: 8200, time: 240, risk: 'alto',  level: 3 },
  ];

  NEW_CONTRACTS.forEach((c) => {
    if (!S.contract(c.id)) S.CONTRACTS.push(c);
  });

  /* ---------- Recupera missão salva de contrato novo ----------
     O store.js apaga em memória uma missão cujo contrato ainda não existia
     quando ele carregou. Aqui devolvemos essa missão (agora o contrato existe). */
  try {
    const raw = JSON.parse(localStorage.getItem('truckcity.save.v1') || 'null');
    if (raw && raw.mission && !S.data.mission && S.contract(raw.mission.id)) {
      S.data.mission = raw.mission;
    }
  } catch (e) { /* ignora */ }
})();
