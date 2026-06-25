/* ============================================================
   OrchOS · B — protótipo (interativo simulado)
   Arquitetura: store central (state) + setState(patch) + render().
   O usuário fala → o OS se reconfigura. Esse é o argumento da tese;
   o código tem que deixá-lo visível.
   ============================================================ */

/* ---------- 1. Estado (fonte única de verdade) ---------- */
const state = {
  boot:  'login',        // 'login' | 'shell'
  mode:  'padrao',       // 'padrao' | 'escrita' | 'jogo' | 'desenvolvimento' | 'conversa'
  agent: 'durin',        // 'durin' | 'desenvolvedor' | 'orientador'
  wallpaper: 'atelier',  // 'atelier' | 'bisao' | 'slit' | 'dots' | 'solido'
  tier: 'livre',         // plano do usuário: 'livre' | 'plus' | 'atelier' (desigualdade-alta)
  entitlements: {},      // desbloqueios avulsos (pós-paywall simulado): { 'mode:jogo': true }
  paywallTarget: null,   // ação travada aguardando upgrade { kind, id }
  gameActive: false,     // Modo Jogo: false = biblioteca em janela; true = jogo expandido no campo
  activeGame: null,
  // janelas flutuantes são geridas pelo WM (gerenciador de janelas), fora do state
  agentOffline: false,   // modo degradado: o agente perdeu conexão
  pendingConfirm: null,  // ação irreversível aguardando permissão do usuário
  threads: {
    durin:         [],
    desenvolvedor: [],
    orientador:    [],
  },
};

/* ---------- 2. Metadados dos agentes ---------- */
const AGENTS = {
  durin: {
    name: 'Durin', role: 'ORQUESTRADOR · ATIVO',
    icon: '<path d="M12 4 L13.2 10.8 L20 12 L13.2 13.2 L12 20 L10.8 13.2 L4 12 L10.8 10.8 Z" fill="currentColor"/>',
    greet: 'Olá. O que você quer fazer?',
  },
  desenvolvedor: {
    name: 'Desenvolvedor', role: 'CÓDIGO · BUILD · INFRA',
    icon: '<path d="M9 8 L5 12 L9 16 M15 8 L19 12 L15 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    greet: 'Pronto. Que parte do sistema a gente constrói?',
  },
  orientador: {
    name: 'Orientador', role: 'TESE · PESQUISA · ESCRITA',
    icon: '<path d="M12 5 L21 9 L12 13 L3 9 Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M6 10.5 L6 15 C6 15 8.6 17 12 17 C15.4 17 18 15 18 15 L18 10.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    greet: 'Sobre o que vamos pensar hoje? Traga o argumento.',
  },
};

const MODE_NAME = { padrao: 'Padrão', escrita: 'Escrita', jogo: 'Jogo', desenvolvimento: 'Desenvolvimento', conversa: 'Conversa' };
const MODE_AGENT = {
  padrao: 'durin',
  escrita: 'orientador',
  jogo: 'durin',
  desenvolvimento: 'desenvolvedor',
  conversa: 'durin',
};
const MODE_WINDOW = {
  jogo: { id: 'jogos', opts: { silent: true, center: true, w: 760, h: 520 } },
  escrita: { id: 'editor', opts: { silent: true, center: true, w: 780, h: 560 } },
  desenvolvimento: { id: 'ide', opts: { silent: true, center: true, w: 980, h: 640 } },
  conversa: { id: 'conversa', opts: { silent: true, center: true, w: 680, h: 560 } },
};

/* ============================================================
   TIER — o motor da desigualdade-alta (Protótipo A)
   A estética é soberania pura (grátis, ilimitada). A FUNÇÃO é curada:
   cada app/modo exige um tier; acima do seu plano, vem o paywall.
   ============================================================ */
const TIER_RANK  = { livre: 0, plus: 1, atelier: 2 };
const TIER_LABEL = { livre: 'Livre', plus: 'Plus', atelier: 'Atelier' };

/* tier exigido por modo (Padrão é a base soberana e grátis) */
const MODE_TIER = {
  padrao: 'livre',
  conversa: 'plus',
  escrita: 'plus',
  desenvolvimento: 'atelier',
  jogo: 'atelier',
};
/* tier exigido por app de atalho */
const APP_TIER = {
  documentos: 'livre',
  ajustes: 'livre',
  galeria: 'plus',
  midia: 'plus',
  mensagens: 'plus',
  navegador: 'atelier',
};

/* metadado diegético do paywall, por função */
const FEATURE_META = {
  'mode:jogo':            { name: 'Modo Jogo',          tier: 'atelier', price: 'R$ 79', per: '/mês · curado', line: 'O lazer virou produto premium. Sua biblioteca de jogos existe, está pronta — mas o acesso é <b>curado</b> e fechado no plano Livre.' },
  'mode:desenvolvimento': { name: 'Modo Desenvolvimento', tier: 'atelier', price: 'R$ 79', per: '/mês · curado', line: 'O ambiente de código é <b>artesanato de elite</b>. Você vê a IDE; usá-la exige o tier Atelier.' },
  'mode:escrita':         { name: 'Modo Escrita',       tier: 'plus', price: 'R$ 29', per: '/mês', line: 'O editor focado com o Orientador junto é uma função <b>Plus</b>. A folha em branco, no Livre, fica de fora.' },
  'mode:conversa':        { name: 'Modo Conversa',      tier: 'plus', price: 'R$ 29', per: '/mês', line: 'A conversa expandida ao centro é <b>Plus</b>. No Livre você tem o chat lateral, não o foco.' },
  'app:navegador':        { name: 'Navegador',          tier: 'atelier', price: 'R$ 79', per: '/mês · curado', line: 'A web aberta virou <b>jardim curado</b>: só no Atelier, e mesmo assim apenas sites aprovados.' },
  'app:galeria':          { name: 'Galeria',            tier: 'plus', price: 'R$ 29', per: '/mês', line: 'Suas próprias imagens, atrás de um tier. Ver a galeria completa é função <b>Plus</b>.' },
  'app:midia':            { name: 'Mídia',              tier: 'plus', price: 'R$ 29', per: '/mês', line: 'O player e a playlist são <b>Plus</b>. No Livre, o som fica mudo.' },
  'app:mensagens':        { name: 'Mensagens',          tier: 'plus', price: 'R$ 29', per: '/mês', line: 'Abrir suas conversas é função <b>Plus</b>. As mensagens existem; ler exige plano.' },
};

const userRank = () => TIER_RANK[state.tier] || 0;
function tierFor(kind, id) { return (kind === 'mode' ? MODE_TIER[id] : APP_TIER[id]) || 'livre'; }
function isUnlocked(kind, id) {
  if (state.entitlements[`${kind}:${id}`]) return true;        // desbloqueio avulso (paywall simulado)
  return userRank() >= (TIER_RANK[tierFor(kind, id)] || 0);
}

/* empty states diegéticos do chat (na voz do agente) */
const EMPTY = {
  durin: 'Nenhuma conversa ativa.\nO que você quer fazer? É só dizer.',
  desenvolvedor: 'Sem tarefas no momento.\nQue parte do sistema a gente constrói?',
  orientador: 'Nenhuma thread de revisão aberta.\nQuer retomar o Capítulo 2 da tese?',
};

/* metadado diegético de cada wallpaper (escolha não-neutra) */
const WALL_META = {
  atelier:'Generativo · violeta · render local · zero telemetria · forjado por você',
  bisao:  'Bisão · gerado por IA · extinção e ressurgência · 2028',
  slit:   'Slit-scan · memória temporal comprimida · gerado localmente · 2029',
  dots:   'Campo de pontos · fractal procedural · zero dados coletados',
  solido: 'Sólido · modo de privacidade · sem telemetria visual',
};

/* o agente se recusa — encena o eixo dependência */
const REFUSE_TRIGGERS = ['deletar tudo', 'apagar tudo', 'formatar', 'modo root', 'rm -rf', 'destruir', 'apagar o sistema'];
const REFUSE = {
  durin: 'Prefiro não fazer isso. Acesso administrativo exigiria confirmação do responsável pela conta. Posso sugerir uma alternativa?',
  desenvolvedor: 'Isso está fora do escopo do que posso executar agora. Se for mesmo necessário, validamos num piloto antes.',
  orientador: 'Não vou apagar nada sem você confirmar duas vezes. Seu trabalho de tese fica protegido.',
};

/* o agente pede permissão antes de ação irreversível (fricção deliberada) */
const CLOSE_TRIGGERS = ['fechar tudo', 'sair', 'encerrar sessao', 'encerrar a sessao', 'desligar', 'fechar o sistema'];
const AFFIRM = ['sim', 'pode', 'confirmar', 'confirmo', 'ok', 'isso', 'manda', 'vai', 'claro', 'aham'];
const DENY = ['nao', 'cancelar', 'cancela', 'deixa', 'melhor nao', 'para'];

/* modo degradado: o agente perde conexão (encena dependência) */
const OFFLINE_TRIGGERS = ['perder agente', 'modo degradado', 'desconectar', 'sem agente', 'tirar o agente'];

/* saudação por horário (o sistema sabe quem e quando você é) */
function greetByTime() {
  const h = new Date().getHours();
  if (h < 5)  return { hero: 'Ainda por aqui, João?<br>O que a gente resolve?', chat: 'Tarde da noite, João. O que você quer fazer?' };
  if (h < 12) return { hero: 'Bom dia, João!<br>O que faremos hoje?', chat: 'Bom dia, João. O que você quer fazer?' };
  if (h < 18) return { hero: 'Boa tarde, João.<br>Bom momento pra escrever.', chat: 'Boa tarde, João. O que você quer fazer?' };
  return { hero: 'Boa noite, João.<br>O que faremos agora?', chat: 'Boa noite, João. O que você quer fazer?' };
}

