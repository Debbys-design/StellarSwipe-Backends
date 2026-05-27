export interface Venue {
  id: string;
  name: string;
  type: 'SDEX' | 'AMM' | 'DEX';

  getPrice(pair: string, amount: number): Promise<number>;
  getLiquidity(pair: string): Promise<number>;
  getFee(): number;
  getExecutionTime(): number; // ms
}