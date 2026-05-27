export class CostOptimizationStrategy {
  async score(venue, price): Promise<number> {
    const fee = venue.getFee();
    return 1 / (price + fee);
  }
}