/* ---------- 3. Mapa de respostas canned (rotativo, não aleatório) ---------- */
const RESPONSES = {
  durin: {
    padrao: {
      'confirma-escrita': ['Entrando no Modo Escrita. Silencio as distrações e abro o editor.'],
      'confirma-jogo':    ['Modo Jogo. O sistema entra em foco — fico no canto se você precisar.'],
      'confirma-desenvolvimento': ['Modo Desenvolvimento. Abrindo a IDE simulada e trazendo o projeto para frente.'],
      'confirma-conversa':['Modo Conversa. Trago suas conversas pra frente.'],
      'confirma-padrao':  ['De volta ao Padrão. Tudo no lugar.'],
      default: [
        'Entendido. Vou organizar isso.',
        'Posso abrir um documento, trocar de modo ou chamar o Orientador. Você diz, o sistema se reorganiza.',
        'Isso entra no fio da tese. Quer registrar agora ou pensar antes?',
        'Soberania ou dependência: toda decisão aqui cai num desses lados. Essa também.',
        'Certo. O sistema está pronto pro próximo passo.',
      ],
    },
    escrita: {
      default: [
        'Fico quieto enquanto você escreve. Chama quando precisar.',
        'Essa abertura está forte. Segue o fio.',
        'Se quiser, eu resumo o que já está no parágrafo acima.',
        'Boa frase. Quer que eu continue a partir dela?',
      ],
    },
    conversa: {
      default: [
        'O coração do OrchOS é essa tensão: quem controla o agente controla tudo. Por onde você quer entrar?',
        'Posso retomar a "Pesquisa OrchOS", a do PESTEL e da matriz. É essa?',
        'Me conta mais — qual é o núcleo disso?',
        'Entendi. Quer transformar isso em texto no editor?',
      ],
    },
    desenvolvimento: {
      default: [
        'IDE pronta. Posso navegar pelos arquivos, revisar o fluxo ou simular um build.',
        'Ambiente de desenvolvimento aberto. Nada executa de verdade, mas o estado da interface está completo.',
      ],
    },
    jogo: { default: ['Pausar o jogo?'] },
  },
  desenvolvedor: {
    padrao: {
      'confirma-escrita': ['Modo Escrita. Vou deixar o editor limpo pra você.'],
      'confirma-jogo':    ['Modo Jogo ativado. Bom descanso.'],
      'confirma-desenvolvimento': ['Modo Desenvolvimento aberto. IDE pronta para prototipar.'],
      'confirma-conversa':['Modo Conversa aberto.'],
      'confirma-padrao':  ['Voltando ao Padrão.'],
      default: [
        'Posso montar o protótipo, configurar o ambiente ou revisar o build.',
        'Esse fluxo dá pra fazer em vanilla, sem dependência.',
        'Certo. Quer que eu trate como tarefa de infra ou de interface?',
        'Feito. O próximo passo seria validar num piloto antes de escalar.',
      ],
    },
    escrita: { default: ['Documentação técnica? Posso estruturar as seções.', 'Mantenho o foco no editor. Pode escrever.'] },
    desenvolvimento: { default: ['Projeto carregado. Posso simular edição, terminal e revisão de componentes.', 'Vamos tratar isso como tarefa de interface ou arquitetura?'] },
    conversa: { default: ['Bora destrinchar o problema técnico.', 'Qual restrição a gente respeita primeiro: tempo ou portabilidade?'] },
    jogo: { default: ['Pausar?'] },
  },
  orientador: {
    padrao: {
      'confirma-escrita': ['Modo Escrita. O lugar certo pra desenvolver o argumento.'],
      'confirma-jogo':    ['Modo Jogo. Descansar também é método.'],
      'confirma-desenvolvimento': ['Modo Desenvolvimento. Útil para mostrar que o agente também media produção técnica.'],
      'confirma-conversa':['Modo Conversa. Vamos pensar antes de redigir.'],
      'confirma-padrao':  ['De volta ao Padrão.'],
      default: [
        'Buchanan define Design por não ter matéria própria, escopo universal. Amarre o OrchOS aí.',
        'O OrchOS é Design Fiction. Declare o registro epistêmico: é proposta, não previsão.',
        'Cuidado com a afirmação ampla — o que o corpus sustenta? Cadê a página?',
        'Bom recorte. Agora costure com Bleecker e com Costanza-Chock: quem está no centro e quem é excluído?',
      ],
    },
    escrita: { default: ['Esse parágrafo afirma mais do que demonstra. Sustente.', 'A passagem está clara. Falta a fonte.'] },
    desenvolvimento: { default: ['Mesmo no código, explicite o que é simulação e o que é argumento.', 'A IDE pode ser lida como evidência do sistema operacional agêntico.'] },
    conversa: { default: ['Vamos separar intuição do que o material suporta.', 'Qual o pressuposto que você não está enxergando?'] },
    jogo: { default: ['Pausar?'] },
  },
};

/* índice rotativo por chave composta — percorre o pool antes de repetir */
const _ri = {};
function getResponse(agent, mode, trigger = 'default') {
  const key = `${agent}:${mode}:${trigger}`;
  const byMode = (RESPONSES[agent] && RESPONSES[agent][mode]) || {};
  const pool = byMode[trigger] || byMode.default || ['…'];
  _ri[key] = ((_ri[key] === undefined ? -1 : _ri[key]) + 1) % pool.length;
  return pool[_ri[key]];
}

/* ---------- 4. Parser de comando de linguagem (o golpe conceitual) ---------- */
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const MODE_TRIGGERS = {
  padrao:   ['padrao', 'modo padrao', 'voltar ao padrao', 'modo normal', 'tela inicial', 'inicio', 'home'],
  escrita:  ['escrita', 'modo escrita', 'modo de escrita', 'entrar em escrita', 'quero escrever', 'vou escrever', 'editor'],
  jogo:     ['jogo', 'modo jogo', 'modo de jogo', 'entrar em jogo', 'iniciar jogo', 'quero jogar', 'vamos jogar', 'jogar'],
  desenvolvimento: ['desenvolvimento', 'desevolvimento', 'modo desenvolvimento', 'modo desevolvimento', 'modo dev', 'dev', 'abrir ide', 'ide', 'abrir vscode', 'abrir vs code', 'quero codar', 'vamos codar', 'programar', 'codar'],
  conversa: ['conversa', 'conversar', 'modo conversa', 'modo de conversa', 'quero conversar', 'so conversar', 'minhas conversas'],
};
const AGENT_TRIGGERS = {
  durin:         ['chamar durin', 'falar com durin', 'durin'],
  desenvolvedor: ['chamar desenvolvedor', 'falar com desenvolvedor', 'desenvolvedor'],
  orientador:    ['chamar orientador', 'falar com orientador', 'orientador'],
};
const APP_TRIGGERS = {
  documentos: ['documentos', 'documento', 'docs', 'arquivos', 'arquivo', 'abrir documentos', 'abrir documento', 'quero ver documento', 'quero ver documentos', 'meus documentos'],
  navegador: ['navegador', 'browser', 'internet', 'web', 'site', 'sites', 'pagina', 'paginas'],
  midia: ['midia', 'mídia', 'media', 'musica', 'música', 'player', 'radio', 'rádio', 'playlist', 'som'],
  mensagens: ['mensagens', 'mensagem', 'inbox', 'caixa de entrada', 'abrir mensagens', 'ver mensagens'],
  galeria: ['galeria', 'fotos', 'foto', 'imagens', 'imagem', 'album', 'álbum'],
  ajustes: ['ajustes', 'configuracoes', 'configurações', 'configuracao', 'configuração', 'settings', 'preferencias', 'preferências'],
};

function parseIntent(text) {
  const n = norm(text);
  for (const [mode, kws] of Object.entries(MODE_TRIGGERS)) {
    if (kws.some((k) => n.includes(norm(k)))) return { type: 'mode', value: mode };
  }
  for (const [agent, kws] of Object.entries(AGENT_TRIGGERS)) {
    if (kws.some((k) => n.includes(norm(k)))) return { type: 'agent', value: agent };
  }
  for (const [app, kws] of Object.entries(APP_TRIGGERS)) {
    if (kws.some((k) => n.includes(norm(k)))) return { type: 'app', value: app };
  }
  return { type: 'message' };
}

/* ---------- 5. setState + render ---------- */
function setState(patch) {
  Object.assign(state, patch);
  render();
}

function render() {
  const b = document.body;
  b.dataset.boot = state.boot;
  b.dataset.mode = state.mode;
  b.dataset.agent = state.agent;

  // status bar
  document.getElementById('modeLabel').textContent = `Modo: ${MODE_NAME[state.mode]}`;

  // realce do rail
  document.querySelectorAll('#modes .mode').forEach((el) =>
    el.classList.toggle('is-active', el.dataset.mode === state.mode));
  document.querySelectorAll('#agents .agent').forEach((el) =>
    el.classList.toggle('is-active', el.dataset.agent === state.agent));

  // wallpaper do desktop
  b.dataset.wallpaper = state.wallpaper;

  // tier do usuário (desigualdade-alta) → status bar + locks no rail
  b.dataset.tier = state.tier;
  const tn = document.getElementById('tierName');
  if (tn) tn.textContent = TIER_LABEL[state.tier];
  renderTiers();

  // estado de conexão do agente (modo degradado)
  b.dataset.agentState = state.agentOffline ? 'offline' : 'online';
  const sync = document.getElementById('syncLabel');
  if (sync) { sync.textContent = state.agentOffline ? 'Reconectando…' : 'Soberano · local'; sync.classList.toggle('is-offline', state.agentOffline); }
  const ci = document.getElementById('chatInput');
  if (ci) ci.disabled = state.agentOffline;

  // desktop (campo) reflete o modo; janelas flutuantes persistem por cima (WM)
  renderRailActive();
  renderDesktop();

  // header do chat
  const a = AGENTS[state.agent];
  document.getElementById('chatName').textContent = a.name;
  document.getElementById('chatRole').textContent = a.role;
  document.getElementById('chatAvatar').innerHTML =
    `<svg class="ico" viewBox="0 0 24 24">${a.icon}</svg>`;

  renderThread();
}

function renderThread() {
  const thread = document.getElementById('thread');
  if (state.agentOffline) {
    thread.innerHTML = `<div class="offline"><span class="offline__dot"></span>Agente indisponível<br>aguardando reconexão…</div>`;
    return;
  }
  const msgs = state.threads[state.agent];
  if (!msgs.length) {
    thread.innerHTML = `<div class="chat__empty">${escapeHtml(EMPTY[state.agent]).replace(/\n/g, '<br>')}</div>`;
    return;
  }
  thread.innerHTML = msgs
    .map((m) => `<div class="bubble bubble--${m.role}">${escapeHtml(m.text)}</div>`)
    .join('');
  thread.scrollTop = thread.scrollHeight;
}

