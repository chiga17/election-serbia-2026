"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GeoJSONSource, Map as MlMap } from "maplibre-gl";
import geoFile from "@/data/geo.json";
import { Button } from "@/components/ui/button";
import { formatInt } from "@/lib/format";
import type { ElectionList, GeoFile, Station } from "@/lib/types";
import "maplibre-gl/dist/maplibre-gl.css";

const geo = geoFile as GeoFile;
const STYLE = "https://tiles.openfreemap.org/styles/positron";

const FRAME = { south: 41.7, north: 46.35, west: 18.75, east: 23.1 };

type Mode = "lead" | number;

type Dot = {
  lat: number;
  lon: number;
  station: Station;
  place: string;
  rough: boolean;
};

type Hover = {
  x: number;
  y: number;
  place: string;
  rough: boolean;
  cast: number;
  registered: number;
  valid: number;
  votes: number[];
};

function inFrame(lat: number, lon: number) {
  return lat >= FRAME.south && lat <= FRAME.north && lon >= FRAME.west && lon <= FRAME.east;
}

function locate(electionId: string, stations: Station[]) {
  const set = geo[electionId];
  const dots: Dot[] = [];
  let unplaced = 0;
  let outside = 0;
  if (!set) return { dots, unplaced: stations.length, outside };
  for (const station of stations) {
    const latE = set.lat[station.index];
    const lonE = set.lon[station.index];
    if (!latE || !lonE) {
      unplaced += 1;
      continue;
    }
    const lat = latE / 1e5;
    const lon = lonE / 1e5;
    if (!inFrame(lat, lon)) {
      outside += 1;
      continue;
    }
    dots.push({
      lat,
      lon,
      station,
      place: set.place[station.index] || "",
      rough: set.rough[station.index] === 1,
    });
  }
  return { dots, unplaced, outside };
}

function mix(hex: string, t: number) {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const u = Math.min(1, Math.max(0, t));
  const br = 214;
  const bg = 208;
  const bb = 196;
  return `rgb(${Math.round(br + (r - br) * u)},${Math.round(bg + (g - bg) * u)},${Math.round(bb + (b - bb) * u)})`;
}

function fillFor(dot: Dot, lists: ElectionList[], mode: Mode) {
  const { station } = dot;
  if (station.valid <= 0) return "#b7b0a4";
  if (mode === "lead") {
    let best = 0;
    for (let i = 1; i < lists.length; i++) {
      if ((station.votes[i] ?? 0) > (station.votes[best] ?? 0)) best = i;
    }
    if ((station.votes[best] ?? 0) <= 0) return "#b7b0a4";
    return lists[best].color;
  }
  const votes = station.votes[mode] ?? 0;
  return mix(lists[mode].color, votes / station.valid);
}

function collection(dots: Dot[], lists: ElectionList[], mode: Mode) {
  return {
    type: "FeatureCollection" as const,
    features: dots.map((dot) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [dot.lon, dot.lat] },
      properties: {
        color: fillFor(dot, lists, mode),
        place: dot.place,
        rough: dot.rough ? 1 : 0,
        cast: dot.station.cast,
        registered: dot.station.registered,
        valid: dot.station.valid,
        v0: dot.station.votes[0] ?? 0,
        v1: dot.station.votes[1] ?? 0,
        v2: dot.station.votes[2] ?? 0,
      },
    })),
  };
}

