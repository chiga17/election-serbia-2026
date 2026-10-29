# Shpilkin’s graph for Serbia

Votes by turnout for the parliamentary election of **25 October 2026**, drawn the way Sergey Shpilkin draws an election: every polling station goes into a column for its turnout, and the height of the column is the votes cast there. The December 2023 parliamentary election is on the same page, with the same ruler.

The 2026 figures are a **preliminary** snapshot. The Republic Electoral Commission adopts the final result.

## Run it

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:4317](http://127.0.0.1:4317).

## Share an offline copy

`public/Shpilkin-Serbia.html` is the same graphs and the same precinct data in one file. Send that file. A friend opens it in a browser. Nothing is installed, and nothing is downloaded when it opens.

Rebuild it after refreshing the data:

```bash
npm run offline
```

## Refresh the numbers

Precinct totals come from [rezultatiizbora.rs](https://rezultatiizbora.rs/rezultati-2026.html), a compilation of protocols published by the Republic Electoral Commission.

```bash
python3 scripts/build-election-data.py
```

That rewrites `src/data/elections.json`. The page shows the time of the snapshot it was built from.

## What the page measures

- **Votes by turnout.** One column per percentage point. A station at 69.5% is in the 70% column.
- **The bell.** A Gaussian centered on the top of the hill. Its width is fit to the left shoulder only, then the same curve is drawn on the right.
- **Hilltop balance.** How many more, or fewer, valid votes a list has to the right of that top than if it had kept the share it held on the way up.
- **Map.** One circle per polling station, colored by the leading list or by one list’s share of valid votes. Coordinates come from `src/data/geo.json`, geocoded from the address on the protocol. The base map is loaded from OpenFreeMap, so that section needs a connection. The offline file does not include it.

Ordinary polling stations are shown first. Stations abroad, in prisons, and for Kosovo and Metohija can be switched on. They vote under different rules and often at very high turnout.
