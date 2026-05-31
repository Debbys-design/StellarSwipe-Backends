import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantQuotaService } from './tenant-quota.service';
import { QuotaReportRequestDto } from './dto/quota-report-request.dto';
import { getCurrentTenantId } from '../../tenancy/tenant-context';

@Controller('multitenancy/quota-report')
@UseGuards(JwtAuthGuard)
export class ReportController {
  constructor(private readonly tenantQuotaService: TenantQuotaService) {}

  @Get()
  async getQuotaReport(@Req() req: any, @Query() query: QuotaReportRequestDto) {
    return this.tenantQuotaService.generateReport(
      {
        id: req.user?.userId ?? req.user?.id,
        tenantId: req.user?.tenantId ?? getCurrentTenantId(),
        roles: req.user?.roles ?? req.user?.tenantRoles ?? [],
      },
      query,
    );
  }
}
