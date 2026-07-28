/** Normalised fact row — one per date × adset × ad × age × gender. */
export type Row = {
  /** ISO calendar day in Brazil time, `YYYY-MM-DD`. */
  date: string;
  campaign: string;
  adset: string;
  ad: string;
  age: string;
  gender: "female" | "male" | "unknown";

  spend: number;
  clicks: number;
  impressions: number;
  engagement: number;
  reactions: number;
  comments: number;
  shares: number;
  saves: number;
  profileVisits: number;

  videoViews: number; // 3-second views
  thruplays: number;
  p25: number;
  p50: number;
  p75: number;
  p100: number;
};

export type Creative = {
  ad: string;
  thumbnail: string | null;
  permalink: string | null;
};

export type CampaignPayload = {
  rows: Row[];
  creatives: Creative[];
  /** Every calendar day present in the dataset, ascending. */
  days: string[];
  campaigns: string[];
  fetchedAt: string;
  /** True when the copy is past its TTL and a refresh is running behind. */
  stale?: boolean;
  /** Why the last refresh failed, when there was one. */
  sourceError?: string | null;
  /** Seconds since the data was actually pulled from the source. */
  ageSeconds?: number;
};

/** Additive measures — safe to sum across any slice. */
export type Totals = {
  spend: number;
  clicks: number;
  impressions: number;
  engagement: number;
  reactions: number;
  comments: number;
  shares: number;
  saves: number;
  profileVisits: number;
  videoViews: number;
  thruplays: number;
  p25: number;
  p50: number;
  p75: number;
  p100: number;
};

/** Rates and costs — always recomputed from summed totals, never averaged. */
export type Metrics = Totals & {
  interactions: number;
  /** Custo por mil impressões. */
  cpm: number | null;
  /** Custo por clique. */
  cpc: number | null;
  /** Cliques ÷ impressões, em %. */
  ctr: number | null;
  /** Custo por engajamento. */
  cpe: number | null;
  /** Engajamentos ÷ impressões, em %. */
  engRate: number | null;
  /** ThruPlays ÷ impressões, em % (view-through rate). */
  vtr: number | null;
  /** Views de 3s ÷ impressões, em % (hook rate). */
  hookRate: number | null;
  /** Custo por ThruPlay. */
  cpThruplay: number | null;
  /** Custo por visita ao perfil. */
  costPerVisit: number | null;
  /** 100% assistido ÷ views de 3s, em %. */
  completionRate: number | null;
  r25: number | null;
  r50: number | null;
  r75: number | null;
  r100: number | null;
};

export type DateRange = { from: string; to: string };
