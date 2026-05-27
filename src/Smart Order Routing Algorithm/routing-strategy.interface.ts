import { Venue } from './venue.interface';

export interface RoutingStrategy {
  score(
    venue: Venue,
    price: number,
    amount: number,
  ): Promise<number>;
}