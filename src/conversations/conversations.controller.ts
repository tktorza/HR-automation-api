import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('conversations')
@ApiBearerAuth()
@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
	constructor(private readonly conversationsService: ConversationsService) { }

	@ApiOperation({ summary: 'Get all conversations' })
	@Get()
	async findAll(@Request() req: any) {
		return this.conversationsService.findAll(req.user.tenantId);
	}

	@ApiOperation({ summary: 'Get conversation details' })
	@Get(':id')
	async findOne(@Param('id') id: string, @Request() req: any) {
		return this.conversationsService.findOne(id, req.user.tenantId);
	}
}
