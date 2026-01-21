import { Controller, Get, Post, Body, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { LinkedinService } from './linkedin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IsNotEmpty, IsString } from 'class-validator';

class Submit2faDto {
	@IsString()
	@IsNotEmpty()
	code: string;
}

class CreateAccountDto {
	@IsString()
	@IsNotEmpty()
	email: string;

	@IsString()
	@IsNotEmpty()
	password: string;
}

@Controller('linkedin')
@UseGuards(JwtAuthGuard)
export class LinkedinController {
	constructor(private readonly linkedinService: LinkedinService) { }

	@Get()
	async getAccounts(@Request() req: any) {
		return this.linkedinService.getAccountsForTenant(req.user.tenantId);
	}

	@Post()
	async createAccount(@Body() dto: CreateAccountDto, @Request() req: any) {
		return this.linkedinService.addAccount(req.user.tenantId, dto.email, dto.password);
	}

	@Post('2fa')
	async submit2fa(@Body() dto: Submit2faDto) {
		const success = await this.linkedinService.submitTwoFactorCode(dto.code);
		if (!success) {
			throw new BadRequestException('Failed to verify 2FA code or login failed.');
		}
		return { message: '2FA verified and logged in successfully.' };
	}
}
