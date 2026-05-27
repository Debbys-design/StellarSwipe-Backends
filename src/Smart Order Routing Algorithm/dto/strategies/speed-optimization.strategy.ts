export class SpeedOptimizationStrategy {
  async score(venue): Promise<number> {
    return 1 / venue.getExecutionTime();
  }
}