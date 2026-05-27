import { Injectable } from '@nestjs/common';
import { RouteOptimizerService } from './route-optimizer.service';
import { RoutingRequestDto } from './dto/routing-request.dto';
import { ExecutionPlanDto } from './dto/execution-plan.dto';

import { PriceOptimizationStrategy } from './strategies/price-optimization.strategy';
import { SpeedOptimizationStrategy } from './strategies/speed-optimization.strategy';
import { CostOptimizationStrategy } from './strategies/cost-optimization.strategy';

@Injectable()
export class SmartRouterService {
  constructor(private readonly optimizer: RouteOptimizerService) {}

  private getStrategy(type: string) {
    switch (type) {
      case 'price':
        return new PriceOptimizationStrategy();
      case 'speed':
        return new SpeedOptimizationStrategy();
      case 'cost':
        return new CostOptimizationStrategy();
      default:
        return new PriceOptimizationStrategy();
    }
  }

  async routeOrder(
    request: RoutingRequestDto,
    venues: any[],
  ): Promise<ExecutionPlanDto> {
    const strategy = this.getStrategy(request.strategy);

    const routes = await this.optimizer.optimize(
      venues,
      request.pair,
      request.amount,
      strategy,
    );

    const totalCost = routes.reduce(
      (sum, r) => sum + r.allocation * r.expectedPrice,
      0,
    );

    return {
      routes,
      totalExpectedCost: totalCost,
      averagePrice: totalCost / request.amount,
    };
  }
}