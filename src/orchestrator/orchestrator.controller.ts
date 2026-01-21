import { Controller, Post, UseGuards } from '@nestjs/common';
import { OrchestratorService } from './orchestrator.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('orchestrator')
export class OrchestratorController {
	constructor(private readonly orchestrator: OrchestratorService) { }

	@UseGuards(JwtAuthGuard)
	@Post('run')
	async run() {
		// Fire and forget (or await if we want to wait for completion)
		this.orchestrator.runWorkflow('MANUAL_API');
		return { message: 'Workflow triggered successfully' };
	}
}
