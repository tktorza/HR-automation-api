import { Controller, Get, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
	constructor(private readonly settingsService: SettingsService) { }

	@Get()
	async getSettings(@Request() req) {
		return this.settingsService.getSettings(req.user.tenantId);
	}

	@Patch()
	async updateSettings(@Request() req, @Body() body: any) {
		return this.settingsService.updateSettings(req.user.tenantId, body);
	}
}
