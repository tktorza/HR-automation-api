import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
	constructor(private readonly analyticsService: AnalyticsService) { }

	@ApiOperation({ summary: 'Get dashboard statistics' })
	@ApiResponse({ status: 200, description: 'Return stats for dashboard.' })
	@Get('dashboard')
	async getDashboardStats(@Request() req) {
		return this.analyticsService.getDashboardStats(req.user.tenantId);
	}
}
