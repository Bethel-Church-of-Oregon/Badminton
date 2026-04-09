const K = 32;

function expected(myAvg: number, oppAvg: number) {
  return 1 / (1 + Math.pow(10, (oppAvg - myAvg) / 400));
}

/**
 * Calculates new ELO ratings for winners and losers.
 * Supports both singles (1 player per team) and doubles (2 players).
 */
export function applyElo(
  winnerRatings: number[],
  loserRatings: number[],
): { newWinnerRatings: number[]; newLoserRatings: number[] } {
  const winAvg = winnerRatings.reduce((a, b) => a + b, 0) / winnerRatings.length;
  const loseAvg = loserRatings.reduce((a, b) => a + b, 0) / loserRatings.length;

  const expWin = expected(winAvg, loseAvg);
  const expLose = 1 - expWin;

  return {
    newWinnerRatings: winnerRatings.map((r) => Math.round(r + K * (1 - expWin))),
    newLoserRatings: loserRatings.map((r) => Math.round(r + K * (0 - expLose))),
  };
}
