# Painel de Mídia — Wagner Santos

Dashboard de performance das campanhas de Meta Ads da pré-campanha de Wagner Santos.
Next.js 14 (App Router), Tailwind e Recharts.

## Rodando

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # build de produção
npm run lint
```

## Origem dos dados

Os dados vêm de uma função do Supabase, consumida pela rota `app/api/meta/route.ts`,
que serve como proxy: mantém a chave fora do bundle do navegador e normaliza os
registros.

### Desempenho

A origem é uma edge function com cold start e tempo de resposta medido entre
**5 e 102 segundos**. Nenhuma otimização de cliente compensa isso, então a
estratégia é o usuário nunca esperar por ela:

- **Cache com stale-while-revalidate** (`lib/campaign-cache.ts`): a cópia em
  cache é devolvida na hora e a atualização roda atrás da requisição. Só um
  cold start real espera a rede.
- **Snapshot em disco** (`os.tmpdir()`), então o cache sobrevive a reinícios e
  a instâncias frias, não só ao processo.
- **Aquecimento no boot** via `instrumentation.ts`: o servidor já busca os dados
  ao subir, para o primeiro visitante não pagar o cold start.
- **Uma requisição por vez**: chamadas concorrentes compartilham o mesmo fetch
  em vez de abrir várias conexões de 75s contra uma origem já sobrecarregada.
- **Compressão na rota**: o Next não comprime respostas de Route Handler, e este
  payload é JSON muito repetitivo — 184 KB viram **13,9 KB** com brotli.
- A capa dispara o carregamento assim que abre, sem esperar o clique.

Medido depois: **~1,6 s** abrindo `/visao-geral` direto e **0,58 s** até a capa
ficar pronta, contra 5–100 s antes. O botão "atualizar" força a busca mas espera
no máximo 12 s antes de devolver o que já tem — a busca continua atrás.

A rota é **dinâmica** (`force-dynamic`) de propósito: com `revalidate` o Next
pré-renderizava a rota no build e servia aquele resultado, então uma falha
ficava fixada e o "tentar de novo" recebia sempre a mesma resposta. A validade
é responsabilidade do cache, não do build.

A barra de filtros mostra a idade real dos dados ("Dados de há 3 min"), e se uma
atualização falhar aparece um aviso no topo — o painel nunca fica em branco.

Para apontar para outra origem, defina no `.env.local`:

```
META_FEED_URL=https://<projeto>.supabase.co/functions/v1/<funcao>
META_FEED_KEY=<publishable key>
```

Sem essas variáveis a rota usa a origem padrão embutida em `app/api/meta/route.ts`.

### Normalização

A Meta devolve `""` (string vazia) para métricas sem eventos no recorte — o
normalizador converte para `0`. As datas chegam como `2026-07-21T03:00:00.000Z`
(meia-noite no horário de Brasília) e o dia é extraído da própria string ISO,
para não deslocar o calendário em outros fusos.

As miniaturas dos criativos vêm assinadas pela CDN da Meta e expiram em poucos
dias; por isso são renderizadas com `<img>` e um fallback que mostra o
identificador do anúncio quando a assinatura vence.

## Estrutura

```
app/
  page.tsx                  capa — carrega os dados e entra no painel
  not-found.tsx             404
  api/meta/route.ts         proxy + normalização da origem
  (dash)/
    layout.tsx              topbar flutuante, filtros e provider
    visao-geral/page.tsx
    criativos/page.tsx
components/
  charts/                   gráficos (Recharts) + tema e rótulos
  tables/                   tabelas ordenáveis
  ui/                       Card, KPI, Insight, RankingList, SortableTable
lib/
  metrics.ts                agregação e cálculo de taxas e custos
  normalize.ts              coerção dos registros da origem
  format.ts                 formatação pt-BR
  labels.ts                 leitura dos nomes de campanha/conjunto/anúncio