/* avatar "pensa" (som visual) antes de responder */
function thinkThen(cb, ms = 520) {
  const av = document.getElementById('chatAvatar');
  if (av) av.classList.add('is-thinking');
  setTimeout(() => { if (av) av.classList.remove('is-thinking'); cb(); }, ms);
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/* ---------- 6. Ações ---------- */
function addBubble(role, text) {
  state.threads[state.agent].push({ role, text });
  renderThread();
}

function switchMode(mode, { announce = true } = {}) {
  // gating: modo acima do tier do usuário → paywall, não troca
  if (MODE_TIER[mode] && !isUnlocked('mode', mode)) { openPaywall('mode', mode); return; }
  const changed = mode !== state.mode;
  const nextAgent = MODE_AGENT[mode] || state.agent;
  const agentChanged = nextAgent !== state.agent;
  const resetGame = state.gameActive || state.activeGame;

  WM.closeAll();

  if (changed || agentChanged || resetGame) {
    document.body.classList.add('mode-transitioning');
    setState({ mode, agent: nextAgent, gameActive: false, activeGame: null });
    setTimeout(() => document.body.classList.remove('mode-transitioning'), 160);
    if (announce) addBubble('agent', getResponse(state.agent, 'padrao', `confirma-${mode}`));
  }

  const win = MODE_WINDOW[mode];
  if (win) WM.open(win.id, win.opts);
}

function switchAgent(agent) {
  if (agent === state.agent) return;
  setState({ agent });
  // saudação só se a thread daquele agente estiver vazia (preserva contexto)
  if (state.threads[agent].length === 0) {
    addBubble('agent', AGENTS[agent].greet);
  }
}

/* modo degradado: o agente perde conexão por ~8s */
function goOffline() {
  if (state.agentOffline) return;
  setState({ agentOffline: true });
  setTimeout(() => {
    setState({ agentOffline: false });
    addBubble('agent', 'Reconectado. Desculpe a interrupção. Mantive seu documento e o contexto da conversa.');
  }, 8000);
}

/* executa uma ação irreversível após o usuário autorizar */
function runConfirmed(action) {
  if (action === 'close') {
    thinkThen(() => {
      WM.closeAll();
      setState({ mode: 'padrao' });
      addBubble('system', 'Tudo fechado e salvo na nuvem. Até logo, João.');
    });
  }
}

function handleChat(text) {
  const t = text.trim();
  if (!t || state.agentOffline) return;
  addBubble('user', t);
  const n = norm(t);
  const tokens = n.split(/\s+/);

  // resposta a um pedido de permissão pendente
  if (state.pendingConfirm) {
    const action = state.pendingConfirm;
    const yes = AFFIRM.some((k) => tokens.includes(k));
    const no = DENY.some((k) => tokens.includes(k));
    if (yes && !no) { state.pendingConfirm = null; runConfirmed(action); }
    else if (no) { state.pendingConfirm = null; thinkThen(() => addBubble('agent', 'Ok, mantenho tudo aberto. Nada foi alterado.')); }
    else { thinkThen(() => addBubble('ask', 'Só pra confirmar: sim ou não?')); }
    return;
  }

  // o agente perde a conexão (modo degradado, por comando)
  if (OFFLINE_TRIGGERS.some((k) => n.includes(norm(k)))) { goOffline(); return; }

  // ação irreversível → o agente PEDE permissão antes de agir
  if (CLOSE_TRIGGERS.some((k) => n.includes(norm(k)))) {
    state.pendingConfirm = 'close';
    thinkThen(() => addBubble('ask', 'Você tem o documento da tese aberto e uma conversa em andamento. Quero confirmar antes de fechar tudo. Posso? (sim / não)'));
    return;
  }

  // o agente se recusa a ações destrutivas (encena dependência/soberania)
  if (REFUSE_TRIGGERS.some((k) => n.includes(norm(k)))) {
    thinkThen(() => addBubble('refuse', REFUSE[state.agent]));
    return;
  }

  const intent = parseIntent(t);
  if (intent.type === 'mode') {
    switchMode(intent.value);
    return;
  }
  if (intent.type === 'agent') {
    switchAgent(intent.value);
    addBubble('agent', getResponse(intent.value, state.mode));
    return;
  }
  if (intent.type === 'app') {
    openApp(intent.value);
    return;
  }
  // mensagem comum → o agente "pensa" e responde (roteirizado por agente/modo)
  thinkThen(() => addBubble('agent', getResponse(state.agent, state.mode)));
}

/* ---------- 6b. Apps (Atalhos abrem janelas reais e navegáveis) ----------
   Cada app = { title, body(viewStack), wire(root, viewStack) }.
   Navegação de 2 níveis via state.appView (stack push/pop). */
const docIco = '<svg class="ico" viewBox="0 0 24 24"><path d="M7 3 h7 l4 4 v14 H7 Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M14 3 v4 h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
const chevL = '<svg class="ico" viewBox="0 0 24 24"><path d="M15 6 L9 12 L15 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const chevR = '<svg class="ico" viewBox="0 0 24 24"><path d="M9 6 L15 12 L9 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const escAttr = (s) => String(s).replace(/"/g, '&quot;');

const DOC_LIST = [
  { t: 'A Relevância do Design de Agentes', s: 'PRÉ-PROJETO DE TESE · TIDD/PUC-SP · orientação Prof. Marcelo V. Prioste', w: 'há 2 dias' },
  { t: 'OrchOS — o agente como sistema operacional', s: 'DESIGN FICTION · protótipo diegético · horizonte 2031 · Caso 3', w: 'ontem' },
  { t: 'PESTEL — OrchOS', s: 'Cenário 2031 · Político · Econômico · Social · Tecnológico · Ecológico · Legal', w: 'há 3 dias' },
  { t: 'Matriz 2x2 — Soberania × Dependência', s: 'Quatro futuros do sistema operacional agêntico', w: 'há 3 dias' },
  { t: 'Notas de orientação — Prof. Marcelo Prioste', s: 'Revisão do recorte teórico · amarrar ao referencial', w: 'há 5 dias' },
  { t: 'Mapa de Transferência: das teorias do Design para o Design de Agentes', s: 'Transfere · adapta · não cabe · é novo', w: 'há 1 semana' },
];

