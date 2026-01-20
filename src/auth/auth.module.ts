import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './strategies/jwt.strategy';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
	imports: [
		PassportModule,
		NotificationsModule,
		JwtModule.registerAsync({
			useFactory: () => {
				const secret = process.env.JWT_SECRET;
				if (!secret) throw new Error('JWT_SECRET environment variable is not defined');
				return {
					secret: secret,
					signOptions: { expiresIn: '1h' },
				};
			},
		}),
	],
	controllers: [AuthController],
	providers: [AuthService, JwtStrategy],
	exports: [AuthService],
})
export class AuthModule { }
