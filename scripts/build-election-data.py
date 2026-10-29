#!/usr/bin/env python3
"""Build the compact precinct file the Shpilkin explorer reads.

Downloads the precinct compilations published by rezultatiizbora.rs
(parsed from Republička izborna komisija protocols) and writes a packed
JSON file plus src/data/geo.json, the coordinates and place names for the map.
Re-run to refresh the snapshot.
"""

from __future__ import annotations

import json
import re
import urllib.request
from pathlib import Path

OUT = Path("/workspace/src/data/elections.json")
GEO = Path("/workspace/src/data/geo.json")

KM = {
    "Витина",
    "Вучитрн",
    "Гора",
    "Гњилане",
    "Звечан",
    "Зубин Поток",
    "Косово Поље",
    "Косовска Каменица",
    "Косовска Митровица",
    "Лепосавић",
    "Липљан",
    "Ново Брдо",
    "Обилић",
    "Ораховац",
    "Пећ",
    "Призрен",
    "Приштина",
    "Србица",
    "Урошевац",
    "Штрпце",
    "Ђаковица",
    "Качаник",
    "Штимље",
    "Клокот",
    "Ранилуг",
    "Малишево",
    "Дечани",
    "Исток",
    "Клина",
    "Сува Река",
    "Глоговац",
    "Јуник",
    "Мамуша",
    "Партеш",
    "Елез Хан",
}

# flag bits
ABROAD = 1
PRISON = 2
KOSOVO = 4

ELECTIONS = [
    {
        "id": "parl2026",
        "url": "https://rezultatiizbora.rs/data-2026.json",
        "cache": Path("/tmp/election/data-2026.json"),
        "title": "Parliamentary election",
        "dateLabel": "25 October 2026",
        "isoDate": "2026-10-25",
        "preliminary": True,
        "lists": [
            {
                "n": 3,
                "role": "challenger",
                "short": "Studentska lista",
                "full": "Studentska lista — Studenti pobeđuju",
                "color": "#c44536",
            },
            {
                "n": 1,
                "role": "incumbent",
                "short": "Ujedinjena Srbija",
                "full": "Aleksandar Vučić — Ujedinjena Srbija",
                "color": "#1f4e79",
            },
            {
                "n": 2,
                "role": "third",
                "short": "Faktor stabilnosti",
                "full": "Ivica Dačić — Faktor stabilnosti (SPS, Jedinstvena Srbija, SDPS, Zeleni Srbije)",
                "color": "#b7791f",
            },
        ],
    },
    {
        "id": "parl2023",
        "url": "https://rezultatiizbora.rs/data.json",
        "cache": Path("/tmp/election/data.json"),
        "title": "Parliamentary election",
        "dateLabel": "17 December 2023",
        "isoDate": "2023-12-17",
        "preliminary": False,
        "lists": [
            {
                "n": 7,
                "role": "challenger",
                "short": "Srbija protiv nasilja",
                "full": "Srbija protiv nasilja",
                "color": "#c44536",
            },
            {
                "n": 1,
                "role": "incumbent",
                "short": "Srbija ne sme da stane",
                "full": "Aleksandar Vučić — Srbija ne sme da stane",
                "color": "#1f4e79",
            },
            {
                "n": 2,
                "role": "third",
                "short": "Dačić — Premijer Srbije",
                "full": "Ivica Dačić — Premijer Srbije",
                "color": "#b7791f",
            },
        ],
    },
]


def fetch(url: str, cache: Path) -> dict:
    # Prefer a fresh download. Fall back to the cache if the network fails.
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "shpilkin-graph/1.0"})
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.load(resp)
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_text(json.dumps(data), encoding="utf-8")
        return data
    except Exception as exc:  # noqa: BLE001
        print(f"download failed for {url}: {exc}; using cache {cache}")
        return json.loads(cache.read_text(encoding="utf-8"))


