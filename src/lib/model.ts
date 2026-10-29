import type {
  Analysis,
  Bell,
  Bin,
  Election,
  ListBalance,
  Station,
} from "@/lib/types";

export type Filters = {
  includeAbroad: boolean;
  includePrison: boolean;
  includeKosovo: boolean;
  minRegistered: number;
};

export function decodeStation(row: number[], index = 0): Station {
  return {
    turnoutHp: row[0],
    registered: row[1],
    cast: row[2],
    valid: row[3],
    votes: [row[4], row[5], row[6]],
    flags: row[7],
    city: row[8],
    index,
  };
}

export function filterStations(election: Election, filters: Filters): Station[] {
  const { abroad, prison, kosovo } = election.flags;
  const min = filters.minRegistered;
  const out: Station[] = [];
  for (let i = 0; i < election.stations.length; i++) {
    const row = election.stations[i];
    const flags = row[7];
    if (!filters.includeAbroad && flags & abroad) continue;
    if (!filters.includePrison && flags & prison) continue;
    if (!filters.includeKosovo && flags & kosovo) continue;
    if (row[1] < min) continue;
    out.push(decodeStation(row, i));
  }
  return out;
}

export function countByFlag(election: Election): {
  ordinary: number;
  abroad: number;
  prison: number;
  kosovo: number;
} {
  const { abroad, prison, kosovo } = election.flags;
  const counts = { ordinary: 0, abroad: 0, prison: 0, kosovo: 0 };
  for (const row of election.stations) {
    const flags = row[7];
    if (flags & abroad) counts.abroad += 1;
    else if (flags & prison) counts.prison += 1;
    else if (flags & kosovo) counts.kosovo += 1;
    else counts.ordinary += 1;
  }
  return counts;
}

function emptyBins(nLists: number): Bin[] {
  return Array.from({ length: 101 }, (_, t) => ({
    t,
    stations: 0,
    cast: 0,
    valid: 0,
    votes: Array(nLists).fill(0),
  }));
}

export function binStations(stations: Station[], nLists: number): Bin[] {
  const bins = emptyBins(nLists);
  for (const s of stations) {
    // Half up: 69.50% → 70, 69.49% → 69. Integer arithmetic so the
    // boundary does not depend on floating-point rounding.
    const t = Math.min(100, Math.max(0, Math.floor((s.turnoutHp + 50) / 100)));
    const b = bins[t];
    b.stations += 1;
    b.cast += s.cast;
    b.valid += s.valid;
    for (let i = 0; i < nLists; i++) b.votes[i] += s.votes[i] ?? 0;
  }
  return bins;
}

/**
 * Gaussian centered on the top of the turnout hill.
 * Width is fit only to the left shoulder, from half the peak height up to
 * the hilltop, then the same curve is drawn on the right.
 */
export function fitBell(bins: Bin[]): Bell | null {
  let peakBin = 30;
  for (let t = 31; t <= 95; t++) {
    if (bins[t].cast > bins[peakBin].cast) peakBin = t;
  }
  const peakCast = bins[peakBin].cast;
  if (peakCast <= 0) return null;

  const top: number[] = [];
  for (let t = peakBin - 4; t <= peakBin + 4; t++) {
    if (t >= 0 && t <= 100 && bins[t].cast >= 0.9 * peakCast) top.push(t);
  }
  if (top.length === 0) return null;
  let weight = 0;
  let moment = 0;
  for (const t of top) {
    weight += bins[t].cast;
    moment += t * bins[t].cast;
  }
  const mu = moment / weight;
  const half = 0.5 * peakCast;
  // Include the busiest column in the shoulder even if the flat top
  // is centered a point to its left.
  const fitEnd = Math.max(Math.floor(mu), peakBin);
  let anchor = fitEnd;
  for (let t = fitEnd; t > fitEnd - 25 && t >= 0; t--) {
    if (bins[t].cast >= half) anchor = t;
    else break;
  }
  const xs: number[] = [];
  for (let t = anchor; t <= fitEnd; t++) xs.push(t);
  if (xs.length < 4) return null;

  let best: { sse: number; amplitude: number; sigma: number } | null = null;
  for (let i = 40; i < 280; i++) {
    const sigma = i * 0.05;
    let num = 0;
    let den = 0;
    const es: number[] = [];
    for (const x of xs) {
      const e = Math.exp(-0.5 * ((x - mu) / sigma) ** 2);
      es.push(e);
      num += bins[x].cast * e;
      den += e * e;
    }
    if (den === 0) continue;
    const amplitude = num / den;
    let sse = 0;
    for (let k = 0; k < xs.length; k++) {
      const r = bins[xs[k]].cast - amplitude * es[k];
      sse += r * r;
    }
    if (!best || sse < best.sse) best = { sse, amplitude, sigma };
  }
  if (!best) return null;
  if (best.amplitude > peakCast * 2 || best.amplitude < peakCast * 0.45) return null;

  return {
    mu,
    sigma: best.sigma,
    amplitude: best.amplitude,
    anchor,
    fitEnd,
    rightStart: fitEnd + 1,
    peakBin,
    peakCast,
  };
}

export function bellAt(bell: Bell, t: number): number {
  const z = (t - bell.mu) / bell.sigma;
  return bell.amplitude * Math.exp(-0.5 * z * z);
}

