import { Controller, Post, UseGuards } from '@nestjs/common';
import { OrchestratorService } from './orchestrator.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('orchestrator')
@Controller('orchestrator')
export class OrchestratorController {
	constructor(private readonly orchestrator: OrchestratorService) { }

	@ApiBearerAuth()
	@UseGuards(JwtAuthGuard)
	@ApiOperation({ summary: 'Manually trigger workflow' })
	@Post('run')
	async run() {
		// Fire and forget (or await if we want to wait for completion)
		this.orchestrator.runWorkflow('MANUAL_API');
		return { message: 'Workflow triggered successfully' };
	}
}
