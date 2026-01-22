import { Controller, Get, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';

@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
	constructor(private readonly settingsService: SettingsService) { }

	@ApiOperation({ summary: 'Get settings' })
	@Get()
	async getSettings(@Request() req) {
		return this.settingsService.getSettings(req.user.tenantId);
	}

	@ApiOperation({ summary: 'Update settings' })
	@ApiBody({ schema: { example: { settingKey: 'value' } } })
	@Patch()
	async updateSettings(@Request() req, @Body() body: any) {
		return this.settingsService.updateSettings(req.user.tenantId, body);
	}
}
