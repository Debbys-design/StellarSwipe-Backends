import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';
import { SignalsController } from './signals.controller';
import { SignalsService } from './signals.service';
import { FeedAnalyticsService } from './feed-analytics.service';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [
    CacheModule.register({
      store: redisStore,
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      ttl: 30,
    }),
    AnalyticsModule,
  ],
  controllers: [SignalsController],
  providers: [SignalsService, FeedAnalyticsService],
  exports: [SignalsService, FeedAnalyticsService],
})
export class SignalsModule {}