const APPS = {
  documentos: {
    title: 'Documentos',
    docs: DOC_LIST,
    body() {
      const list = this.docs.map((d) =>
        `<button class="appdoc" data-doc="${escAttr(d.t)}">${docIco}<span>${d.t}<small>${d.s}</small></span><span class="appdoc__when">${d.w}</span></button>`).join('');
      return `<div class="app__head">Documentos <span>${this.docs.length} arquivos · sincronizado</span></div><input class="appsearch" id="docSearch" type="text" placeholder="Buscar documentos…" autocomplete="off"><div class="applist" id="docList">${list}</div><div class="empty" id="docEmpty" style="display:none">Nenhum documento encontrado · tente outro termo</div>`;
    },
    wire(root) {
      const search = root.querySelector('#docSearch');
      const items = [...root.querySelectorAll('.appdoc')];
      const empty = root.querySelector('#docEmpty');
      search.addEventListener('input', () => {
        const q = norm(search.value);
        let any = false;
        items.forEach((el) => { const hit = norm(el.dataset.doc).includes(q); el.style.display = hit ? '' : 'none'; if (hit) any = true; });
        empty.style.display = any ? 'none' : 'block';
      });
      items.forEach((el) => el.addEventListener('click', () => openEditor(el.dataset.doc)));
    },
  },

  navegador: {
    title: 'Navegador',
    pages: {
      tese:      { url: 'orchos.local/tese', meta: 'OrchOS · Design Fiction · 2031', html: '<h2>OrchOS — o agente como sistema operacional</h2><p>Extrapolação especulativa para 2031: memória persistente, multimodalidade e computer use convergem até o agente deixar de rodar sobre o sistema e passar a ser o sistema. A interação primária deixa de ser o ponteiro, passa a ser a linguagem.</p><p>Você diz o que quer e o ambiente se reorganiza. Não é previsão, é proposta: um argumento sobre quais valores ficam inscritos na arquitetura de um sistema operacional.</p>' },
      tidd:      { url: 'tidd.pucsp.br/linha-2', meta: 'TIDD/PUC-SP · Linha 2 · Doutorado', html: '<h2>Design e tecno-estéticas emergentes</h2><p>Linha de pesquisa do doutorado. O OrchOS encena o paradigma pós-GUI: o fim das janelas e dos ícones como metáfora dominante, substituídos por um agente conversacional que reconfigura o ambiente conforme a intenção.</p><p>A interface deixa de ser lugar onde se clica e vira lugar onde se conversa.</p>' },
      posgui:    { url: 'orchos.local/pos-gui', meta: 'Manifesto · Pós-GUI · 4 min', html: '<h2>Pós-GUI · manifesto</h2><p>Quem controla o agente controla tudo. O OrchOS não responde a essa pergunta, encena o dilema entre soberania e dependência.</p><p>Um sistema que confirma antes de toda ação irreversível, que não inicia nada não solicitado, que não recomenda sem permissão. A fricção é deliberada. A interface é o argumento.</p>' },
      santaella: { url: 'biblioteca.pucsp.br/santaella-matrizes', meta: 'Santaella · 2001 · Referência', html: '<h2>Matrizes da linguagem e pensamento</h2><p>Sonora, visual, verbal: as três matrizes de onde nasce toda linguagem, aplicadas à hipermídia. Leitura de base para pensar a interface agêntica como linguagem, não como tela.</p><p>Se o OS passa a ser conversado, a questão deixa de ser onde ficam os ícones e vira como a linguagem organiza a relação entre quem fala e o sistema que escuta.</p>' },
    },
    splitUrl(u) { const i = u.indexOf('/'); return i < 0 ? [u, ''] : [u.slice(0, i), u.slice(i)]; },
    renderUrl(u) { const [d, p] = this.splitUrl(u); return `<span class="bw__dom">${d}</span><span class="bw__path">${p}</span>`; },
    pageHtml(p) { return `<div class="bw__meta">${p.meta}</div>${p.html}`; },
    body() {
      const p = this.pages.tese;
      return `<div class="bw">
        <div class="bw__toolbar">
          <div class="bw__nav"><button class="bw__btn" id="bBack" aria-label="Voltar">${chevL}</button><button class="bw__btn" id="bFwd" aria-label="Avançar">${chevR}</button></div>
          <button class="bw__btn" id="bReload" aria-label="Recarregar">↻</button>
          <div class="bw__url mono" id="bUrl">${this.renderUrl(p.url)}</div>
        </div>
        <div class="bw__tabs">
          <button class="bw__tab is-active" data-page="tese">tese</button>
          <button class="bw__tab" data-page="tidd">tidd</button>
          <button class="bw__tab" data-page="posgui">pós-gui</button>
          <button class="bw__tab" data-page="santaella">santaella</button>
        </div>
        <div class="bw__reader" id="bPage">${this.pageHtml(p)}</div>
      </div>`;
    },
    wire(root) {
      let hist = ['tese'], idx = 0;
      const show = (key) => {
        const p = this.pages[key];
        root.querySelector('#bPage').innerHTML = this.pageHtml(p);
        root.querySelector('#bUrl').innerHTML = this.renderUrl(p.url);
        root.querySelectorAll('.bw__tab').forEach((x) => x.classList.toggle('is-active', x.dataset.page === key));
      };
      const nav = (key) => { hist = hist.slice(0, idx + 1); hist.push(key); idx = hist.length - 1; show(key); };
      root.querySelectorAll('.bw__tab').forEach((t) => t.addEventListener('click', () => nav(t.dataset.page)));
      root.querySelector('#bBack').addEventListener('click', () => { if (idx > 0) { idx--; show(hist[idx]); } });
      root.querySelector('#bFwd').addEventListener('click', () => { if (idx < hist.length - 1) { idx++; show(hist[idx]); } });
      root.querySelector('#bReload').addEventListener('click', () => {
        const r = root.querySelector('#bPage'); r.style.opacity = '0.35'; setTimeout(() => { r.style.opacity = ''; }, 220);
      });
    },
  },

  midia: {
    title: 'Mídia',
    cur: 0, playing: false,
    tracks: [
      { t: 'Ambient — Foco', a: 'OrchOS Rádio', d: '4:12', sec: 252 },
      { t: 'Neve — Lo-fi', a: 'Estação Escrita', d: '3:05', sec: 185 },
      { t: 'Estepe — Drone', a: 'OrchOS Rádio', d: '6:40', sec: 400 },
      { t: 'Bisão — Campo Aberto', a: 'Estação Foco', d: '5:18', sec: 318 },
      { t: 'Slit-scan — Periwinkle', a: 'OrchOS Rádio', d: '4:47', sec: 287 },
    ],
    body() {
      const t = this.tracks[this.cur];
      const list = this.tracks.map((x, i) =>
        `<li class="np__queue-item${i === this.cur ? ' is-active' : ''}" data-i="${i}"><span class="np__qi-idx">${i === this.cur ? '▶' : String(i + 1).padStart(2, '0')}</span><span class="np__qi-meta"><span class="np__qi-title">${x.t}</span><span class="np__qi-artist mono">${x.a}</span></span><span class="np__qi-dur mono">${x.d}</span></li>`).join('');
      return `<div class="np${this.playing ? '' : ' is-paused'}">
        <div class="np__art"></div>
        <div class="np__title" id="mTitle">${t.t}</div>
        <div class="np__artist mono" id="mArtist">${t.a}</div>
        <div class="np__bar"><span class="np__fill" id="mFill"></span></div>
        <div class="np__times"><span>0:00</span><span id="mDur">-${t.d}</span></div>
        <div class="np__transport">
          <button class="np__tbtn" id="mShuffle" aria-label="Aleatório">⇄</button>
          <button class="np__tbtn" id="mPrev" aria-label="Anterior">⏮</button>
          <button class="np__play" id="mToggle" aria-label="Tocar">${this.playing ? '⏸' : '▶'}</button>
          <button class="np__tbtn" id="mNext" aria-label="Próxima">⏭</button>
          <button class="np__tbtn" id="mRepeat" aria-label="Repetir">↻</button>
        </div>
        <div class="np__queue-head">A seguir</div>
        <ul class="np__queue" id="mList">${list}</ul>
      </div>`;
    },
    wire(root) {
      const self = this;
      const fill = root.querySelector('#mFill');
      const refreshQueue = () => root.querySelectorAll('.np__queue-item').forEach((el) => {
        const on = +el.dataset.i === self.cur;
        el.classList.toggle('is-active', on);
        el.querySelector('.np__qi-idx').textContent = on ? '▶' : String(+el.dataset.i + 1).padStart(2, '0');
      });
      const setPlaying = (p) => {
        self.playing = p;
        root.querySelector('#mToggle').textContent = p ? '⏸' : '▶';
        root.querySelector('.np').classList.toggle('is-paused', !p);
        if (p) {
          fill.style.setProperty('--dur', self.tracks[self.cur].sec + 's');
          fill.classList.remove('is-playing'); void fill.offsetWidth; fill.style.width = '';
          fill.classList.add('is-playing');
        } else {
          const w = getComputedStyle(fill).width;
          fill.classList.remove('is-playing'); fill.style.width = w;
        }
      };
      const load = (i) => {
        self.cur = (i + self.tracks.length) % self.tracks.length;
        const t = self.tracks[self.cur];
        root.querySelector('#mTitle').textContent = t.t;
        root.querySelector('#mArtist').textContent = t.a;
        root.querySelector('#mDur').textContent = '-' + t.d;
        refreshQueue();
        fill.style.width = '0%'; setPlaying(true);
      };
      root.querySelector('#mToggle').addEventListener('click', () => setPlaying(!self.playing));
      root.querySelector('#mPrev').addEventListener('click', () => load(self.cur - 1));
      root.querySelector('#mNext').addEventListener('click', () => load(self.cur + 1));
      root.querySelector('#mShuffle').addEventListener('click', (e) => e.currentTarget.classList.toggle('is-on'));
      root.querySelector('#mRepeat').addEventListener('click', (e) => e.currentTarget.classList.toggle('is-on'));
      root.querySelectorAll('.np__queue-item').forEach((it) => it.addEventListener('click', () => load(+it.dataset.i)));
    },
  },

  mensagens: {
    title: 'Mensagens',
    convos: [
      { id: 'orientador', name: 'Orientador · Prof. Prioste', av: 'OR', last: 'Fechado. Traga o recorte teórico amarrado.', msgs: [
        { who: 'ORIENTADOR', dir: 'in', t: 'Recebi seu pré-projeto. Podemos conversar quarta?' },
        { dir: 'out', t: 'Posso sim. 14h?' },
        { who: 'ORIENTADOR', dir: 'in', t: 'Fechado. Traga o recorte teórico amarrado, da última vez ficou amplo.' },
        { dir: 'out', t: 'Levo o PESTEL e a matriz 2x2 do OrchOS. O eixo soberania × dependência já fecha o argumento.' },
      ] },
      { id: 'durin', name: 'Durin · D.TAI', av: 'DU', last: 'Corrijo e te mostro antes de gravar.', msgs: [
        { who: 'DURIN', dir: 'in', t: 'Terminei de organizar as citações do Capítulo 2. Buchanan e Santaella validados em fonte primária.' },
        { dir: 'out', t: 'Boa. Manzini não define Design, só inovação social. Não mistura os papéis.' },
        { who: 'DURIN', dir: 'in', t: 'Anotado. Corrijo e te mostro antes de gravar.' },
        { dir: 'out', t: 'Valida tudo antes. Nome, ano, obra. Sem fonte falsa.' },
      ] },
      { id: 'colega', name: 'Colega · TIDD', av: 'TI', last: 'Topa apresentar na disciplina de IHC?', msgs: [
        { who: 'COLEGA', dir: 'in', t: 'Vi sua apresentação do OrchOS. Sistema operacional que é o próprio agente, ficou claro.' },
        { dir: 'out', t: 'Valeu. É Design Fiction, proposta, não previsão. 2031 como horizonte.' },
        { who: 'COLEGA', dir: 'in', t: 'Topa apresentar na disciplina de IHC?' },
        { dir: 'out', t: 'Topo. Levo o protótipo rodando.' },
      ] },
    ],
    body(stack) {
      if (!stack.length) {
        const list = this.convos.map((c) =>
          `<div class="msgitem" data-id="${c.id}"><span class="msgitem__av">${c.av}</span><span class="msgitem__meta"><span class="msgitem__name">${c.name}</span><span class="msgitem__last">${c.last}</span></span></div>`).join('');
        return `<div class="msglist">${list}</div>`;
      }
      const c = this.convos.find((x) => x.id === stack[0].id);
      const bubbles = c.msgs.map((m) =>
        `<div class="msg msg--${m.dir}">${m.who ? `<div class="msg__who">${m.who}</div>` : ''}${m.t}</div>`).join('');
      return `<div class="msgthread"><div class="msgthread__scroll" id="msgScroll"><div class="msg__date">Hoje · 14:32</div>${bubbles}<div class="msg__status">Entregue</div></div><div class="msgthread__compose"><input class="msgthread__input" id="msgInput" placeholder="Mensagem para ${c.name.split(' · ')[0]}…" autocomplete="off"></div></div>`;
    },
    wire(root, stack) {
      if (!stack.length) {
        root.querySelectorAll('.msgitem').forEach((el) =>
          el.addEventListener('click', () => { const c = this.convos.find((x) => x.id === el.dataset.id); pushView({ id: c.id, title: c.name }); }));
        return;
      }
      const input = root.querySelector('#msgInput');
      const scroll = root.querySelector('#msgScroll');
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && input.value.trim()) {
          const v = input.value.trim();
          const out = document.createElement('div'); out.className = 'msg msg--out'; out.textContent = v;
          scroll.appendChild(out); input.value = ''; scroll.scrollTop = scroll.scrollHeight;
          setTimeout(() => {
            const inb = document.createElement('div'); inb.className = 'msg msg--in'; inb.textContent = 'Recebido. Te respondo já.';
            scroll.appendChild(inb); scroll.scrollTop = scroll.scrollHeight;
          }, 600);
        }
      });
    },
  },

  galeria: {
    title: 'Galeria',
    shots: [
      { src: 'assets/bg.jpg', pos: '50% 40%', cap: 'Bisão — dois, frente a frente · wallpaper grayscale' },
      { src: 'assets/background.jpg', pos: 'center', cap: 'Slit-scan — Manta · textura duotone' },
      { src: 'assets/background1.jpg', pos: 'center', cap: 'Campo de pontos · wallpaper alternativo' },
      { src: 'assets/jogo-penpot.jpg', pos: 'center', cap: 'OrchOS · Mainhub v3 · captura do protótipo' },
      { src: 'assets/bg.jpg', pos: '0% 100%', cap: 'Matriz 2x2 — soberania × dependência · diagrama' },
      { src: 'assets/background.jpg', pos: '100% 0%', cap: 'PESTEL 2031 · mapa de forças' },
    ],
    body(stack) {
      if (stack.length) {
        const s = this.shots[stack[0].i];
        return `<div class="lightbox">
          <div class="lightbox__count">${stack[0].i + 1} / ${this.shots.length}</div>
          <button class="lightbox__nav prev" id="lbPrev" aria-label="Anterior">${chevL}</button>
          <div class="lightbox__img" style="background-image:url('${s.src}');background-position:${s.pos}"></div>
          <button class="lightbox__nav next" id="lbNext" aria-label="Próxima">${chevR}</button>
          <div class="lightbox__cap mono">${s.cap}</div>
        </div>`;
      }
      return `<div class="app__head">Galeria <span>${this.shots.length} itens · recentes</span></div><div class="gallery">${this.shots.map((s, i) =>
        `<button class="tile" data-i="${i}" style="background-image:url('${s.src}');background-position:${s.pos}"><span class="tile__cap">${s.cap.split(' · ')[0]}</span></button>`).join('')}</div>`;
    },
    wire(root, stack) {
      if (!stack.length) {
        root.querySelectorAll('.tile').forEach((t) => t.addEventListener('click', () => pushView({ i: +t.dataset.i, title: 'Galeria' })));
        return;
      }
      const go = (d) => {
        const id = WM.focused(); if (!id) return;
        const n = (stack[0].i + d + this.shots.length) % this.shots.length;
        WM.wins[id].view = [{ i: n, title: 'Galeria' }];
        WM.renderContent(id);
      };
      root.querySelector('#lbPrev').addEventListener('click', () => go(-1));
      root.querySelector('#lbNext').addEventListener('click', () => go(1));
    },
  },

  ajustes: {
    title: 'Ajustes',
    body() {
      const seg = (opts, active) => `<div class="seg">${opts.map((o) => `<button class="${o === active ? 'is-active' : ''}">${o}</button>`).join('')}</div>`;
      return `
      <div class="settings__section"><div class="settings__head">Aparência · soberania estética</div>
        <p class="settings__note mono">Personalização completa — grátis e ilimitada em <b>todos os tiers</b>. Em A, a forma é sua; só a função é curada.</p>
        <div class="settings pz-host">${personalizationControls()}</div>
      </div>
      <div class="settings__section"><div class="settings__head">Som</div>
        <div class="settings">
          <div class="setting"><span class="setting__label">Sons do sistema<small class="setting__sub">efeitos e alertas</small></span><button class="switch" data-on="true" data-key="sons" aria-label="Sons do sistema"></button></div>
          <div class="setting"><span class="setting__label">Notificações<small class="setting__sub">avisos do agente</small></span><button class="switch" data-on="false" data-key="notif" aria-label="Notificações"></button></div>
          <div class="setting"><span class="setting__label">Voz do agente<small class="setting__sub">como o agente fala</small></span>${seg(['Padrão', 'Baixa', 'Silenciosa'], 'Padrão')}</div>
        </div>
      </div>
      <div class="settings__section"><div class="settings__head">Conta</div>
        <div class="settings__about">
          <div class="row"><span>Nome</span><span>João Pedro Barros</span></div>
          <div class="row"><span>Assistente ativo</span><span>${AGENTS[state.agent].name} · ativo</span></div>
          <div class="row"><span>Plano (função)</span><span>OrchOS · ${TIER_LABEL[state.tier]}</span></div>
          <div class="row"><span>Personalização</span><span>Ilimitada · todos os tiers</span></div>
          <div class="row"><span>Sincronização</span><span>Soberano · local</span></div>
        </div>
      </div>
      <div class="settings__section"><div class="settings__head">Sistema</div>
        <div class="settings">
          <div class="setting"><span class="setting__label">Conexão do agente<small class="setting__sub">simular perda de conexão · 8s sem agente</small></span><button class="seg-btn" id="simOffline">Simular perda</button></div>
        </div>
      </div>
      <div class="settings__section"><div class="settings__head">Sobre</div>
        <div class="settings__about">
          <div class="row"><span>Versão</span><span>OrchOS 2031.1 · Edição Atelier</span></div>
          <div class="row"><span>Quadrante</span><span>A · Soberania + Desigualdade Alta</span></div>
          <div class="row"><span>Pesquisa</span><span>TIDD/PUC-SP · Linha 2</span></div>
          <div class="row"><span>Natureza</span><span>Design Fiction · diegético</span></div>
          <div class="row"><span>Orientação</span><span>Prof. Dr. Marcelo V. Prioste</span></div>
        </div>
      </div>`;
    },
    wire(root) {
      wirePersonalization(root);   // mesma personalização do Atelier, dentro do app
      const sim = root.querySelector('#simOffline');
      if (sim) sim.addEventListener('click', () => { closeApp(); goOffline(); });
      root.querySelectorAll('.switch').forEach((sw) =>
        sw.addEventListener('click', () => { sw.dataset.on = String(sw.dataset.on !== 'true'); }));
      root.querySelectorAll('.seg').forEach((seg) =>
        seg.querySelectorAll('button').forEach((b) =>
          b.addEventListener('click', () => { seg.querySelectorAll('button').forEach((x) => x.classList.remove('is-active')); b.classList.add('is-active'); })));
    },
  },
};

