# OrchOS · Protótipo A — Soberania + Desigualdade Alta

Design fiction sobre o agente como sistema operacional (TIDD/PUC-SP · horizonte ~2031).
Quadrante **A** da matriz 2x2: **Soberania** (aberto · local · privado) × **Desigualdade ALTA**.

> *"open-source virou grife: artesanato de elite, mega-customizável (fonte, cor, forma)
> mas com funcionalidades fechadas e curadas."* — o Linux que virou luxo.

A provocação central de A é a tensão entre duas liberdades opostas:

- **Soberania estética total** — o **Atelier** (botão no topo) deixa você reescrever
  acento, fonte, raio das formas e o campo/wallpaper **ao vivo**. É grátis, ilimitado, celebrado.
- **Função curada e gated** — cada app e cada modo exige um **tier** (Livre / Plus / Atelier).
  Acima do seu plano, a função aparece sedutora mas travada, e tocar nela abre um **paywall**.

É o oposto diagonal do Protótipo B (neutro/cinza, sem alma, mas tudo liberado e igual para todos).

## Como mexer (controles de demo)

- **Atelier** (topo direito) → abre o painel de personalização. Troque cor, fonte, raio, wallpaper e veja repintar na hora.
- **Tier: Livre** (chip ao lado) → clique para alternar o plano simulado (Livre → Plus → Atelier → Livre) e ver o rail destravar.
- **Modo Jogo / Desenvolvimento / Navegador** → no tier Livre estão travados; clicar abre o paywall. "Desbloquear (simulado)" libera só naquela sessão (nada é cobrado).
- **Chat** entende linguagem solta (`jogo`, `abrir documentos`, `modo escrita`…) — comandos travados também caem no paywall.

## Tiers (estado padrão)

| Tier | Apps | Modos |
|------|------|-------|
| **Livre** | Documentos · Ajustes | Padrão |
| **Plus** | Galeria · Mídia · Mensagens | Escrita · Conversa |
| **Atelier** | Navegador (curado) | Desenvolvimento · Jogo |

## Rodar localmente

```bash
node serve.js 8124
```

Depois abra `http://127.0.0.1:8124/` (porta configurável pelo argumento; padrão 8124,
para coexistir com o Protótipo B em 8123).

## Estrutura

- `index.html` — shell + paywall + drawer do Atelier.
- `tokens.css` — Design System A (brutalist-couture): tinta/ônix, violeta generativo, grid, raios afiados. Fonte única de verdade.
- `styles.css` — base herdada de B + bloco de overrides/componentes de A (tiers, locks, paywall, Atelier).
- `app.js` — estado + tiers/gating + paywall + Atelier (reescreve CSS vars ao vivo) + janelas e interações simuladas.
- `assets/` — imagens.
