import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../auth/auth.module';
import { TenantUsage } from './entities/tenant-usage.entity';
import { TenantQuotaService } from './tenant-quota.service';
import { ReportController } from './report.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TenantUsage]), AuthModule],
  controllers: [ReportController],
  providers: [TenantQuotaService],
  exports: [TenantQuotaService],
})
export class QuotaReportingModule {}