export function StationMap({
  electionId,
  stations,
  lists,
}: {
  electionId: string;
  stations: Station[];
  lists: ElectionList[];
}) {
  const holder = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const listsRef = useRef(lists);
  const fittedFor = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode>("lead");
  const [hover, setHover] = useState<Hover | null>(null);

  listsRef.current = lists;

  const located = useMemo(() => locate(electionId, stations), [electionId, stations]);
  const data = useMemo(() => {
    const colorMode: Mode = mode !== "lead" && (mode < 0 || mode >= lists.length) ? "lead" : mode;
    return collection(located.dots, lists, colorMode);
  }, [located, lists, mode]);

  useEffect(() => {
    setMode("lead");
    setHover(null);
  }, [electionId]);

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    let cancelled = false;
    let map: MlMap | null = null;

    (async () => {
      const maplibregl = await import("maplibre-gl");
      maplibregl.setWorkerUrl("/maplibre-worker");
      if (cancelled || !holder.current) return;
      const created = new maplibregl.Map({
        container: holder.current,
        style: STYLE,
        center: [20.9, 44.05],
        zoom: 6.6,
        minZoom: 5.5,
        maxZoom: 16,
        scrollZoom: false,
        attributionControl: { compact: true },
      });
      map = created;
      created.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
      created.on("load", () => {
        if (cancelled) return;
        created.resize();
        created.addSource("stations", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        created.addLayer({
          id: "stations",
          type: "circle",
          source: "stations",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 2.2, 8, 3.2, 11, 5, 13, 7, 15, 9],
            "circle-color": ["get", "color"],
            "circle-opacity": 0.9,
            "circle-stroke-color": "#fffdf8",
            "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 10, 0, 12, 0.8],
          },
        });
        created.on("mousemove", "stations", (event) => {
          const feature = event.features?.[0];
          const props = feature?.properties;
          if (!props) return;
          created.getCanvas().style.cursor = "pointer";
          setHover({
            x: event.point.x,
            y: event.point.y,
            place: String(props.place || "Polling station"),
            rough: Number(props.rough) === 1,
            cast: Number(props.cast) || 0,
            registered: Number(props.registered) || 0,
            valid: Number(props.valid) || 0,
            votes: [Number(props.v0) || 0, Number(props.v1) || 0, Number(props.v2) || 0],
          });
        });
        created.on("mouseleave", "stations", () => {
          created.getCanvas().style.cursor = "";
          setHover(null);
        });
        setReady(true);
      });
      mapRef.current = created;
    })();

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      fittedFor.current = null;
      setReady(false);
      setHover(null);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.getSource("stations")) return;
    (map.getSource("stations") as GeoJSONSource).setData(data);
    if (fittedFor.current !== electionId && located.dots.length > 0) {
      const lngs = located.dots.map((dot) => dot.lon);
      const lats = located.dots.map((dot) => dot.lat);
      map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 28, maxZoom: 8, animate: false },
      );
      fittedFor.current = electionId;
    }
  }, [ready, data, electionId, located.dots]);

  const activeList = mode === "lead" ? null : lists[mode];
  const turnout =
    hover && hover.registered > 0 ? `${((hover.cast / hover.registered) * 100).toFixed(1)}%` : "—";
  const tipBelow = hover ? hover.y < 110 : false;

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:px-5">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === "lead" ? "outline" : "ghost"}
            aria-pressed={mode === "lead"}
            className={mode === "lead" ? "" : "opacity-60"}
            onClick={() => setMode("lead")}
          >
            Leading list
          </Button>
          {lists.map((list, i) => (
            <Button
              key={list.short}
              type="button"
              size="sm"
              variant={mode === i ? "outline" : "ghost"}
              aria-pressed={mode === i}
              className={mode === i ? "" : "opacity-60"}
              onClick={() => setMode(i)}
            >
              <span className="inline-block size-2.5 rounded-full" style={{ background: list.color }} />
              {list.short}
            </Button>
          ))}
        </div>
        {activeList && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="tabular-nums">0%</span>
            <span
              className="h-2 w-28 rounded-full"
              style={{ background: `linear-gradient(90deg, #d6d0c4, ${activeList.color})` }}
            />
            <span className="tabular-nums">100% of valid votes</span>
          </div>
        )}
      </div>
      <div className="relative">
        <div
          ref={holder}
          className="station-map h-[min(72vh,680px)] min-h-[420px] w-full"
          aria-label="Map of polling stations colored by list result"
        />
        {hover && (
          <div
            className="station-tip-card"
            style={{
              left: hover.x,
              top: hover.y,
              transform: tipBelow ? "translate(-50%, 12px)" : "translate(-50%, calc(-100% - 12px))",
            }}
          >
            <div className="station-tip-title">{hover.place || "Polling station"}</div>
            <div className="station-tip-meta">
              Turnout {turnout} · {formatInt(hover.cast)} ballots · {formatInt(hover.registered)} registered
            </div>
            {hover.rough && (
              <div className="station-tip-note">
                Placed at the town center. The address did not resolve to a building.
              </div>
            )}
            {listsRef.current.map((list, i) => {
              const share = hover.valid > 0 ? `${((hover.votes[i] / hover.valid) * 100).toFixed(1)}%` : "—";
              return (
                <div className="station-tip-row" key={list.short}>
                  <span>
                    <i style={{ background: list.color }} />
                    {list.short}
                  </span>
                  <b>{share}</b>
                </div>
              );
            })}
          </div>
        )}
        {ready && located.dots.length === 0 && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted-foreground">
            No polling stations in view have a point on this map.
          </p>
        )}
      </div>
      <p className="border-t border-border px-4 py-3 text-sm leading-relaxed text-muted-foreground sm:px-5">
        {formatInt(located.dots.length)} stations on the map.
        {located.unplaced > 0 ? ` ${formatInt(located.unplaced)} in view have no coordinates.` : ""}
        {located.outside > 0 ? ` ${formatInt(located.outside)} sit outside Serbia and are not drawn.` : ""}{" "}
        Scroll the page to move past the map. Use the + and − buttons, or pinch, to zoom. Hover a circle for
        the shares.
      </p>
    </div>
  );
}
