import { Controller, Post, Body, UseGuards, Request, Get, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
	constructor(private authService: AuthService) { }

	@ApiOperation({ summary: 'Register new user' })
	@ApiResponse({ status: 201, description: 'User successfully created.' })
	@ApiResponse({ status: 400, description: 'Bad Request.' })
	@Post('register')
	async register(@Body() registerDto: RegisterDto) {
		return this.authService.register(registerDto);
	}

	@ApiOperation({ summary: 'Login user' })
	@ApiResponse({ status: 200, description: 'Return JWT access token.' })
	@ApiResponse({ status: 401, description: 'Unauthorized.' })
	@Post('login')
	async login(@Body() loginDto: LoginDto) {
		const user = await this.authService.validateUser(loginDto.email, loginDto.password);
		if (!user) {
			throw new UnauthorizedException('Invalid credentials');
		}
		return this.authService.login(user);
	}

	@ApiBearerAuth()
	@UseGuards(JwtAuthGuard)
	@ApiOperation({ summary: 'Get current user profile' })
	@ApiResponse({ status: 200, description: 'Return current user info.' })
	@Get('me')
	getProfile(@Request() req) {
		return req.user;
	}

	@ApiOperation({ summary: 'Request password reset' })
	@Post('forgot-password')
	async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
		return this.authService.forgotPassword(forgotPasswordDto.email);
	}

	@ApiOperation({ summary: 'Reset password with token' })
	@Post('reset-password')
	async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
		return this.authService.resetPassword(resetPasswordDto.token, resetPasswordDto.newPassword);
	}
}