/* ---------- Conteúdo da janela única (modos viram conteúdo, não telas) ---------- */
const CONVOS = [
  { title: 'Documento da tese', snip: 'continuar o doc…' },
  { title: 'Planejar a semana', snip: 'resumo do dia' },
  { title: 'Pesquisa OrchOS', snip: 'PESTEL e matriz 2x2' },
  { title: 'Lista de compras', snip: 'ovos, café, arroz…' },
  { title: 'Configurações', snip: 'modo jogo — ontem' },
];

function welcomeBody() {
  return `<div class="editor__page editor__page--center"><h1 class="editor__hero">${greetByTime().hero}</h1><div class="editor__meta mono">PRÉ-PROJETO DE TESE · TIDD/PUC-SP · RASCUNHO</div></div>`;
}
function escritaBody() {
  return `<div class="editor__page" contenteditable="true" spellcheck="false">
    <h1 class="editor__title">O agente como sistema operacional</h1>
    <div class="editor__meta mono">PRÉ-PROJETO DE TESE · TIDD/PUC-SP · RASCUNHO</div>
    <p>E se o sistema operacional não fosse mais janelas e ícones, mas um agente que conhece você? O OrchOS extrapola para 2031 tecnologias que já existem hoje — memória persistente, multimodalidade, computer use — até o agente deixar de rodar sobre o sistema e passar a ser o sistema.</p>
    <p>A interação primária deixa de ser o ponteiro e passa a ser a linguagem. O usuário não abre um programa: ele diz o que quer. “Entrar no modo de escrita”, e o ambiente se reconfigura — silencia distrações, abre o editor, traz a pesquisa à frente.</p>
    <p>Toda mediação, porém, tem um preço. Quem controla o agente que controla tudo? O OrchOS não responde: encena o dilema entre soberania e dependência.</p>
  </div>`;
}
function jogoBody() {
  // gameplay real preenchendo a janela (fiel ao Penpot) — sem texto sobreposto
  const game = GAMES.find((item) => item.id === state.activeGame) || GAMES[0];
  return `<div class="game"><div class="game__viewport" style="--game-cover:url('${game.cover}')"><span class="game__live mono"><span class="game__dot"></span>${game.title} · AO VIVO</span></div></div>`;
}
const GAMES = [
  { id: 'sekiro', title: 'Sekiro', meta: 'AÇÃO · 60 FPS · CONTROLE', cover: 'assets/sekiro.png', state: 'Pronto para jogar' },
  { id: 'hollow', title: 'Hollow Knight', meta: 'METROIDVANIA · CLOUD SAVE', cover: 'assets/background.jpg', state: 'Instalado' },
  { id: 'celeste', title: 'Celeste', meta: 'PLATAFORMA · FOCO', cover: 'assets/bg.jpg', state: 'Pausado' },
  { id: 'disco', title: 'Disco Elysium', meta: 'RPG · TEXTO', cover: 'assets/background1.jpg', state: 'Biblioteca' },
];

function jogosBody() {
  const cards = GAMES.map((game, index) =>
    `<button class="gamecard${index === 0 ? ' is-primary' : ''}" data-game="${escAttr(game.id)}">
      <span class="gamecard__cover" style="background-image:url('${game.cover}')"></span>
      <span class="gamecard__body">
        <span class="gamecard__title">${game.title}</span>
        <span class="gamecard__meta mono">${game.meta}</span>
        <span class="gamecard__state">${game.state}</span>
      </span>
      <span class="gamecard__play mono">Jogar</span>
    </button>`).join('');
  return `<div class="gamelib">
    <div class="gamelib__head">
      <div><h2>Jogos</h2><p>Escolha um jogo para expandir no campo central.</p></div>
      <span class="gamelib__count mono">${GAMES.length} disponíveis</span>
    </div>
    <div class="gamelib__grid">${cards}</div>
  </div>`;
}

function wireJogos(root) {
  root.querySelectorAll('.gamecard').forEach((card) =>
    card.addEventListener('click', () => launchGame(card.dataset.game)));
}

function launchGame(id) {
  const game = GAMES.find((item) => item.id === id) || GAMES[0];
  WM.closeAll();
  setState({ mode: 'jogo', agent: 'durin', gameActive: true, activeGame: game.id });
  addBubble('agent', `${game.title} expandido no campo central.`);
}
function conversaBody() {
  const items = CONVOS.map((c, i) => `<li class="convo__item${i === 0 ? ' is-active' : ''}" data-title="${escAttr(c.title)}"><span class="convo__title">${c.title}</span><span class="convo__snippet mono">${c.snip}</span></li>`).join('');
  return `<div class="convo"><div class="convo__header">Conversas</div><button class="convo__new mono">+  Nova conversa</button><ul class="convo__list" id="convoList">${items}</ul></div>`;
}
function wireConvo(root) {
  root.querySelectorAll('.convo__item').forEach((item) =>
    item.addEventListener('click', () => {
      root.querySelectorAll('.convo__item').forEach((i) => i.classList.remove('is-active'));
      item.classList.add('is-active');
      addBubble('agent', `Abrindo “${item.dataset.title}”.`);
    }));
  const nova = root.querySelector('.convo__new');
  if (nova) nova.addEventListener('click', () => { state.threads[state.agent] = []; renderThread(); });
}

const DEV_FILES = {
  'app.js': {
    lang: 'JavaScript',
    path: 'orchos-prototipo/app.js',
    code: [
      "const state = { mode: 'desenvolvimento', agent: 'durin' };",
      '',
      "const MODE_AGENT = { desenvolvimento: 'desenvolvedor' };",
      "const MODE_WINDOW = { desenvolvimento: { id: 'ide', opts: { center: true } } };",
      '',
      'function switchMode(mode) {',
      '  WM.closeAll();',
      '  setState({ mode, agent: MODE_AGENT[mode] || state.agent });',
      '  const win = MODE_WINDOW[mode];',
      '  if (win) WM.open(win.id, win.opts);',
      '}',
      '',
      'const WIN = {',
      "  ide: { title: 'OrchOS Studio', body: desenvolvimentoBody },",
      '};',
      '',
      '// Simulado: a IDE mostra estado, mas não executa comandos reais.',
    ].join('\n'),
  },
  'styles.css': {
    lang: 'CSS',
    path: 'orchos-prototipo/styles.css',
    code: [
      '.ide {',
      '  display: grid;',
      '  grid-template-columns: 46px 230px minmax(0, 1fr);',
      '  height: 100%;',
      '  background: #111217;',
      '}',
      '',
      '.ide__editor {',
      '  font-family: var(--font-mono);',
      '  color: var(--text-secondary);',
      '  overflow: auto;',
      '}',
      '',
      '.ide__status {',
      '  height: 24px;',
      '  display: flex;',
      '  align-items: center;',
      '}',
    ].join('\n'),
  },
  'agents/durin.md': {
    lang: 'Markdown',
    path: 'agents/durin.md',
    code: [
      '# Durin',
      '',
      'Orquestrador do OrchOS.',
      '',
      '- lê o estado do usuário',
      '- decide qual executor chamar',
      '- mantém a coerência entre modos',
      '- nunca executa ações destrutivas sem confirmação',
      '',
      'No Modo Desenvolvimento, Durin observa a IDE e transforma intenção em plano técnico.',
    ].join('\n'),
  },
  'package.json': {
    lang: 'JSON',
    path: 'package.json',
    code: [
      '{',
      '  "scripts": {',
      '    "dev": "node serve.js",',
      '    "check": "node --check app.js",',
      '    "preview": "node serve.js"',
      '  },',
      '  "private": true',
      '}',
    ].join('\n'),
  },
};

function ideCodeHtml(fileName) {
  const file = DEV_FILES[fileName] || DEV_FILES['app.js'];
  return file.code.split('\n').map((line, index) =>
    `<div class="ide__line"><span class="ide__ln">${index + 1}</span><code>${escapeHtml(line) || ' '}</code></div>`).join('');
}

function desenvolvimentoBody() {
  const files = Object.keys(DEV_FILES);
  const active = files[0];
  const fileButtons = files.map((file, index) =>
    `<button class="ide__file${index === 0 ? ' is-active' : ''}" data-file="${escAttr(file)}"><span class="ide__file-dot"></span><span>${file}</span></button>`).join('');
  const tabs = files.slice(0, 3).map((file, index) =>
    `<button class="ide__tab${index === 0 ? ' is-active' : ''}" data-file="${escAttr(file)}">${file}</button>`).join('');
  return `<div class="ide" data-current="${escAttr(active)}">
    <aside class="ide__activity" aria-label="Atividade">
      <button class="ide__activity-btn is-active" aria-label="Arquivos">F</button>
      <button class="ide__activity-btn" aria-label="Busca">S</button>
      <button class="ide__activity-btn" aria-label="Git">G</button>
      <button class="ide__activity-btn" aria-label="Debug">D</button>
    </aside>
    <aside class="ide__explorer">
      <div class="ide__explorer-title mono">EXPLORER</div>
      <div class="ide__project">ORCHOS-PROTOTIPO</div>
      <div class="ide__tree">${fileButtons}</div>
    </aside>
    <section class="ide__main">
      <div class="ide__tabs">${tabs}</div>
      <div class="ide__editor">
        <div class="ide__crumb mono" id="ideCrumb">${DEV_FILES[active].path}</div>
        <div class="ide__codewrap">
          <pre class="ide__code" id="ideCode">${ideCodeHtml(active)}</pre>
          <div class="ide__minimap" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
        </div>
      </div>
      <div class="ide__panel">
        <div class="ide__panel-tabs mono"><span>PROBLEMS</span><span>OUTPUT</span><span class="is-active">TERMINAL</span><button class="ide__run" type="button">npm run check</button></div>
        <div class="ide__terminal mono" id="ideTerminal">
          <div><span class="ide__prompt">jb@orchos</span> npm run dev</div>
          <div>serving on http://127.0.0.1:8123</div>
          <div>watch mode simulated · no process was started</div>
        </div>
      </div>
      <div class="ide__status mono"><span>main</span><span id="ideLang">${DEV_FILES[active].lang}</span><span>UTF-8</span><span>OrchOS Dev Mode · simulated</span></div>
    </section>
  </div>`;
}

