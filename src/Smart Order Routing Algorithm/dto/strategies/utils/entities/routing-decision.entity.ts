import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity()
export class RoutingDecision {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  pair: string;

  @Column('float')
  amount: number;

  @Column('json')
  routes: any;

  @Column('float')
  totalCost: number;

  @CreateDateColumn()
  createdAt: Date;
}