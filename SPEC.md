# OrchOS — Protótipo HTML (vanilla · interativo simulado)

Blueprint de build. Fonte de verdade visual: Penpot, board
`OrchOS · B — Mainhub · v3 FINAL (macOS neutro)` + modos derivados.
Tokens: `tokens.css` (já gerado).

## Stack
- Vanilla **HTML + CSS + JS**, zero build, zero dependências.
- Glassmorphism **real** via `backdrop-filter: blur(var(--glass-blur))` (o que o Penpot não fazia).
- Fontes via Google Fonts:
  `Geist` (UI) · `Spline Sans Mono` (sistema) · `Bitcount Grid Single` (wordmark).

## Arquivos
```
orchos-prototipo/
├── index.html        # shell + telas
├── tokens.css        # design tokens (pronto)
├── styles.css        # layout + componentes (usa as variáveis)
├── app.js            # estado + interações simuladas
└── assets/
    └── bg.png        # background bisão — exportar da Penpot (rect "background" em Janela OS)
```

## Anatomia do shell
- **Status bar** (topo, 48px): wordmark `OrchOS` · centro `Modo: <X>` · direita `Sincronizado · nuvem  14:32  wifi  bateria`.
- **Rail esquerdo** (240px): seções **ATALHOS** (Documentos, Navegador, Mídia, Mensagens, Galeria, Ajustes) · **AGENTES** (Durin*, Desenvolvedor, Orientador) · **MODOS** (Padrão, Jogo, Escrita, Conversa).
- **Canvas central**: muda por modo (ver abaixo).
- **Rail de chat** (360px, direita): header com agente ativo + thread + input. Presente em **todos os modos exceto Jogo**.

## Estados (modos) — o OS se reconfigura pela linguagem
| Modo | Canvas central | Chat | Notas |
|------|----------------|------|-------|
| **Padrão** | editor (janela flutuante) + cards de sugestão embaixo | sim | tela inicial / boas-vindas |
| **Escrita** | editor em foco (alto, sugestões fora) | **sim** (agente ajuda a escrever) | distrações silenciadas |
| **Jogo** | viewport near-black "Jogo em execução" | **não** → orb no canto ("toque para falar") | imersão |
| **Conversa** | thread expandido ao centro | sim (é o foco) | conversa primária |

## Interações simuladas (app.js)
- **Trocar modo** (clique no rail MODOS): reconfigura canvas, mostra/esconde chat, atualiza `Modo: <X>` na status bar, realça o modo ativo (`--surface-3`).
- **Trocar agente** (clique no rail AGENTES): troca header do chat (nome + role), injeta saudação canned do agente; realça ativo.
- **Digitar no chat** (input + Enter): adiciona bolha do usuário + resposta **roteirizada** (canned), variando por agente/modo. Manter um mapa `respostas[agente][gatilho]`.
- **Comandos de linguagem** (bônus): se a mensagem contém "modo jogo/escrita/conversa", o agente "executa" → troca o modo (o conceito da tese: dizer reconfigura o OS).

## Diretrizes visuais (do DS)
- Monocromático absoluto, **sem cor de acento** (Protótipo B = sóbrio, sem vida).
- Geist para conteúdo, Spline Mono para labels de sistema/uppercase, Bitcount só no wordmark.
- Superfícies = vidro (`--glass-fill` + `backdrop-filter`) sobre o `bg.png`; cards `--surface-2` + `--e1`; janela `--e3`.
- Raios na escala (8/12/16/22). Espaçamento base-8.

## Ícones (SVG inline — estilo monoline 1.8, `--icon-dim`/`--icon-default`)
Agentes:
- **Durin** (sparkle): `<path d="M12 4 L13.2 10.8 L20 12 L13.2 13.2 L12 20 L10.8 13.2 L4 12 L10.8 10.8 Z"/>` (fill)
- **Desenvolvedor** (`<>`): `<path d="M9 8 L5 12 L9 16 M15 8 L19 12 L15 16" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`
- **Orientador** (capelo): `<path d="M12 5 L21 9 L12 13 L3 9 Z"/><path d="M6 10.5 L6 15 C6 15 8.6 17 12 17 C15.4 17 18 15 18 15 L18 10.5"/>` (fill none, stroke 1.8)
- **Mic**: `<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11 a6.5 6.5 0 0 0 13 0 M12 17.5 v3"/>` (stroke 1.8)

App icons (Documentos, Navegador, Mídia, Mensagens, Galeria, Ajustes): exportar SVG da Penpot
(grupos `ico:*` em Janela OS) ou recriar monoline equivalente.

## MVP (ordem de build)
1. Shell + tokens + fontes + bg (estático, Modo Padrão).
2. Rail completo (3 seções) + chat funcional (digitar → resposta canned).
3. Troca de modos (reconfiguração do canvas).
4. Troca de agentes (header + saudação).
5. Comandos de linguagem que trocam modo (o golpe conceitual).
