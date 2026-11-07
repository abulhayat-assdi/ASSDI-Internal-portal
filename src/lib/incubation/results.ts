/**
 * Team ranking for a Business Incubation program.
 *
 * Metric (decided by the program owner): sales revenue, net of customer
 * refunds. Handovers to other teams are not sales and never count.
 * Ties on revenue are broken by net profit; teams equal on both share a
 * rank (1, 1, 3 …). Amounts are integer paisa, as in the ledger.
 */
export const RESULT_METRIC = "revenue";

export interface RankInput {
  teamId: string;
  teamName: string;
  revenue: number;
  netProfit: number;
  grossProfit?: number;
}

export interface RankedTeam extends RankInput {
  rank: number;
}

export function rankTeams(rows: RankInput[]): RankedTeam[] {
  const sorted = [...rows].sort(
    (a, b) => b.revenue - a.revenue || b.netProfit - a.netProfit || a.teamName.localeCompare(b.teamName),
  );
  let rank = 0;
  return sorted.map((row, i) => {
    const prev = sorted[i - 1];
    if (!prev || prev.revenue !== row.revenue || prev.netProfit !== row.netProfit) rank = i + 1;
    return {
      teamId: row.teamId,
      teamName: row.teamName,
      revenue: row.revenue,
      netProfit: row.netProfit,
      grossProfit: row.grossProfit ?? 0,
      rank,
    };
  });
}
