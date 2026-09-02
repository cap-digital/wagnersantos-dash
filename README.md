# Painel de Mídia — Wagner Santos

Dashboard de performance das campanhas de Meta Ads de Wagner Santos.
Next.js 14 (App Router), Tailwind e Recharts.

São **dois painéis sobre os mesmos componentes**, separados apenas pela origem
dos dados:

| Painel | Rota | Origem | Estado |
| --- | --- | --- | --- |
| Campanha | `/campanha/...` | Meta Marketing API, ao vivo | ativo |
| Pré-campanha | `/pre-campanha/...` | função do Supabase | encerrado, congelado |

A capa oferece os dois: campanha em destaque, pré-campanha como botão secundário
com selo de encerrada. As rotas antigas `/visao-geral` e `/criativos` redirecionam
para a pré-campanha, que é o dado que sempre mostraram.

Gráficos, tabelas, filtros, KPIs e cálculos são **compartilhados**. A única
diferença entre os painéis é a camada de dados, e as duas entregam o mesmo
`CampaignPayload` normalizado.

## Rodando

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # build de produção
npm run lint
```

## Origem dos dados — campanha (Meta Marketing API)

A rota `app/api/campanha/route.ts` consulta a API direto, sempre no servidor. O
token nunca chega ao navegador: `lib/meta/client.ts` importa `server-only`, que
faz o build falhar se algum componente de cliente tentar puxar esse módulo.

### Cache particionado

Não há banco nem snapshot em disco — o deploy é na Vercel, onde o filesystem é
efêmero e a memória do processo morre com a instância. A validade fica no **Data
Cache do Next**, que persiste entre invocações e é compartilhado entre instâncias:

- **dias fechados**: `revalidate` de 24 h. O histórico não muda;
- **dia corrente**: `revalidate` de 10 minutos, com a tag `meta:today`.

As consultas são **particionadas por mês**, e cada página de cada partição é uma
entrada de cache própria. Duas razões: uma entrada do Data Cache da Vercel para
em 2 MB, e uma página de 1.000 linhas mede ~980 KB; e um mês fechado vira uma
chave estável, reaproveitada indefinidamente. As partições são buscadas em
paralelo e costuradas em memória.

Medido nesta conta: **19 s** na primeira carga com cache vazio (6 páginas de
insights + campanhas + criativos, 8 entradas somando 4,6 MB, maior entrada 1,2 MB)
e **0,7 s** nas seguintes. Cresce ~310 linhas por dia.

O selo de frescor mostra a idade do **dia corrente**, lida do cabeçalho `Date` da
resposta da Meta — ele sobrevive dentro do cache, então o painel informa a idade
real do dado em vez de reiniciar a contagem a cada request.

### Atualizar

O botão de atualizar revalida **apenas o dia corrente**, no máximo **uma vez por
minuto**. O limite se apoia na idade do dado em cache, não num contador em
memória, então vale entre instâncias em vez de zerar a cada cold start.

Na atualização forçada o dia corrente é lido fora do cache. Só invalidar a tag não
bastaria: o Next memoiza fetches por request, e a segunda leitura devolveria a
cópia que o próprio request já resolveu — o usuário veria "atualizado" sobre os
mesmos números.

### Falhas

- **Token expirado ou inválido** (código 190) e **limite de chamadas** (4, 17, 32,
  613) viram mensagem em português na interface, nunca tela branca.
- Se **uma partição falhar e as outras não**, o painel mostra o que carregou com
  um aviso nomeando o período que faltou. Só um erro de token derruba tudo, porque
  nenhum dado parcial compensa uma credencial vencida.

## Origem dos dados — pré-campanha (Supabase)

Os dados vêm de uma função do Supabase, consumida pela rota `app/api/meta/route.ts`,
que serve como proxy: mantém a chave fora do bundle do navegador e normaliza os
registros. **Este painel não mudou** — mesma origem, mesmo cache, mesmos números.

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
  page.tsx                  capa — dois botões, um por painel
  not-found.tsx             404
  api/meta/route.ts         pré-campanha: proxy do Supabase
  api/campanha/route.ts     campanha: Meta Marketing API
  (dash)/[source]/
    layout.tsx              topbar flutuante, filtros e provider
    visao-geral/page.tsx
    criativos/page.tsx
components/
  charts/                   gráficos (Recharts) + tema e rótulos
  tables/                   tabelas ordenáveis
  ui/                       Card, KPI, Insight, RankingList, SortableTable
lib/
  sources.ts                as duas fontes e seus rótulos
  meta/client.ts            cliente Graph, server-only, erros traduzidos
  meta/insights.ts          partições, cache e tolerância a falha
  meta/normalize.ts         linhas da API → mesmo formato do Supabase
  metrics.ts                agregação e cálculo de taxas e custos
  normalize.ts              coerção dos registros do Supabase
  format.ts                 formatação pt-BR
  labels.ts                 leitura dos nomes de campanha/conjunto/anúncio
```