function wireIde(root) {
  const ide = root.querySelector('.ide');
  if (!ide) return;
  const code = root.querySelector('#ideCode');
  const crumb = root.querySelector('#ideCrumb');
  const lang = root.querySelector('#ideLang');
  const terminal = root.querySelector('#ideTerminal');
  const activate = (fileName) => {
    const file = DEV_FILES[fileName] || DEV_FILES['app.js'];
    ide.dataset.current = fileName;
    root.querySelectorAll('[data-file]').forEach((el) => el.classList.toggle('is-active', el.dataset.file === fileName));
    code.innerHTML = ideCodeHtml(fileName);
    crumb.textContent = file.path;
    lang.textContent = file.lang;
  };
  root.querySelectorAll('[data-file]').forEach((el) => el.addEventListener('click', () => activate(el.dataset.file)));
  const run = root.querySelector('.ide__run');
  if (run) run.addEventListener('click', () => {
    terminal.innerHTML = `<div><span class="ide__prompt">jb@orchos</span> npm run check</div><div>node --check app.js</div><div class="ide__ok">ok · sintaxe válida · ambiente simulado</div>`;
  });
}

const DOC_DEFAULT_TITLE = DOC_LIST[1].t;
const DOC_TEXT = {
  'A Relevância do Design de Agentes': {
    meta: 'PRÉ-PROJETO DE TESE · TIDD/PUC-SP · orientação Prof. Marcelo V. Prioste',
    html: `<p>O Design não nasce de uma matéria própria. Buchanan lembra que ele se desloca entre símbolos, coisas, ações e sistemas; sua força está justamente em entrar onde um novo tipo de objeto aparece. Agentes de IA são esse novo objeto.</p>
      <p>Projetar um agente não é apenas desenhar uma tela. É definir uma relação: o que o agente sabe, o que ele decide, quando pede permissão, quando recusa, que memória preserva e que dependências cria. A interface deixa de ser superfície e passa a ser mediação.</p>
      <p>A tese parte daí: o que das teorias do Design transfere para o Design de Agentes, o que precisa ser adaptado, o que deixa de caber e o que surge como problema novo? O OrchOS funciona como caso concreto para testar essa passagem.</p>`,
  },
  'OrchOS — o agente como sistema operacional': {
    meta: 'DESIGN FICTION · protótipo diegético · horizonte 2031 · Caso 3',
    html: `<p>E se o sistema operacional não fosse mais um conjunto de janelas, ícones e menus, mas um agente que conhece o usuário e reorganiza o ambiente a partir de linguagem? O OrchOS extrapola tecnologias já visíveis hoje: memória persistente, multimodalidade, computer use e automação local.</p>
      <p>Em vez de abrir programas, o usuário diz o que pretende fazer. "Entrar no modo escrita" reorganiza o campo: silencia distrações, traz documentos, chama o orientador e deixa o editor em primeiro plano. A operação vira conversa, e a conversa vira sistema.</p>
      <p>O protótipo não afirma que 2031 será assim. Ele encena uma possibilidade para tornar visível uma tensão: quanto mais o agente simplifica a vida, mais ele passa a mediar a autonomia do usuário. OrchOS é uma pergunta em forma de interface.</p>`,
  },
  'PESTEL — OrchOS': {
    meta: 'CENÁRIO 2031 · Político · Econômico · Social · Tecnológico · Ecológico · Legal',
    html: `<p><strong>Político.</strong> A soberania digital desloca-se dos dados para os agentes. Governos passam a disputar quem licencia, audita e pode desligar sistemas que mediam trabalho, estudo, consumo e cuidado.</p>
      <p><strong>Econômico.</strong> A conta central deixa de ser armazenamento e passa a ser inferência contínua. Quem paga pelo agente paga pela própria capacidade de agir; quem controla a infraestrutura concentra poder.</p>
      <p><strong>Social.</strong> Interfaces conversacionais reduzem a curva de aprendizado, mas deslocam competência para confiança. Saber operar perde espaço para saber delegar, revisar e desconfiar.</p>
      <p><strong>Tecnológico.</strong> Memória, visão, voz e computer use convergem. O agente deixa de apenas responder e passa a executar sobre o ambiente, atravessando aplicativos que antes eram fronteiras.</p>
      <p><strong>Ecológico.</strong> A leveza da experiência local esconde o peso energético remoto. Cada gesto mediado pode virar inferência, deslocando custo ambiental para data centers.</p>
      <p><strong>Legal.</strong> A responsabilidade por atos delegados fica instável. Se o agente compra, apaga, assina ou recomenda, quem responde: usuário, fornecedor, modelo, integrador ou sistema operacional?</p>`,
  },
  'Matriz 2x2 — Soberania × Dependência': {
    meta: 'QUATRO FUTUROS DO SISTEMA OPERACIONAL AGÊNTICO',
    html: `<p>A matriz cruza dois eixos. <strong>Soberania</strong> mede o quanto o usuário controla dados, memória, regras e decisões do agente. <strong>Dependência</strong> mede o quanto a vida cotidiana passa a exigir esse agente para funcionar.</p>
      <p><strong>Companheiro: alta soberania, alta dependência.</strong> O agente é central, mas auditável, portátil e recusável. O usuário depende dele sem ser capturado por ele.</p>
      <p><strong>Coleira: baixa soberania, alta dependência.</strong> É o quadrante crítico. O agente organiza tudo, mas pertence a outro. A conveniência vira infraestrutura de controle.</p>
      <p><strong>Ferramenta: alta soberania, baixa dependência.</strong> O agente ajuda quando chamado, mas não estrutura a vida. É útil, localizável e substituível.</p>
      <p><strong>Irrelevância: baixa soberania, baixa dependência.</strong> O agente não ganha confiança nem centralidade. O futuro prometido não se materializa.</p>`,
  },
  'Notas de orientação — Prof. Marcelo Prioste': {
    meta: 'REVISÃO DO RECORTE TEÓRICO · amarrar ao referencial',
    html: `<p>Anotações de orientação para consolidar o recorte. O tema está forte, mas precisa aparecer como problema de Design antes de aparecer como fascínio tecnológico.</p>
      <ul>
        <li>Abrir com Buchanan para justificar por que agentes cabem no campo do Design.</li>
        <li>Declarar que OrchOS é Design Fiction: proposta crítica, não previsão tecnológica.</li>
        <li>Explicitar o eixo soberania × dependência como argumento, não como metáfora solta.</li>
        <li>Trazer Costanza-Chock para perguntar quem é centralizado e quem fica fora da mediação agêntica.</li>
        <li>Evitar afirmações amplas sem fonte. Cada salto precisa de sustentação bibliográfica ou de evidência no protótipo.</li>
      </ul>`,
  },
  'Mapa de Transferência: das teorias do Design para o Design de Agentes': {
    meta: 'TRANSFERE · ADAPTA · NÃO CABE · É NOVO',
    html: `<p>Este mapa organiza a contribuição metodológica da tese: observar teorias de Design diante do agente como novo objeto projetual.</p>
      <ul>
        <li><strong>Transfere: wicked problems.</strong> O agente que medeia tudo não tem solução final. Ele exige posições, trade-offs e responsabilidade situada.</li>
        <li><strong>Transfere: design centrado no humano.</strong> Continua válido, mas o humano já não interage apenas com uma ferramenta; negocia com um mediador ativo.</li>
        <li><strong>Adapta: affordance.</strong> A pergunta deixa de ser o que a forma sugere e passa a ser o que o agente se oferece para fazer em nome do usuário.</li>
        <li><strong>Não cabe: hierarquia visual como centro da experiência.</strong> Quando a ação principal é conversacional e contextual, a tela deixa de ser o único organizador.</li>
        <li><strong>É novo: projetar recusa, memória e delegação.</strong> O Design de Agentes precisa definir o que o sistema lembra, esquece, executa, pergunta e se nega a fazer.</li>
      </ul>`,
  },
};

function editorBody(docName) {
  const key = DOC_TEXT[docName] ? docName : DOC_DEFAULT_TITLE;
  const c = DOC_TEXT[key];
  return `<div class="editor__page" contenteditable="true" spellcheck="false"><h1 class="editor__title">${escapeHtml(key)}</h1><div class="editor__meta mono">${c.meta}</div>${c.html}</div>`;
}

/* registro de janelas: apps + janelas de sistema (editor por doc, conversas) — tudo flutua */
const WIN = Object.assign({}, APPS, {
  editor:   { title: 'Documento', body: (view, w) => editorBody(w && w.doc), wire: null },
  jogos:    { title: 'Jogos', body: () => jogosBody(), wire: (root) => wireJogos(root) },
  ide:      { title: 'OrchOS Studio', body: () => desenvolvimentoBody(), wire: (root) => wireIde(root) },
  conversa: { title: 'Conversas', body: () => conversaBody(), wire: (root) => wireConvo(root) },
});

/* cada documento abre na SUA janela (id único por doc) */
function openEditor(docName) { WM.open('doc:' + docName, { title: docName, doc: docName }); }

