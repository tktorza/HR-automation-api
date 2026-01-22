import { Controller, Get, Post, Body, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { LinkedinService } from './linkedin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IsNotEmpty, IsString } from 'class-validator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiProperty } from '@nestjs/swagger';

class Submit2faDto {
	@ApiProperty({ example: '123456' })
	@IsString()
	@IsNotEmpty()
	code: string;
}

class CreateAccountDto {
	@ApiProperty({ example: 'linkedin@example.com' })
	@IsString()
	@IsNotEmpty()
	email: string;

	@ApiProperty({ example: 'password123' })
	@IsString()
	@IsNotEmpty()
	password: string;
}

@ApiTags('linkedin')
@ApiBearerAuth()
@Controller('linkedin')
@UseGuards(JwtAuthGuard)
export class LinkedinController {
	constructor(private readonly linkedinService: LinkedinService) { }

	@ApiOperation({ summary: 'Get all linked accounts' })
	@Get()
	async getAccounts(@Request() req: any) {
		return this.linkedinService.getAccountsForTenant(req.user.tenantId);
	}

	@ApiOperation({ summary: 'Connect a new LinkedIn account' })
	@Post()
	async createAccount(@Body() dto: CreateAccountDto, @Request() req: any) {
		try {
			return await this.linkedinService.addAccount(req.user.tenantId, dto.email, dto.password);
		} catch (error) {
			if (error.message === 'DUPLICATE_ACCOUNT') {
				throw new BadRequestException('LinkedIn account with this email already exists.');
			}
			throw new BadRequestException('Failed to create LinkedIn account. Please check your inputs.');
		}
	}

	@ApiOperation({ summary: 'Submit 2FA code' })
	@Post('2fa')
	async submit2fa(@Body() dto: Submit2faDto) {
		const success = await this.linkedinService.submitTwoFactorCode(dto.code);
		if (!success) {
			throw new BadRequestException('Failed to verify 2FA code or login failed.');
		}
		return { message: '2FA verified and logged in successfully.' };
	}
}
