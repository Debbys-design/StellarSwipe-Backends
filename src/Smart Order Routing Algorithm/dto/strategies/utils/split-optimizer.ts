export function splitOrder(
  totalAmount: number,
  venues: { id: string; score: number }[],
) {
  const totalScore = venues.reduce((sum, v) => sum + v.score, 0);

  return venues.map(v => ({
    venueId: v.id,
    allocation: (v.score / totalScore) * totalAmount,
  }));
}