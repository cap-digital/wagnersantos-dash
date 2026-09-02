/**
 * The two panels the dashboard serves. Both deliver the exact same
 * `CampaignPayload` to the exact same components — the only difference is where
 * the rows come from, which is why every source-specific string lives here
 * rather than being spread across pages and chrome.
 */
export const SOURCES = ["campanha", "pre-campanha"] as const;

export type SourceId = (typeof SOURCES)[number];

export type SourceInfo = {
  id: SourceId;
  /** URL segment — identical to the id, kept explicit for readability. */
  slug: string;
  /** "Campanha" — used in nav, titles and the footer. */
  label: string;
  /** Long form for the page title. */
  title: string;
  /** Where `/api` reads this source from. */
  endpoint: string;
  /** True when the period is over and the numbers no longer move. */
  frozen: boolean;
  /** Shown next to the name wherever the panel identifies itself. */
  badge: string | null;
  footer: string;
};

export const SOURCE_INFO: Record<SourceId, SourceInfo> = {
  campanha: {
    id: "campanha",
    slug: "campanha",
    label: "Campanha",
    title: "Painel da campanha",
    endpoint: "/api/campanha",
    frozen: false,
    badge: null,
    footer: "Dados de Meta Ads em tempo real · Campanha oficial 2026.",
  },
  "pre-campanha": {
    id: "pre-campanha",
    slug: "pre-campanha",
    label: "Pré-campanha",
    title: "Painel da pré-campanha",
    endpoint: "/api/meta",
    frozen: true,
    badge: "Encerrada",
    footer: "Dados de Meta Ads · Conteúdo de pré-campanha, período encerrado.",
  },
};

export function isSourceId(value: string): value is SourceId {
  return (SOURCES as readonly string[]).includes(value);
}
