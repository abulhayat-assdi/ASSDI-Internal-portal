import { expect, it } from "vitest";
import { rankTeams } from "./results";

it("ranks by revenue, breaks ties by net profit and shares fully equal ranks", () => {
  const ranked = rankTeams([
    { teamId: "a", teamName: "A", revenue: 5000, netProfit: 100 },
    { teamId: "b", teamName: "B", revenue: 9000, netProfit: -50 },
    { teamId: "c", teamName: "C", revenue: 5000, netProfit: 300 },
    { teamId: "d", teamName: "D", revenue: 5000, netProfit: 100 },
    { teamId: "e", teamName: "E", revenue: 0, netProfit: 0 },
  ]);
  expect(ranked.map((r) => [r.teamId, r.rank])).toEqual([
    ["b", 1],
    ["c", 2],
    ["a", 3],
    ["d", 3],
    ["e", 5],
  ]);
});
