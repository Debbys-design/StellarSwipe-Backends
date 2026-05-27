import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRoutingDecisionsTable1705000000215
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE routing_decision (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        pair varchar NOT NULL,
        amount float NOT NULL,
        routes json NOT NULL,
        total_cost float NOT NULL,
        created_at timestamp DEFAULT now()
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE routing_decision`);
  }
}