function balancesFor(bins: Bin[], bell: Bell, nLists: number): ListBalance[] {
  let leftValid = 0;
  const leftVotes = Array(nLists).fill(0);
  for (let t = bell.anchor; t <= bell.fitEnd; t++) {
    leftValid += bins[t].valid;
    for (let i = 0; i < nLists; i++) leftVotes[i] += bins[t].votes[i];
  }
  return leftVotes.map((votes, index) => {
    const leftShare = leftValid > 0 ? votes / leftValid : 0;
    let rightBalance = 0;
    let leftTailBalance = 0;
    for (let t = bell.rightStart; t <= 100; t++) {
      rightBalance += bins[t].votes[index] - leftShare * bins[t].valid;
    }
    for (let t = 0; t < bell.anchor; t++) {
      leftTailBalance += bins[t].votes[index] - leftShare * bins[t].valid;
    }
    return { index, leftShare, rightBalance, leftTailBalance };
  });
}

export function analyze(stations: Station[], nLists: number): Analysis {
  const bins = binStations(stations, nLists);
  const totals = {
    stations: stations.length,
    registered: 0,
    cast: 0,
    valid: 0,
    votes: Array(nLists).fill(0),
  };
  for (const s of stations) {
    totals.registered += s.registered;
    totals.cast += s.cast;
    totals.valid += s.valid;
    for (let i = 0; i < nLists; i++) totals.votes[i] += s.votes[i] ?? 0;
  }

  const bell = fitBell(bins);
  const spikes: Analysis["spikes"] = [];
  for (let t = 50; t <= 90; t += 5) {
    const neigh = (bins[t - 1].cast + bins[t + 1].cast) / 2;
    if (bins[t].cast < 5000 || neigh < 5000) continue;
    spikes.push({ t, ratio: bins[t].cast / neigh, cast: bins[t].cast });
  }

  if (!bell) {
    return { bins, bell: null, balances: [], shape: null, spikes, totals };
  }

  let rightCast = 0;
  let rightBell = 0;
  for (let t = bell.rightStart; t <= 100; t++) {
    rightCast += bins[t].cast;
    rightBell += bellAt(bell, t);
  }

  return {
    bins,
    bell,
    balances: balancesFor(bins, bell, nLists),
    shape: { rightCast, rightBell, net: rightCast - rightBell },
    spikes,
    totals,
  };
}

export function othersInBin(bin: Bin): number {
  let tracked = 0;
  for (const v of bin.votes) tracked += v;
  return bin.valid - tracked;
}

export function invalidInBin(bin: Bin): number {
  return bin.cast - bin.valid;
}

function ballots(n: number): string {
  const v = Math.abs(Math.round(n)).toLocaleString("en-GB");
  return `${v} ballot${Math.abs(Math.round(n)) === 1 ? "" : "s"}`;
}

export type Reading = {
  lead: string;
  shape: string;
  spikes: string;
  tail: string | null;
};

export function describe(
  analysis: Analysis,
  names: string[],
): Reading {
  if (!analysis.bell || analysis.balances.length === 0 || analysis.totals.cast === 0) {
    return {
      lead: "This filter leaves too few polling stations to draw the hill.",
      shape: "",
      spikes: "",
      tail: null,
    };
  }

  const ranked = [...analysis.balances].sort((a, b) => b.rightBalance - a.rightBalance);
  const ahead = ranked[0];
  const behind = ranked[ranked.length - 1];

  const side = (balance: number, name: string, share: number) => {
    const pct = (share * 100).toFixed(1);
    const n = ballots(balance);
    if (balance >= 0) {
      return `${name} has ${n} more than the ${pct}% share it held on the way up`;
    }
    return `${name} has ${n} fewer than the ${pct}% share it held on the way up`;
  };

  const lead =
    `To the right of the hilltop, ${side(ahead.rightBalance, names[ahead.index], ahead.leftShare)}. ` +
    `${side(behind.rightBalance, names[behind.index], behind.leftShare)}.`;

  const net = analysis.shape?.net ?? 0;
  const rightCast = analysis.shape?.rightCast ?? 1;
  const rel = Math.abs(net) / rightCast;
  const shape =
    rel < 0.05
      ? `Past the hilltop, ballots cast stay close to the bell fitted on the way up (a difference of ${ballots(net)}).`
      : net > 0
        ? `Past the hilltop, ballots cast run ${ballots(net)} above the bell fitted on the way up.`
        : `Past the hilltop, ballots cast fall ${ballots(net)} short of the bell fitted on the way up. The slope on the right is steeper than the slope on the left.`;

  let spikes: string;
  if (analysis.spikes.length === 0) {
    spikes =
      "Round percentages from 50 to 90 do not have enough ballots on both sides to judge a comb of spikes.";
  } else {
    const highest = analysis.spikes.reduce((a, b) => (a.ratio > b.ratio ? a : b));
    spikes =
      highest.ratio >= 1.15
        ? `The tallest round column is ${highest.t}%, at ${highest.ratio.toFixed(2)} times the columns beside it.`
        : "No round column from 50% to 90% stands more than 15% above the columns beside it.";
  }

  const tailRanked = [...analysis.balances].sort(
    (a, b) => Math.abs(b.leftTailBalance) - Math.abs(a.leftTailBalance),
  );
  const tail = tailRanked[0];
  const tailText =
    tail && Math.abs(tail.leftTailBalance) >= 8000
      ? `Below the shoulder the mix is different: ${names[tail.index]} is ${tail.leftTailBalance > 0 ? "ahead" : "behind"} by ${ballots(tail.leftTailBalance)} relative to the share it holds on the shoulder.`
      : null;

  return { lead, shape, spikes, tail: tailText };
}