def pack(spec: dict, raw: dict) -> dict:
    meta = raw["meta"]
    election_meta = next(e for e in meta["elections"] if e["id"] == spec["id"])
    list_ns = [lst["n"] for lst in spec["lists"]]
    cities: list[str] = []
    city_index: dict[str, int] = {}
    stations: list[list[int]] = []
    places: list[str] = []
    lats: list[int] = []
    lons: list[int] = []
    rough: list[int] = []
    skipped = 0

    for s in raw["stations"]:
        if s.get("election") not in (None, spec["id"]):
            continue
        registered = int(s["registered"] or 0)
        cast = int(s["turnout"] or 0)
        valid = int(s["valid"] or 0)
        if registered <= 0 or cast < 0 or valid < 0 or cast > registered or valid > cast:
            skipped += 1
            continue
        city = s["city"]
        if city not in city_index:
            city_index[city] = len(cities)
            cities.append(city)
        flags = 0
        if city == "Иностранство":
            flags |= ABROAD
        elif city == "Заводи за извршење кривичних санкција":
            flags |= PRISON
        elif city in KM:
            flags |= KOSOVO
        votes_by_n = {r["n"]: int(r["votes"]) for r in s["results"]}
        tracked = [votes_by_n.get(n, 0) for n in list_ns]
        if sum(tracked) > valid:
            skipped += 1
            continue
        # hundredths of a percent, so 69.45% is 6945
        turnout_hp = int(round(cast / registered * 10000))
        stations.append(
            [turnout_hp, registered, cast, valid, *tracked, flags, city_index[city]]
        )
        lat_e5, lon_e5 = coordinates(s)
        lats.append(lat_e5)
        lons.append(lon_e5)
        places.append(place_label(s))
        rough.append(1 if s.get("loc_source") == "center" else 0)

    by = meta.get("by_election", {}).get(spec["id"], {})
    totals = by.get("totals", {})
    return {
        "id": spec["id"],
        "title": spec["title"],
        "dateLabel": spec["dateLabel"],
        "isoDate": spec["isoDate"],
        "preliminary": spec["preliminary"],
        "note": election_meta.get("note", ""),
        "generated": meta.get("generated"),
        "processed": meta.get("processed", totals.get("stations")),
        "totalStations": meta.get("total_stations", totals.get("stations")),
        "officialTotals": {
            "stations": totals.get("stations"),
            "registered": totals.get("registered"),
            "cast": totals.get("turnout"),
            "valid": totals.get("valid"),
            "turnoutPct": totals.get("turnout_pct"),
        },
        "sourceUrl": spec["url"],
        "sourceName": "rezultatiizbora.rs",
        "sourcePage": "https://rezultatiizbora.rs/rezultati-2026.html"
        if spec["id"] == "parl2026"
        else "https://rezultatiizbora.rs/",
        "lists": spec["lists"],
        "cities": cities,
        "flags": {"abroad": ABROAD, "prison": PRISON, "kosovo": KOSOVO},
        # [turnout hundredths, registered, cast, valid, vote0, vote1, vote2, flags, city]
        "stations": stations,
        "skipped": skipped,
        "_geo": {"lat": lats, "lon": lons, "place": places, "rough": rough},
    }


def coordinates(station: dict) -> tuple[int, int]:
    lat = station.get("lat")
    lon = station.get("lon")
    if lat is None or lon is None or lat == "" or lon == "":
        return 0, 0
    return int(round(float(lat) * 100_000)), int(round(float(lon) * 100_000))


def place_label(station: dict) -> str:
    raw_place = (station.get("place") or station.get("name") or "").strip()
    raw_place = re.sub(r"^\d+\s*[-–—]\s*", "", raw_place)
    raw_place = re.sub(r"\s+", " ", raw_place)
    muni = (station.get("muni") or "").strip()
    city = (station.get("city") or "").strip()
    where = muni or city
    if raw_place and where and where.casefold() not in raw_place.casefold():
        return f"{raw_place} · {where}"
    return raw_place or where or city


def main() -> None:
    elections = []
    geo: dict[str, dict] = {}
    for spec in ELECTIONS:
        print("loading", spec["id"])
        raw = fetch(spec["url"], spec["cache"])
        packed = pack(spec, raw)
        located = sum(1 for lat in packed["_geo"]["lat"] if lat)
        centers = sum(packed["_geo"]["rough"])
        print(
            f"  stations {len(packed['stations'])} skipped {packed['skipped']} "
            f"on the map {located} town-center points {centers} "
            f"generated {packed['generated']} processed {packed['processed']}/{packed['totalStations']}"
        )
        geo[packed["id"]] = packed.pop("_geo")
        if len(geo[packed["id"]]["lat"]) != len(packed["stations"]):
            raise SystemExit(f"{packed['id']}: coordinate rows do not match stations")
        elections.append(packed)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps({"elections": elections}, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    GEO.write_text(
        json.dumps(geo, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print("wrote", OUT, "bytes", OUT.stat().st_size)
    print("wrote", GEO, "bytes", GEO.stat().st_size)


if __name__ == "__main__":
    main()
