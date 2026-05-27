import { RoutingStrategy } from '../interfaces/routing-strategy.interface';
import { Venue } from '../interfaces/venue.interface';

export class PriceOptimizationStrategy implements RoutingStrategy {
  async score(venue: Venue, price: number): Promise<number> {
    return 1 / price; // lower price = higher score
  }
}