Rotas são arquivos reais do App Router, então recarregar `/campanha/visao-geral`
funciona sem 404 — não há roteamento só no cliente. O segmento `[source]` aceita
apenas `campanha` e `pre-campanha`; qualquer outro valor cai no 404.

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

### Campos da Meta API

O que a planilha entregava pronto, a rota da campanha lê assim:

| Campo | Origem na API |
| --- | --- |
| investimento, impressões, cliques | `spend`, `impressions`, `clicks` |
| engajamentos | `actions[post_engagement]` |
| reações · comentários · compart. · salvos | `actions[post_reaction · comment · post · onsite_conversion.post_save]` |
| visitas ao perfil | `instagram_profile_visits` |
| views de vídeo (3s) | `actions[video_view]` |
| ThruPlays e 25/50/75/100% | `video_*_watched_actions[video_view]` |
| miniatura e permalink | `creative.thumbnail_width(1080).thumbnail_height(1080){…}` |

As taxas e custos **não** vêm da API: são recalculados em `lib/metrics.ts` sobre a
soma do recorte filtrado, como sempre foram.

### Identidade dos criativos

Um mesmo post costuma rodar em vários anúncios — um por campanha, um por cidade —
e o painel trata isso como **um criativo**, agrupado pelo permalink do Instagram,
com o id do anúncio como reserva.

Nomes, porém, não identificam nada sozinhos: a numeração recomeça a cada campanha
(dois anúncios diferentes chamados `AD10`) e oito anúncios se chamam apenas `[AD]`.
Quando dois criativos renderizariam o mesmo rótulo, o painel acrescenta a cidade do
conjunto e, se ainda empatar, um contador. O mesmo vale para conjuntos: cidade,
objetivo e posicionamento juntos ainda deixam cinco pares ambíguos nesta conta, e o
rótulo do gráfico é a categoria do eixo — dois conjuntos numa categoria seria uma
barra escondendo a outra. Por isso o código `CJ` vem na frente.

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

## Ranking paginado

Os dois gráficos que ranqueiam tudo — **investimento por conjunto** (visão geral) e
**engajamentos por criativo** (criativos) — mostram **8 barras por vez**, com
paginação no rodapé do card. Com dezenas de conjuntos e criativos, a lista inteira
virava um gráfico de vários metros de altura que empurrava o resto da página para
fora do alcance.

O eixo fica preso ao máximo do ranking inteiro, não ao da página. Deixar cada
página reescalar desenharia o oitavo colocado como uma barra cheia, e as páginas
deixariam de ser comparáveis entre si. A leitura escrita embaixo continua descrevendo
o conjunto completo, e o rodapé diz sempre "1–8 de 43", para o leitor saber que está
vendo parte de uma lista maior. Trocar a métrica volta para a primeira página, já que
a ordenação muda por inteiro.

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
