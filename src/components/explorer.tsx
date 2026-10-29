"use client";

import { useMemo, useState } from "react";
import raw from "@/data/elections.json";
import { ScatterChart } from "@/components/scatter-chart";
import { ShareChart } from "@/components/share-chart";
import { StationMap } from "@/components/station-map";
import { TurnoutChart, type SeriesVisibility } from "@/components/turnout-chart";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatBelgrade, formatInt, formatPct, formatSigned } from "@/lib/format";
import {
  analyze,
  countByFlag,
  describe,
  filterStations,
  type Filters,
} from "@/lib/model";
import type { Election, ElectionFile } from "@/lib/types";

const file = raw as ElectionFile;

const DEFAULT_VISIBILITY: SeriesVisibility = {
  lists: [true, true, true],
  others: false,
  invalid: false,
  total: true,
  bell: true,
};

export function Explorer() {
  const [electionId, setElectionId] = useState(file.elections[0].id);
  const [filters, setFilters] = useState<Filters>({
    includeAbroad: false,
    includePrison: false,
    includeKosovo: false,
    minRegistered: 0,
  });
  const [showLow, setShowLow] = useState(false);
  const [visibility, setVisibility] = useState<SeriesVisibility>(DEFAULT_VISIBILITY);

  const election = file.elections.find((e) => e.id === electionId) ?? file.elections[0];
  const counts = useMemo(() => countByFlag(election), [election]);
  const stations = useMemo(
    () => filterStations(election, filters),
    [election, filters],
  );
  const analysis = useMemo(
    () => analyze(stations, election.lists.length),
    [stations, election.lists.length],
  );
  const reading = useMemo(
    () => describe(analysis, election.lists.map((l) => l.short)),
    [analysis, election.lists],
  );

  const xMin = showLow ? 0 : 30;
  const turnout =
    analysis.totals.registered > 0
      ? analysis.totals.cast / analysis.totals.registered
      : 0;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-sm font-medium tracking-[0.14em] text-muted-foreground uppercase">
              Serbia · parliamentary elections
            </p>
            <h1 className="font-heading mt-2 text-4xl leading-tight text-foreground sm:text-5xl">
              <span className="italic">Shpilkin’s</span> graph
            </h1>
            <p className="mt-3 max-w-2xl text-lg leading-relaxed text-foreground/80">
              Polling stations grouped by turnout. The height of each curve is
              votes, so a large station counts more than a small one. Sergey
              Shpilkin drew elections this way to see whether one list’s votes
              keep climbing after the others have crested.
            </p>
          </div>
          <Tabs
            value={electionId}
            onValueChange={(value) => setElectionId(String(value))}
          >
            <TabsList>
              {file.elections.map((item) => (
                <TabsTrigger key={item.id} value={item.id}>
                  {item.dateLabel.replace(/^\d+\s/, "")}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <SnapshotLine election={election} />
        <p className="text-sm text-muted-foreground">
          <a
            className="underline decoration-border underline-offset-2 hover:decoration-foreground"
            href="/Shpilkin-Serbia.html"
            download="Shpilkin-Serbia.html"
          >
            Download one file to share
          </a>
          . It opens in a browser with no connection and no install.
        </p>
        <p className="max-w-3xl text-base leading-relaxed">{reading.lead}</p>
        {reading.shape && (
          <p className="max-w-3xl text-base leading-relaxed text-foreground/80">
            {reading.shape} {reading.spikes}
            {reading.tail ? ` ${reading.tail}` : ""}
          </p>
        )}
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Stations in view" value={formatInt(analysis.totals.stations)} />
        <Stat label="Ballots cast" value={formatInt(analysis.totals.cast)} />
        <Stat label="Turnout" value={formatPct(turnout)} />
        <Stat
          label="Valid votes"
          value={formatInt(analysis.totals.valid)}
          hint={
            analysis.totals.cast > 0
              ? formatPct(analysis.totals.valid / analysis.totals.cast) + " of ballots"
              : undefined
          }
        />
      </section>

      <section className="rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-heading text-2xl">Votes by turnout</h2>
            <p className="text-sm text-muted-foreground">
              One column is one percentage point. Hover a column for the count.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {election.lists.map((list, i) => (
              <LegendButton
                key={list.short}
                color={list.color}
                label={list.short}
                pressed={visibility.lists[i]}
                onClick={() =>
                  setVisibility((v) => {
                    const lists = [...v.lists];
                    lists[i] = !lists[i];
                    return { ...v, lists };
                  })
                }
              />
            ))}
            <LegendButton
              color="#6f6a62"
              label="Other lists"
              pressed={visibility.others}
              onClick={() => setVisibility((v) => ({ ...v, others: !v.others }))}
            />
            <LegendButton
              color="#c4bbae"
              label="Invalid"
              pressed={visibility.invalid}
              onClick={() => setVisibility((v) => ({ ...v, invalid: !v.invalid }))}
            />
            <LegendButton
              color="#1f1a14"
              label="Ballots cast"
              pressed={visibility.total}
              onClick={() => setVisibility((v) => ({ ...v, total: !v.total }))}
            />
            <LegendButton
              color="#1f1a14"
              label="Bell"
              dashed
              pressed={visibility.bell}
              onClick={() => setVisibility((v) => ({ ...v, bell: !v.bell }))}
            />
          </div>
        </div>
        <div className="overflow-x-auto px-2 py-3 sm:px-4">
          {analysis.totals.stations === 0 ? (
            <Empty />
          ) : (
            <TurnoutChart
              analysis={analysis}
              lists={election.lists}
              visibility={visibility}
              xMin={xMin}
            />
          )}
        </div>
        {analysis.bell && (
          <p className="border-t border-border px-4 py-3 text-sm leading-relaxed text-muted-foreground sm:px-5">
            The shaded band is the left shoulder the bell is matched to, from{" "}
            {analysis.bell.anchor}% to {analysis.bell.fitEnd}% turnout. The
            dashed curve is that bell, centered at {analysis.bell.mu.toFixed(1)}%
            with a width of {analysis.bell.sigma.toFixed(1)} points, continued
            onto the right.
          </p>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-4 sm:px-5">
            <h2 className="font-heading text-2xl">Share of valid votes</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              The line is drawn where a column has at least 1,500 ballots.
              Thinner columns are dots. Dashed horizontals are each list’s
              share on the way up the hill.
            </p>
          </div>
          <div className="overflow-x-auto px-2 py-3 sm:px-4">
            {analysis.totals.stations === 0 ? (
              <Empty />
            ) : (
              <ShareChart
                analysis={analysis}
                lists={election.lists}
                listsOn={visibility.lists}
                xMin={xMin}
              />
            )}
          </div>
        </div>
        <BalanceCard election={election} analysis={analysis} />
      </section>

      <section className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-4 sm:px-5">
          <h2 className="font-heading text-2xl">Every polling station</h2>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            One dot per station, drawn once for each list that is switched on.
            Across is turnout. Up is that list’s share of valid votes. Larger
            stations are drawn slightly larger. A cloud stretched toward the
            top-right corner is the picture people look for: high turnout and
            a very high share for one list, together.
          </p>
        </div>
        <div className="px-2 py-3 sm:px-4">
          {analysis.totals.stations === 0 ? (
            <Empty />
          ) : (
            <ScatterChart
              stations={stations}
              cities={election.cities}
              lists={election.lists}
              listsOn={visibility.lists}
              xMin={xMin}
            />
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-4 sm:px-5">
          <h2 className="font-heading text-2xl">Where the stations are</h2>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            One circle per polling station. The color is whichever of the three
            lists took the most valid votes there. Pick a list to paint every
            station by that list’s share instead. Points are geocoded from the
            address on the protocol. When that failed, the circle sits on the
            town center, and the label says so. For 2026, most points are the
            2023 location of the same place. Stations abroad are not drawn.
            The switches below apply here too.
          </p>
        </div>
        {analysis.totals.stations === 0 ? (
          <Empty />
        ) : (
          <StationMap
            electionId={election.id}
            stations={stations}
            lists={election.lists}
          />
        )}
      </section>

      <section className="rounded-xl border border-border bg-card px-4 py-4 sm:px-5">
        <h2 className="font-heading text-2xl">What is included</h2>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Ordinary polling stations are on by default. Abroad, prisons, and
          stations for Kosovo and Metohija vote under different rules and often
          at very high turnout, so they start off the graph. This snapshot has{" "}
          {formatInt(counts.ordinary)} ordinary stations, {formatInt(counts.abroad)}{" "}
          abroad, {formatInt(counts.prison)} in prisons, and {formatInt(counts.kosovo)}{" "}
          for Kosovo and Metohija.
        </p>
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <FlagSwitch
              label="Abroad"
              checked={filters.includeAbroad}
              onCheckedChange={(includeAbroad) => setFilters((f) => ({ ...f, includeAbroad }))}
            />
            <FlagSwitch
              label="Prisons"
              checked={filters.includePrison}
              onCheckedChange={(includePrison) => setFilters((f) => ({ ...f, includePrison }))}
            />
            <FlagSwitch
              label="Kosovo and Metohija"
              checked={filters.includeKosovo}
              onCheckedChange={(includeKosovo) => setFilters((f) => ({ ...f, includeKosovo }))}
            />
            <FlagSwitch
              label="Turnout under 30%"
              checked={showLow}
              onCheckedChange={setShowLow}
            />
          </div>
          <div className="max-w-md">
            <div className="mb-2 flex items-baseline justify-between text-sm">
              <span>Smallest station kept</span>
              <span className="tabular-nums text-muted-foreground">
                {filters.minRegistered === 0
                  ? "Any size"
                  : `${formatInt(filters.minRegistered)} registered voters`}
              </span>
            </div>
            <Slider
              min={0}
              max={400}
              step={10}
              value={[filters.minRegistered]}
              onValueChange={(value) => {
                const next = Array.isArray(value) ? value[0] : value;
                setFilters((f) => ({ ...f, minRegistered: next }));
              }}
            />
          </div>
        </div>
      </section>

      <section className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
        <h2 className="font-heading text-2xl text-foreground">How the numbers are made</h2>
        <div className="mt-3 space-y-3">
          <p>
            Turnout is ballots cast divided by registered voters. A station at
            69.5% sits in the 70% column; one at 69.4% sits in 69%. The main
            graph sums votes inside each column. That is the display Shpilkin
            published for Russian elections: absolute votes against turnout,
            list by list.
          </p>
          <p>
            The bell is a Gaussian. Its center is the ballot-weighted middle of
            the busiest columns, the flat top of the hill. Its width is chosen
            so the curve matches the left side only, from half the height of
            the peak up to that top. The same curve is then drawn on the right.
            It is a reference for the shape of turnout.
          </p>
          <p>
            The hilltop balance holds each list to the share of valid votes it
            had on that left shoulder, and adds up the difference in every
            column to the right. A positive balance means the list did better
            where turnout was higher. A list can do that because its voters
            live in places that turn out more heavily. The balance says where
            the votes sit.
          </p>
          <p>
            {election.preliminary
              ? `Figures for ${election.dateLabel} are preliminary protocols, ${formatInt(election.processed)} of ${formatInt(election.totalStations)} stations. The Republic Electoral Commission adopts the final result.`
              : `Figures for ${election.dateLabel} cover the ${formatInt(election.processed)} stations in the published precinct count.`}{" "}
            The compilation is from{" "}
            <a className="underline decoration-border underline-offset-2 hover:decoration-foreground" href={election.sourcePage}>
              {election.sourceName}
            </a>
            , parsed from commission protocols. Refresh the file with{" "}
            <code className="text-foreground">python3 scripts/build-election-data.py</code>.
          </p>
        </div>
      </section>
    </div>
  );
}

function SnapshotLine({ election }: { election: Election }) {
  const when = election.generated ? formatBelgrade(election.generated) : null;
  return (
    <p className="text-sm text-muted-foreground">
      {election.dateLabel}
      {election.preliminary ? " · preliminary" : " · published precinct count"}
      {" · "}
      {formatInt(election.officialTotals.cast)} ballots in the snapshot
      {when ? ` · compiled ${when}` : ""}
      {" · "}
      <a
        className="underline decoration-border underline-offset-2 hover:decoration-foreground"
        href={election.sourcePage}
      >
        source
      </a>
    </p>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 font-heading text-3xl tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-sm text-muted-foreground tabular-nums">{hint}</div>}
    </div>
  );
}

function LegendButton({
  color,
  label,
  pressed,
  onClick,
  dashed,
}: {
  color: string;
  label: string;
  pressed: boolean;
  onClick: () => void;
  dashed?: boolean;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={pressed ? "outline" : "ghost"}
      aria-pressed={pressed}
      onClick={onClick}
      className={pressed ? "" : "opacity-55"}
    >
      <span
        className="inline-block h-0.5 w-4"
        style={{
          background: dashed ? "transparent" : color,
          borderTop: dashed ? `2px dashed ${color}` : undefined,
        }}
      />
      {label}
    </Button>
  );
}

function FlagSwitch({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
      {label}
    </label>
  );
}

function BalanceCard({
  election,
  analysis,
}: {
  election: Election;
  analysis: ReturnType<typeof analyze>;
}) {
  return (
    <aside className="rounded-xl border border-border bg-card px-4 py-4 sm:px-5">
      <div className="flex items-center gap-2">
        <h2 className="font-heading text-2xl">Hilltop balance</h2>
        <Tooltip>
          <TooltipTrigger className="text-sm text-muted-foreground underline decoration-dotted underline-offset-4">
            definition
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-left leading-relaxed">
            Votes to the right of the hilltop, minus the votes that list would
            have if it had kept the share it held on the shaded shoulder.
          </TooltipContent>
        </Tooltip>
      </div>
      {analysis.balances.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Not enough of a hill under this filter to fit a bell.
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {analysis.balances.map((balance) => {
            const list = election.lists[balance.index];
            return (
              <li key={list.short}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm" style={{ color: list.color }}>
                    {list.short}
                  </span>
                  <span className="font-heading text-2xl tabular-nums">
                    {formatSigned(balance.rightBalance)}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
                  {formatPct(balance.leftShare)} of valid votes on the way up
                </p>
              </li>
            );
          })}
        </ul>
      )}
      {analysis.shape && analysis.bell && (
        <dl className="mt-5 space-y-1 border-t border-border pt-4 text-sm">
          <div className="flex justify-between gap-3 tabular-nums">
            <dt className="text-muted-foreground">Ballots right of the hill</dt>
            <dd>{formatInt(analysis.shape.rightCast)}</dd>
          </div>
          <div className="flex justify-between gap-3 tabular-nums">
            <dt className="text-muted-foreground">Bell on that side</dt>
            <dd>{formatInt(analysis.shape.rightBell)}</dd>
          </div>
          <div className="flex justify-between gap-3 tabular-nums">
            <dt className="text-muted-foreground">Difference</dt>
            <dd>{formatSigned(analysis.shape.net)}</dd>
          </div>
        </dl>
      )}
    </aside>
  );
}

function Empty() {
  return (
    <p className="px-4 py-16 text-center text-sm text-muted-foreground">
      No polling stations match these filters.
    </p>
  );
}
