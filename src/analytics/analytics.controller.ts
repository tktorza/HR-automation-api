import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
	constructor(private readonly analyticsService: AnalyticsService) { }

	@Get('dashboard')
	async getDashboardStats(@Request() req) {
		return this.analyticsService.getDashboardStats(req.user.tenantId);
	}
}