```

Rotas são arquivos reais do App Router, então recarregar `/visao-geral` ou
`/criativos` funciona sem 404 — não há roteamento só no cliente.

## Métricas

Todas as taxas e custos são recalculados a partir da soma do recorte, nunca da
média das linhas — uma linha de 54 impressões não pode pesar igual a uma de 27 mil.

| Métrica | Cálculo |
| --- | --- |
| CPM | investimento ÷ impressões × 1000 |
| CPC | investimento ÷ cliques |
| CTR | cliques ÷ impressões |
| CPE | investimento ÷ engajamentos |
| Taxa de engajamento | engajamentos ÷ impressões |
| Hook rate | visualizações de 3s ÷ impressões |
| VTR | ThruPlays ÷ impressões |
| Conclusão | assistiram 100% ÷ visualizações de 3s |
| Custo por visita ao perfil | investimento ÷ visitas ao perfil |

Denominador zero devolve `null` e aparece como travessão, nunca como `0` ou `NaN`.

## Filtros

O período e a seleção de campanhas ficam numa única linha acima do conteúdo e
recortam todos os gráficos, KPIs e tabelas da página. A seleção fica no
`sessionStorage`, então recarregar mantém o recorte.

O filtro de campanhas começa vazio, e vazio significa "todas" — campanhas novas
entram no painel sozinhas, sem precisar mexer no filtro. Com uma única campanha
ativa, ele aparece apenas como um rótulo.

Quando existe um período anterior do mesmo tamanho, os KPIs mostram a variação;
quando não existe (todo o período selecionado), a variação simplesmente não é exibida.

## Paleta

O painel fica sobre o azul royal da campanha, não sobre preto — as marcas são
mais **claras** que a superfície, que é a faixa de luminosidade do modo claro
aplicada a um plano de tom médio. Validado com o validador de paletas do skill
`dataviz` contra a superfície dos cards (`#25377F`):

- categórica, 6 slots, pares adjacentes — **todos os checks passam**
  (pior ΔE sob daltonismo 10,5 · pior ΔE em visão normal 19,1 · contraste ≥ 3:1)
- categórica, 3 primeiros slots, todos os pares (dispersão) — **todos passam**
  (ΔE 11,4 / 19,1)
- rampa ordinal aqua, 6 degraus (funil) — **todos passam**

Regras em uso:

- amarelo `#FFD84D` é o acento — cromo ativo, números-herói e séries únicas;
- com duas ou mais séries, os slots categóricos entram na ordem fixa
  ouro → aqua → violeta → verde → azul → rosa, e a cor segue a entidade, nunca a
  posição no ranking;
- escalas ordenadas (etapas do funil) usam a rampa de um só tom;
- nenhum gráfico tem dois eixos Y: séries só dividem o plano quando compartilham
  a mesma unidade.

Tokens em `app/globals.css` e `components/charts/theme.ts`.

## Seletores de métrica

Cada gráfico comparativo tem um seletor no cabeçalho que troca a métrica
plotada — volume, custos e taxas, agrupados. O eixo, os rótulos, a ordenação e
a leitura escrita se ajustam sozinhos, e a ordenação sempre põe o melhor no
topo (para custos, o menor). Séries empilhadas e acumuladas só oferecem
métricas somáveis: uma taxa não tem total.

Os menus são posicionados com `position: fixed` contra o botão, porque os cards
recortam o próprio conteúdo e criam contextos de empilhamento — dentro deles um
menu absoluto seria cortado ou ficaria embaixo do card seguinte.

## Acessibilidade

Legenda sempre presente a partir de duas séries, rótulos diretos seletivos
(nunca um número em cada ponto) e tooltips que complementam. Nenhum valor
depende só do hover: os rótulos nas marcas e as duas tabelas ordenáveis — de
conjuntos e de criativos — carregam tudo. Status nunca é comunicado só por cor:
vem sempre com ícone e rótulo.
