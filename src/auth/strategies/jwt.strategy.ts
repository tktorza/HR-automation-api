import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
	constructor(private prisma: PrismaService) {
		const secret = process.env.JWT_SECRET;
		if (!secret) {
			throw new Error('JWT_SECRET environment variable is not defined');
		}
		super({
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			ignoreExpiration: false,
			secretOrKey: secret,
		});
	}

	async validate(payload: any) {
		// Check if user still exists/is active
		const user = await this.prisma.user.findUnique({
			where: { id: payload.sub },
		});

		if (!user) {
			throw new UnauthorizedException();
		}

		// Return payload with tenantId attached to request.user
		return {
			userId: payload.sub,
			email: payload.email,
			tenantId: payload.tenantId,
			role: payload.role
		};
	}
}