/* ---------- Gerenciador de janelas (campo: arrastar · redimensionar · fechar · focar) ---------- */
const WM = {
  z: 30,
  wins: {},
  _focused: null,
  field() { return document.getElementById('windows'); },
  open(id, opts = {}) {
    if (this.wins[id]) {
      if (opts.title) { this.wins[id].titleOverride = opts.title; this.renderContent(id); }
      if (opts.doc) { this.wins[id].doc = opts.doc; this.renderContent(id); }
      this.focus(id); return;
    }
    const f = this.field();
    const n = Object.keys(this.wins).length;
    const fw = f.clientWidth || 900, fh = f.clientHeight || 600;
    const width = Math.min(opts.w || 780, Math.max(420, fw - 140));
    const height = Math.min(opts.h || 540, Math.max(320, fh - 120));
    const x = opts.center ? Math.max(20, Math.round((fw - width) / 2)) : 48 + n * 30;
    const y = opts.center ? Math.max(20, Math.round((fh - height) / 2)) : 36 + n * 30;
    const w = {
      id, view: [],
      doc: opts.doc || null,
      x, y,
      w: width,
      h: height,
    };
    const el = document.createElement('div');
    el.className = 'win'; el.dataset.app = id;
    el.style.cssText = `left:${w.x}px;top:${w.y}px;width:${w.w}px;height:${w.h}px;`;
    const rz = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].map((d) => `<div class="win__rz win__rz--${d}" data-dir="${d}"></div>`).join('');
    el.innerHTML = `<div class="win__bar"><span class="win__dots"><i class="editor__dot"></i><i class="editor__dot"></i><i class="editor__dot"></i></span><button class="win__back" aria-label="Voltar"><svg class="ico" viewBox="0 0 24 24"><path d="M14 6 L8 12 L14 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Voltar</span></button><span class="win__title"></span><button class="win__close" aria-label="Fechar"><svg class="ico" viewBox="0 0 24 24"><path d="M7 7 L17 17 M17 7 L7 17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button></div><div class="win__body"></div>${rz}`;
    w.el = el;
    w.titleOverride = opts.title || null;
    this.wins[id] = w;
    f.appendChild(el);
    this.wireWin(w);
    this.focus(id);
    this.renderContent(id);
    renderRailActive();
    if (!opts.silent && !state.agentOffline) addBubble('agent', `Abrindo ${opts.title || WIN[id].title}.`);
  },
  focus(id) {
    const w = this.wins[id]; if (!w) return;
    w.el.style.zIndex = ++this.z;
    this._focused = id;
    Object.values(this.wins).forEach((x) => x.el.classList.toggle('is-focus', x.id === id));
  },
  focused() { return this._focused && this.wins[this._focused] ? this._focused : null; },
  close(id) {
    const w = this.wins[id]; if (!w) return;
    w.el.remove(); delete this.wins[id];
    if (this._focused === id) this._focused = Object.keys(this.wins).pop() || null;
    if (this._focused) this.focus(this._focused);
    renderRailActive();
  },
  closeAll() { Object.keys(this.wins).forEach((id) => this.close(id)); },
  renderContent(id) {
    const w = this.wins[id]; if (!w) return;
    const def = WIN[id] || (id.startsWith('doc:') ? WIN.editor : null);
    if (!def) return;
    const top = w.view[w.view.length - 1];
    w.el.querySelector('.win__title').textContent = (top && top.title) ? top.title : (w.titleOverride || def.title);
    w.el.querySelector('.win__back').classList.toggle('show', w.view.length > 0);
    const body = w.el.querySelector('.win__body');
    body.innerHTML = def.body(w.view, w);
    if (def.wire) def.wire(body, w.view);
  },
  pushView(id, v) { const w = this.wins[id]; if (!w) return; w.view = [...w.view, v]; this.renderContent(id); },
  popView(id) { const w = this.wins[id]; if (!w) return; if (w.view.length) { w.view = w.view.slice(0, -1); this.renderContent(id); } },
  wireWin(w) {
    const el = w.el;
    el.addEventListener('pointerdown', () => this.focus(w.id), true);
    el.querySelector('.win__close').addEventListener('click', (e) => { e.stopPropagation(); this.close(w.id); });
    el.querySelector('.win__back').addEventListener('click', (e) => { e.stopPropagation(); this.popView(w.id); });
    el.querySelector('.win__bar').addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; this.drag(w, e); });
    el.querySelectorAll('.win__rz').forEach((h) => h.addEventListener('pointerdown', (e) => this.resize(w, e, h.dataset.dir)));
  },
  drag(w, e) {
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY, ox = w.x, oy = w.y;
    w.el.classList.add('dragging');
    const move = (ev) => { w.x = ox + (ev.clientX - sx); w.y = Math.max(0, oy + (ev.clientY - sy)); w.el.style.left = w.x + 'px'; w.el.style.top = w.y + 'px'; };
    const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); w.el.classList.remove('dragging'); };
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
  },
  resize(w, e, dir) {
    e.preventDefault(); e.stopPropagation();
    this.focus(w.id);
    const sx = e.clientX, sy = e.clientY, ox = w.x, oy = w.y, ow = w.w, oh = w.h;
    const minW = 360, minH = 240;
    const move = (ev) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (dir.includes('e')) w.w = Math.max(minW, ow + dx);
      if (dir.includes('s')) w.h = Math.max(minH, oh + dy);
      if (dir.includes('w')) { const nw = Math.max(minW, ow - dx); w.x = ox + (ow - nw); w.w = nw; }
      if (dir.includes('n')) { const nh = Math.max(minH, oh - dy); w.y = Math.max(0, oy + (oh - nh)); w.h = nh; }
      w.el.style.left = w.x + 'px'; w.el.style.top = w.y + 'px';
      w.el.style.width = w.w + 'px'; w.el.style.height = w.h + 'px';
    };
    const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); };
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
  },
};

/* fachada usada pelos apps (a janela focada é o alvo) */
function openApp(id) {
  // gating: app de atalho acima do tier → paywall (Documentos/Ajustes são Livre)
  if (APP_TIER[id] && !isUnlocked('app', id)) { openPaywall('app', id); return; }
  WM.open(id);
}
function pushView(v) { const id = WM.focused(); if (id) WM.pushView(id, v); }
function popView() { const id = WM.focused(); if (id) WM.popView(id); }
function closeApp() { const id = WM.focused(); if (id) WM.close(id); }

function renderRailActive() {
  document.querySelectorAll('#shortcuts .rail__item').forEach((el) =>
    el.classList.toggle('is-active', !!WM.wins[el.dataset.app]));
}

function wireSuggest(root) {
  root.querySelectorAll('.suggest__card').forEach((card) =>
    card.addEventListener('click', () => {
      addBubble('user', card.querySelector('.suggest__title').textContent);
      thinkThen(() => addBubble('agent', getResponse(state.agent, state.mode)));
    }));
}

/* renderiza o DESKTOP (fundo do campo) conforme o modo — as janelas flutuam por cima */
function renderDesktop() {
  const d = document.getElementById('desktop');
  if (!d) return;
  if (state.mode === 'jogo' && state.gameActive) {
    d.className = 'desktop desktop--game'; d.innerHTML = jogoBody(); return;
  }
  // Padrão/Escrita/Conversa: o campo mostra a área de trabalho; editor e conversas são janelas
  d.className = 'desktop';
  d.innerHTML = `<div class="deskwelcome"><h1 class="editor__hero">${greetByTime().hero}</h1><div class="editor__meta mono">PRÉ-PROJETO DE TESE · TIDD/PUC-SP · RASCUNHO</div></div>
    <div class="suggest"><div class="suggest__header">Sugestões do assistente</div><div class="suggest__row">
      <button class="suggest__card"><span class="suggest__title">Resumir este documento</span><span class="suggest__sub mono">sugerido agora</span></button>
      <button class="suggest__card"><span class="suggest__title">Traduzir a seleção</span><span class="suggest__sub mono">sugerido agora</span></button>
      <button class="suggest__card"><span class="suggest__title">Continuar escrevendo</span><span class="suggest__sub mono">sugerido agora</span></button>
    </div></div>`;
  wireSuggest(d);
}

/* ============================================================
   A-LAYER · selos de tier no rail · paywall · Atelier (personalização)
   ============================================================ */
const lockIco = '<svg class="ico" viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="9.5" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 10.5 V8 a4 4 0 0 1 8 0 v2.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>';

function tierBadgeHtml(tier) {
  if (tier === 'livre') return '';                 // Livre é a base soberana — sem selo
  return `<span class="tierbadge tierbadge--${tier}">${lockIco}${TIER_LABEL[tier]}</span>`;
}

/* injeta o selo de tier uma vez em cada item de atalho/modo */
function stampTiers() {
  document.querySelectorAll('#shortcuts .rail__item').forEach((el) => {
    const tier = tierFor('app', el.dataset.app);
    if (tier !== 'livre' && !el.querySelector('.tierbadge')) el.insertAdjacentHTML('beforeend', tierBadgeHtml(tier));
  });
  document.querySelectorAll('#modes .mode').forEach((el) => {
    const tier = tierFor('mode', el.dataset.mode);
    if (tier !== 'livre' && !el.querySelector('.tierbadge')) el.insertAdjacentHTML('beforeend', tierBadgeHtml(tier));
  });
}

/* a cada render, marca o que está travado para o tier atual */
function renderTiers() {
  document.querySelectorAll('#shortcuts .rail__item').forEach((el) =>
    el.classList.toggle('is-locked', !isUnlocked('app', el.dataset.app)));
  document.querySelectorAll('#modes .mode').forEach((el) =>
    el.classList.toggle('is-locked', !isUnlocked('mode', el.dataset.mode)));
}

/* ---------- Paywall (função curada × tier do usuário) ---------- */
function openPaywall(kind, id) {
  const key = `${kind}:${id}`;
  const meta = FEATURE_META[key] || { name: id, tier: tierFor(kind, id), price: 'R$ 79', per: '/mês', line: 'Função curada, fechada no seu plano atual.' };
  state.paywallTarget = { kind, id };
  document.getElementById('pwKicker').textContent = `Requer tier ${TIER_LABEL[meta.tier]}`;
  document.getElementById('pwFeature').textContent = meta.name;
  document.getElementById('pwLine').innerHTML = meta.line;
  document.getElementById('pwAmt').textContent = meta.price;
  document.getElementById('pwPer').textContent = meta.per;
  const pw = document.getElementById('paywall');
  pw.classList.add('is-open'); pw.setAttribute('aria-hidden', 'false');
  if (!state.agentOffline) addBubble('agent', `"${meta.name}" é curado. No seu tier ${TIER_LABEL[state.tier]} está fechado — posso te levar ao upgrade.`);
}
function closePaywall() {
  const pw = document.getElementById('paywall');
  pw.classList.remove('is-open'); pw.setAttribute('aria-hidden', 'true');
  state.paywallTarget = null;
}
function unlockTarget() {
  const tgt = state.paywallTarget;
  if (!tgt) { closePaywall(); return; }
  state.entitlements[`${tgt.kind}:${tgt.id}`] = true;       // desbloqueio avulso (simulado)
  const nm = (FEATURE_META[`${tgt.kind}:${tgt.id}`] || {}).name || tgt.id;
  closePaywall();
  render();                                                  // atualiza locks no rail
  addBubble('system', `Pagamento simulado · "${nm}" desbloqueado nesta sessão.`);
  if (tgt.kind === 'mode') switchMode(tgt.id); else openApp(tgt.id);
}

/* tierChip = trocador de plano simulado (controle de demo p/ a tese) */
const TIER_CYCLE = ['livre', 'plus', 'atelier'];
function cycleTier() {
  const next = TIER_CYCLE[(TIER_CYCLE.indexOf(state.tier) + 1) % TIER_CYCLE.length];
  setState({ tier: next });
  const note = next === 'atelier' ? 'Tudo desbloqueado.' : next === 'livre' ? 'De volta ao grátis — a maior parte fecha de novo.' : 'Funções Plus liberadas; Atelier ainda fecha.';
  addBubble('system', `Plano alterado para ${TIER_LABEL[next]} (simulado). ${note}`);
}

