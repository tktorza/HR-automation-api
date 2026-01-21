import { Injectable, UnauthorizedException, ConflictException, InternalServerErrorException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import * as crypto from 'crypto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AuthService {
	constructor(
		private prisma: PrismaService,
		private jwtService: JwtService,
		private notificationsService: NotificationsService,
	) { }

	async validateUser(email: string, pass: string): Promise<any> {
		// Email is already sanitized (lowercase+trim) by DTO
		const user = await this.prisma.user.findUnique({
			where: { email },
		});

		if (user && (await bcrypt.compare(pass, user.passwordHash))) {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { passwordHash, ...result } = user;
			return result;
		}
		return null;
	}

	async login(user: any) {
		if (!user || !user.tenantId) {
			throw new InternalServerErrorException('Login failed: Invalid user record');
		}
		const payload = { email: user.email, sub: user.id, tenantId: user.tenantId, role: user.role };
		return {
			access_token: this.jwtService.sign(payload),
			user: user,
		};
	}

	async register(registerDto: RegisterDto) {
		const { email, password, tenantName } = registerDto;
		// Email is already sanitized here by DTO

		const existingUser = await this.prisma.user.findUnique({
			where: { email },
		});

		if (existingUser) {
			throw new ConflictException('Email already in use');
		}

		try {
			const salt = await bcrypt.genSalt(10);
			const passwordHash = await bcrypt.hash(password, salt);

			const result = await this.prisma.$transaction(async (prisma) => {
				const effectiveTenantName = tenantName || `${email.split('@')[0]}'s Workspace`;
				const slug = effectiveTenantName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.floor(Math.random() * 10000);

				const tenant = await prisma.tenant.create({
					data: {
						name: effectiveTenantName,
						slug: slug,
					},
				});

				const user = await prisma.user.create({
					data: {
						email,
						passwordHash,
						tenantId: tenant.id,
						role: 'admin',
					},
				});

				return user;
			});

			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { passwordHash: pwd, ...userWithoutPwd } = result;
			return this.login(userWithoutPwd);
		} catch (error) {
			throw new InternalServerErrorException('Registration failed: ' + error.message);
		}
	}

	async forgotPassword(email: string) {
		const user = await this.prisma.user.findUnique({
			where: { email },
		});

		if (!user) {
			return { message: 'If email exists, a reset link has been sent.' };
		}

		const resetToken = crypto.randomBytes(32).toString('hex');
		const expiresAt = new Date();
		expiresAt.setHours(expiresAt.getHours() + 1);

		await this.prisma.user.update({
			where: { id: user.id },
			data: {
				resetToken: resetToken,
				resetTokenExpiresAt: expiresAt,
			},
		});

		await this.notificationsService.sendPasswordResetEmail(user.email, resetToken);

		return { message: 'If email exists, a reset link has been sent.' };
	}

	async resetPassword(token: string, newPassword: string) {
		const user = await this.prisma.user.findFirst({
			where: {
				resetToken: token,
				resetTokenExpiresAt: { gt: new Date() },
			},
		});

		if (!user) {
			throw new BadRequestException('Invalid or expired token.');
		}

		const salt = await bcrypt.genSalt(10);
		const passwordHash = await bcrypt.hash(newPassword, salt);

		await this.prisma.user.update({
			where: { id: user.id },
			data: {
				passwordHash,
				resetToken: null,
				resetTokenExpiresAt: null,
			},
		});

		return { message: 'Password has been reset successfully.' };
	}
}
