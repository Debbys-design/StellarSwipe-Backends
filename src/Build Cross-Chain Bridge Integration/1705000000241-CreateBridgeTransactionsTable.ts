import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateBridgeTransactionsTable1705000000241 implements MigrationInterface {
  name = 'CreateBridgeTransactionsTable1705000000241';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum type for transfer status
    await queryRunner.query(`
      CREATE TYPE "transfer_status_enum" AS ENUM (
        'PENDING',
        'INITIATED',
        'ATTESTED',
        'REDEEMED',
        'COMPLETED',
        'FAILED',
        'REFUNDED'
      )
    `);

    // ── bridge_transactions ──────────────────────────────────────────────────
    await queryRunner.createTable(
      new Table({
        name: 'bridge_transactions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'transfer_id', type: 'varchar', isUnique: true, isNullable: false },
          { name: 'bridge_provider', type: 'varchar', isNullable: false },
          { name: 'source_chain', type: 'varchar', isNullable: false },
          { name: 'destination_chain', type: 'varchar', isNullable: false },
          { name: 'source_asset', type: 'varchar', isNullable: false },
          { name: 'destination_asset', type: 'varchar', isNullable: false },
          { name: 'amount', type: 'decimal', precision: 36, scale: 18, isNullable: false },
          { name: 'received_amount', type: 'decimal', precision: 36, scale: 18, isNullable: true },
          { name: 'sender_address', type: 'varchar', isNullable: false },
          { name: 'recipient_address', type: 'varchar', isNullable: false },
          { name: 'user_address', type: 'varchar', isNullable: true },
          { name: 'source_tx_hash', type: 'varchar', isNullable: true },
          { name: 'destination_tx_hash', type: 'varchar', isNullable: true },
          {
            name: 'status',
            type: 'transfer_status_enum',
            default: "'PENDING'",
            isNullable: false,
          },
          { name: 'fee', type: 'decimal', precision: 36, scale: 18, isNullable: true },
          { name: 'attestation_vaa', type: 'text', isNullable: true },
          { name: 'metadata', type: 'jsonb', isNullable: true },
          { name: 'error_message', type: 'text', isNullable: true },
          { name: 'estimated_completion_time', type: 'timestamptz', isNullable: true },
          { name: 'completed_at', type: 'timestamptz', isNullable: true },
          { name: 'retry_count', type: 'integer', default: 0, isNullable: false },
          { name: 'last_checked_at', type: 'timestamptz', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'now()', isNullable: false },
          { name: 'updated_at', type: 'timestamptz', default: 'now()', isNullable: false },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'bridge_transactions',
      new TableIndex({ name: 'IDX_bridge_tx_transfer_id', columnNames: ['transfer_id'] }),
    );
    await queryRunner.createIndex(
      'bridge_transactions',
      new TableIndex({ name: 'IDX_bridge_tx_user_address', columnNames: ['user_address'] }),
    );
    await queryRunner.createIndex(
      'bridge_transactions',
      new TableIndex({ name: 'IDX_bridge_tx_status', columnNames: ['status'] }),
    );
    await queryRunner.createIndex(
      'bridge_transactions',
      new TableIndex({
        name: 'IDX_bridge_tx_chains',
        columnNames: ['source_chain', 'destination_chain'],
      }),
    );
    await queryRunner.createIndex(
      'bridge_transactions',
      new TableIndex({ name: 'IDX_bridge_tx_created_at', columnNames: ['created_at'] }),
    );

    // ── wrapped_assets ───────────────────────────────────────────────────────
    await queryRunner.createTable(
      new Table({
        name: 'wrapped_assets',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'bridge_provider', type: 'varchar', isNullable: false },
          { name: 'original_chain', type: 'varchar', isNullable: false },
          { name: 'original_asset', type: 'varchar', isNullable: false },
          { name: 'original_symbol', type: 'varchar', isNullable: false },
          { name: 'original_name', type: 'varchar', isNullable: false },
          { name: 'original_decimals', type: 'integer', default: 18, isNullable: false },
          { name: 'wrapped_chain', type: 'varchar', default: "'stellar'", isNullable: false },
          { name: 'wrapped_asset_code', type: 'varchar', isNullable: false },
          { name: 'wrapped_issuer', type: 'varchar', isNullable: true },
          { name: 'wrapped_decimals', type: 'integer', default: 7, isNullable: false },
          { name: 'logo_url', type: 'varchar', isNullable: true },
          { name: 'coingecko_id', type: 'varchar', isNullable: true },
          { name: 'is_active', type: 'boolean', default: true, isNullable: false },
          { name: 'contract_address', type: 'varchar', isNullable: true },
          { name: 'metadata', type: 'jsonb', isNullable: true },
          { name: 'last_synced_at', type: 'timestamptz', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'now()', isNullable: false },
          { name: 'updated_at', type: 'timestamptz', default: 'now()', isNullable: false },
        ],
        uniques: [
          {
            name: 'UQ_wrapped_asset_provider_chain_asset',
            columnNames: ['original_chain', 'original_asset', 'bridge_provider'],
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'wrapped_assets',
      new TableIndex({
        name: 'IDX_wrapped_assets_original_asset',
        columnNames: ['original_asset'],
      }),
    );
    await queryRunner.createIndex(
      'wrapped_assets',
      new TableIndex({
        name: 'IDX_wrapped_assets_wrapped_asset_code',
        columnNames: ['wrapped_asset_code'],
      }),
    );

    // ── bridge_routes ────────────────────────────────────────────────────────
    await queryRunner.createTable(
      new Table({
        name: 'bridge_routes',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'bridge_provider', type: 'varchar', isNullable: false },
          { name: 'source_chain', type: 'varchar', isNullable: false },
          { name: 'destination_chain', type: 'varchar', isNullable: false },
          { name: 'source_asset', type: 'varchar', isNullable: false },
          { name: 'destination_asset', type: 'varchar', isNullable: false },
          {
            name: 'base_fee_percentage',
            type: 'decimal',
            precision: 10,
            scale: 4,
            isNullable: true,
          },
          {
            name: 'min_transfer_amount',
            type: 'decimal',
            precision: 36,
            scale: 18,
            isNullable: true,
          },
          {
            name: 'max_transfer_amount',
            type: 'decimal',
            precision: 36,
            scale: 18,
            isNullable: true,
          },
          {
            name: 'estimated_time_seconds',
            type: 'integer',
            default: 600,
            isNullable: false,
          },
          { name: 'is_active', type: 'boolean', default: true, isNullable: false },
          { name: 'total_transfers', type: 'integer', default: 0, isNullable: false },
          {
            name: 'total_volume',
            type: 'decimal',
            precision: 36,
            scale: 18,
            default: 0,
            isNullable: false,
          },
          { name: 'last_used_at', type: 'timestamptz', isNullable: true },
          { name: 'route_config', type: 'jsonb', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'now()', isNullable: false },
          { name: 'updated_at', type: 'timestamptz', default: 'now()', isNullable: false },
        ],
        uniques: [
          {
            name: 'UQ_bridge_route_provider_chains_assets',
            columnNames: [
              'source_chain',
              'destination_chain',
              'source_asset',
              'destination_asset',
              'bridge_provider',
            ],
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'bridge_routes',
      new TableIndex({
        name: 'IDX_bridge_routes_source_chain',
        columnNames: ['source_chain'],
      }),
    );
    await queryRunner.createIndex(
      'bridge_routes',
      new TableIndex({
        name: 'IDX_bridge_routes_destination_chain',
        columnNames: ['destination_chain'],
      }),
    );

    // Auto-update updated_at trigger
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    for (const table of ['bridge_transactions', 'wrapped_assets', 'bridge_routes']) {
      await queryRunner.query(`
        CREATE TRIGGER update_${table}_updated_at
        BEFORE UPDATE ON ${table}
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['bridge_transactions', 'wrapped_assets', 'bridge_routes']) {
      await queryRunner.query(
        `DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table}`,
      );
    }

    await queryRunner.query(`DROP FUNCTION IF EXISTS update_updated_at_column`);
    await queryRunner.dropTable('bridge_routes', true);
    await queryRunner.dropTable('wrapped_assets', true);
    await queryRunner.dropTable('bridge_transactions', true);
    await queryRunner.query(`DROP TYPE IF EXISTS "transfer_status_enum"`);
  }
}
