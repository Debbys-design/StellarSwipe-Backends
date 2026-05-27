export class RoutingRequestDto {
  pair: string;
  amount: number;
  strategy: 'price' | 'speed' | 'cost';
}