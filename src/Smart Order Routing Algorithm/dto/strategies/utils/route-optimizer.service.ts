import { Injectable } from '@nestjs/common';
import { Venue } from './interfaces/venue.interface';
import { evaluateRoute } from './utils/route-evaluator';
import { splitOrder } from './utils/split-optimizer';

@Injectable()
export class RouteOptimizerService {
  async optimize(
    venues: Venue[],
    pair: string,
    amount: number,
    strategy,
  ) {
    const scoredVenues = [];

    for (const venue of venues) {
      const price = await venue.getPrice(pair, amount);
      const liquidity = await venue.getLiquidity(pair);

      const baseScore = await strategy.score(venue, price, amount);
      const finalScore = evaluateRoute(baseScore, liquidity);

      scoredVenues.push({
        id: venue.id,
        score: finalScore,
        price,
      });
    }

    const splits = splitOrder(amount, scoredVenues);

    return splits.map(split => {
      const venue = scoredVenues.find(v => v.id === split.venueId);

      return {
        venueId: split.venueId,
        allocation: split.allocation,
        expectedPrice: venue.price,
      };
    });
  }
}