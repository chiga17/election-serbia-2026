export type ListRole = "challenger" | "incumbent" | "third";

export type ElectionList = {
  n: number;
  role: ListRole;
  short: string;
  full: string;
  color: string;
};

export type OfficialTotals = {
  stations: number;
  registered: number;
  cast: number;
  valid: number;
  turnoutPct: number;
};

export type Election = {
  id: string;
  title: string;
  dateLabel: string;
  isoDate: string;
  preliminary: boolean;
  note: string;
  generated: string | null;
  processed: number;
  totalStations: number;
  officialTotals: OfficialTotals;
  sourceUrl: string;
  sourceName: string;
  sourcePage: string;
  lists: ElectionList[];
  cities: string[];
  flags: { abroad: number; prison: number; kosovo: number };
  /** [turnout hundredths, registered, cast, valid, vote0, vote1, vote2, flags, city] */
  stations: number[][];
  skipped: number;
};

export type ElectionFile = { elections: Election[] };

export type Station = {
  turnoutHp: number;
  registered: number;
  cast: number;
  valid: number;
  votes: number[];
  flags: number;
  city: number;
  /** Row in the packed precinct file, used to look up coordinates. */
  index: number;
};

export type GeoSet = {
  /** Latitude times 1e5. 0 means the station has no point. */
  lat: number[];
  /** Longitude times 1e5. 0 means the station has no point. */
  lon: number[];
  place: string[];
  /** 1 when the point is a town center rather than the polling place. */
  rough: number[];
};

export type GeoFile = Record<string, GeoSet>;

export type Bin = {
  t: number;
  stations: number;
  cast: number;
  valid: number;
  votes: number[];
};

export type Bell = {
  mu: number;
  sigma: number;
  amplitude: number;
  anchor: number;
  fitEnd: number;
  rightStart: number;
  peakBin: number;
  peakCast: number;
};

export type ListBalance = {
  index: number;
  leftShare: number;
  rightBalance: number;
  leftTailBalance: number;
};

export type Analysis = {
  bins: Bin[];
  bell: Bell | null;
  balances: ListBalance[];
  shape: { rightCast: number; rightBell: number; net: number } | null;
  spikes: { t: number; ratio: number; cast: number }[];
  totals: {
    stations: number;
    registered: number;
    cast: number;
    valid: number;
    votes: number[];
  };
};
