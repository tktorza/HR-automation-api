import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
	canActivate(context: ExecutionContext): boolean {
		const request = context.switchToHttp().getRequest();
		const user = request.user;

		if (!user || !user.tenantId) {
			throw new ForbiddenException('Tenant context is missing');
		}

		// Assuming we want to ensure any :tenantId param matches the user's tenantId
		const params = request.params;
		if (params.tenantId && params.tenantId !== user.tenantId) {
			throw new ForbiddenException('Access to this tenant is denied');
		}

		return true;
	}
}
