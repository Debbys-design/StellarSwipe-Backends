export function evaluateRoute(score: number, liquidity: number): number {
  return score * Math.log(liquidity + 1);
}