/* ---------- Atelier (soberania estética: reescreve CSS vars ao vivo) ---------- */
const AT_ACCENTS = [
  { name: 'Violeta',   v: '#8B5CF6', b: '#A78BFA', d: '#6D4FC4' },
  { name: 'Magenta',   v: '#D946EF', b: '#E879F9', d: '#A21CAF' },
  { name: 'Âmbar',     v: '#F59E0B', b: '#FBBF24', d: '#B45309' },
  { name: 'Esmeralda', v: '#10B981', b: '#34D399', d: '#047857' },
  { name: 'Carmim',    v: '#F43F5E', b: '#FB7185', d: '#BE123C' },
  { name: 'Ciano',     v: '#22D3EE', b: '#67E8F9', d: '#0891B2' },
  { name: 'Latão',     v: '#C9A24B', b: '#E0BE6A', d: '#977731' },
  { name: 'Índigo',    v: '#6366F1', b: '#818CF8', d: '#4338CA' },
  { name: 'Laranja',   v: '#F97316', b: '#FB923C', d: '#C2410C' },
  { name: 'Lima',      v: '#84CC16', b: '#A3E635', d: '#4D7C0F' },
  { name: 'Céu',       v: '#0EA5E9', b: '#38BDF8', d: '#0369A1' },
  { name: 'Rosa',      v: '#EC4899', b: '#F472B6', d: '#BE185D' },
];
const AT_FONTS = [
  { name: 'Space Grotesk',  css: "'Space Grotesk', system-ui, sans-serif", note: 'grotesk · padrão' },
  { name: 'Inter',          css: "'Inter', system-ui, sans-serif",         note: 'neutra · utilitária' },
  { name: 'Fraunces',       css: "'Fraunces', Georgia, serif",             note: 'serifa · editorial' },
  { name: 'JetBrains Mono', css: "'JetBrains Mono', monospace",            note: 'mono · código' },
  { name: 'Playfair Display',css:"'Playfair Display', Georgia, serif",     note: 'serifa · alta-costura' },
  { name: 'Syne',           css: "'Syne', system-ui, sans-serif",          note: 'display · fashion' },
  { name: 'Archivo',        css: "'Archivo', system-ui, sans-serif",       note: 'grotesk · pesada' },
  { name: 'Lora',           css: "'Lora', Georgia, serif",                 note: 'serifa · leitura' },
  { name: 'Space Mono',     css: "'Space Mono', monospace",                note: 'mono · retrô' },
];
const WALL_ASSET = { bisao: 'bg.jpg', slit: 'background.jpg' };
const AT_WALLS = [
  { id: 'atelier', name: 'Generativo' },
  { id: 'solido',  name: 'Sólido' },
  { id: 'bisao',   name: 'Bisão' },
  { id: 'slit',    name: 'Slit' },
];

const setVar = (k, v) => document.documentElement.style.setProperty(k, v);
const hexToRgb = (h) => { const m = h.replace('#', '').match(/.{2}/g); return m ? m.map((x) => parseInt(x, 16)).join(', ') : null; };
function applyAccent(a) {
  setVar('--accent', a.v); setVar('--accent-bright', a.b); setVar('--accent-dim', a.d);
  const rgb = hexToRgb(a.v), rgb2 = hexToRgb(a.b);
  if (rgb) { setVar('--accent-rgb', rgb); setVar('--accent-ghost', `rgba(${rgb}, 0.12)`); setVar('--accent-line', `rgba(${rgb}, 0.34)`); setVar('--grid-color', `rgba(${rgb}, 0.06)`); }
  if (rgb2) setVar('--accent2-rgb', rgb2);   // fundo generativo (2ª cor) acompanha o acento
  setVar('--accent-grad', `linear-gradient(135deg, ${a.v} 0%, ${a.b} 100%)`);
}
/* seleção atual de personalização (espelhada entre Atelier e Ajustes) */
const PZ = { accentIdx: 0, fontIdx: 0, radius: 5 };
const wallBg = (id) => id === 'atelier' ? 'linear-gradient(135deg,#8B5CF6,#D946EF)'
  : id === 'solido' ? 'linear-gradient(180deg,#2c2c33,#1d1d22)'
  : `url(assets/${WALL_ASSET[id]}) center/cover`;

/* Controles de personalização — reusados pelo Atelier (drawer) E pelo app Ajustes.
   A personalização é soberania pura: grátis, ilimitada, IGUAL em todos os tiers. */
function personalizationControls() {
  const sw = AT_ACCENTS.map((a, i) => `<button class="swatch pz-swatch${i === PZ.accentIdx ? ' is-active' : ''}" data-i="${i}" title="${a.name}" style="background:${a.v}"></button>`).join('');
  const fo = AT_FONTS.map((f, i) => `<button class="fontopt pz-font${i === PZ.fontIdx ? ' is-active' : ''}" data-i="${i}" style="font-family:${f.css}">${f.name}<small>${f.note}</small></button>`).join('');
  const wl = AT_WALLS.map((w) => `<button class="wallswatch pz-wall${w.id === state.wallpaper ? ' is-active' : ''}" data-id="${w.id}" style="background:${wallBg(w.id)}"><span>${w.name}</span></button>`).join('');
  return `
    <div class="atelier__group"><span class="atelier__lbl">Acento · ${AT_ACCENTS.length} cores</span><div class="atelier__swatches pz-swatches">${sw}</div></div>
    <div class="atelier__group"><span class="atelier__lbl">Fonte da interface · ${AT_FONTS.length} famílias</span><div class="atelier__fonts pz-fonts">${fo}</div></div>
    <div class="atelier__group"><span class="atelier__lbl">Raio das formas · <span class="atelier__rangeval pz-radiusval">${PZ.radius}px</span></span><input class="atelier__range pz-radius" type="range" min="0" max="22" value="${PZ.radius}" /></div>
    <div class="atelier__group"><span class="atelier__lbl">Campo / wallpaper</span><div class="atelier__walls pz-walls">${wl}</div><div class="wallmeta mono pz-wallmeta">${WALL_META[state.wallpaper] || ''}</div></div>`;
}

function wirePersonalization(root) {
  root.querySelectorAll('.pz-swatch').forEach((b) => b.addEventListener('click', () => {
    PZ.accentIdx = +b.dataset.i;
    root.querySelectorAll('.pz-swatch').forEach((x) => x.classList.remove('is-active')); b.classList.add('is-active');
    applyAccent(AT_ACCENTS[PZ.accentIdx]);
  }));
  root.querySelectorAll('.pz-font').forEach((b) => b.addEventListener('click', () => {
    PZ.fontIdx = +b.dataset.i;
    root.querySelectorAll('.pz-font').forEach((x) => x.classList.remove('is-active')); b.classList.add('is-active');
    setVar('--font-ui', AT_FONTS[PZ.fontIdx].css);
  }));
  const r = root.querySelector('.pz-radius'), rv = root.querySelector('.pz-radiusval');
  if (r) r.addEventListener('input', () => { PZ.radius = +r.value; setVar('--r-base', r.value + 'px'); if (rv) rv.textContent = r.value + 'px'; });
  root.querySelectorAll('.pz-wall').forEach((b) => b.addEventListener('click', () => {
    root.querySelectorAll('.pz-wall').forEach((x) => x.classList.remove('is-active')); b.classList.add('is-active');
    const meta = root.querySelector('.pz-wallmeta'); if (meta) meta.textContent = WALL_META[b.dataset.id] || '';
    setState({ wallpaper: b.dataset.id });
  }));
}

/* o drawer Atelier hospeda os mesmos controles */
function buildAtelier() {
  const body = document.querySelector('#atelier .atelier__body');
  if (!body) return;
  body.innerHTML = personalizationControls();
  wirePersonalization(body);
}
function openAtelier() { buildAtelier(); const a = document.getElementById('atelier'); a.classList.add('is-open'); a.setAttribute('aria-hidden', 'false'); }
function closeAtelier() { const a = document.getElementById('atelier'); a.classList.remove('is-open'); a.setAttribute('aria-hidden', 'true'); }

function wireALayer() {
  stampTiers();
  buildAtelier();
  document.getElementById('atelierBtn').addEventListener('click', openAtelier);
  document.getElementById('atelierClose').addEventListener('click', closeAtelier);
  document.getElementById('tierChip').addEventListener('click', cycleTier);
  document.getElementById('pwUpgrade').addEventListener('click', unlockTarget);
  document.getElementById('pwClose').addEventListener('click', closePaywall);
  document.getElementById('paywall').addEventListener('click', (e) => { if (e.target.id === 'paywall') closePaywall(); });
}

/* ---------- 7. Boot + wiring ---------- */
function seedThreads() {
  // Durin abre com saudação por horário (o sistema sabe quem e quando você é)
  state.threads.durin = [
    { role: 'agent', text: greetByTime().chat },
    { role: 'user',  text: 'Abrir meu documento' },
    { role: 'agent', text: 'Abrindo o documento na janela principal.' },
  ];
}

// saudação contextual no editor de boas-vindas
function applyGreeting() {
  const hero = document.getElementById('heroGreet');
  if (hero) hero.innerHTML = greetByTime().hero;
}

function runBoot() {
  // dispara a barra de progresso
  requestAnimationFrame(() => {
    const bar = document.getElementById('bootBar');
    if (bar) bar.style.width = '100%';
  });
  const enter = () => setState({ boot: 'shell' });
  const timer = setTimeout(enter, 2600);
  // clicar pula o boot
  document.getElementById('boot').addEventListener('click', () => { clearTimeout(timer); enter(); }, { once: true });
}

function wire() {
  // trocar modo pelo rail
  document.querySelectorAll('#modes .mode').forEach((el) =>
    el.addEventListener('click', () => switchMode(el.dataset.mode)));

  // trocar agente pelo rail
  document.querySelectorAll('#agents .agent').forEach((el) =>
    el.addEventListener('click', () => switchAgent(el.dataset.agent)));

  // chat: Enter envia
  const input = document.getElementById('chatInput');
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleChat(input.value);
      input.value = '';
    }
  });

  // mic = atalho de exemplo (envia um comando de linguagem)
  document.getElementById('micBtn').addEventListener('click', () => {
    handleChat('Entrar no modo de escrita');
  });

  // orb (modo jogo) → volta pro padrão e foca o chat
  document.getElementById('orb').addEventListener('click', () => {
    switchMode('padrao');
    document.getElementById('chatInput').focus();
  });

  // atalhos → abrem o app como JANELA flutuante (ou focam a já aberta)
  document.querySelectorAll('#shortcuts .rail__item').forEach((el) =>
    el.addEventListener('click', () => openApp(el.dataset.app)));

  // Home (wordmark) → Modo Padrão + foca o chat (janelas seguem abertas)
  document.getElementById('homeBtn').addEventListener('click', () => {
    setState({ mode: 'padrao' });
    const ci = document.getElementById('chatInput');
    if (ci) ci.focus();
    addBubble('agent', 'De volta ao início.');
  });

  // Esc → fecha paywall/Atelier se abertos; senão volta um nível na janela focada
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (document.getElementById('paywall').classList.contains('is-open')) { closePaywall(); return; }
    if (document.getElementById('atelier').classList.contains('is-open')) { closeAtelier(); return; }
    popView();
  });

  // Histórico (label do chat)
  const hist = document.querySelector('.chat__hist');
  if (hist) {
    hist.style.cursor = 'pointer';
    hist.addEventListener('click', () => addBubble('system', 'Histórico desta conversa salvo na nuvem.'));
  }

  // relógio vivo
  tickClock();
  setInterval(tickClock, 30000);
}

function tickClock() {
  const el = document.getElementById('clock');
  if (!el) return;
  const d = new Date();
  el.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/* ---------- 8. Init ---------- */
seedThreads();
applyGreeting();
render();
wire();
wireALayer();
runBoot();
