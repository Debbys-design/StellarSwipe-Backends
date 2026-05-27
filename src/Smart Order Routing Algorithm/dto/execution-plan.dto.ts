import { OptimalRouteDto } from './optimal-route.dto';

export class ExecutionPlanDto {
  routes: OptimalRouteDto[];
  totalExpectedCost: number;
  averagePrice: number;
}