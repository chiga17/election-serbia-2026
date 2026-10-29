import data from "../src/data/elections.json" with { type: "json" };
import { analyze, describe, filterStations } from "../src/lib/model";
import type { ElectionFile } from "../src/lib/types";

const file = data as ElectionFile;
const filters = {
  includeAbroad: false,
  includePrison: false,
  includeKosovo: false,
  minRegistered: 0,
};

for (const election of file.elections) {
  const stations = filterStations(election, filters);
  const analysis = analyze(stations, election.lists.length);
  const reading = describe(
    analysis,
    election.lists.map((list) => list.short),
  );
  console.log("\n==", election.id, "stations", stations.length);
  if (analysis.bell) {
    console.log(
      "bell",
      analysis.bell.mu.toFixed(2),
      "sigma",
      analysis.bell.sigma.toFixed(2),
      "anchor",
      analysis.bell.anchor,
      "fitEnd",
      analysis.bell.fitEnd,
    );
  }
  for (const balance of analysis.balances) {
    console.log(
      election.lists[balance.index].short,
      "share",
      (balance.leftShare * 100).toFixed(2),
      "right",
      Math.round(balance.rightBalance),
      "tail",
      Math.round(balance.leftTailBalance),
    );
  }
  if (analysis.shape) {
    console.log("shape net", Math.round(analysis.shape.net));
  }
  console.log(reading.lead);
  console.log(reading.shape, reading.spikes, reading.tail ?? "");
}
