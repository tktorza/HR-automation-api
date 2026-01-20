import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class NotificationsService {
	private transporter: nodemailer.Transporter;
	private readonly logger = new Logger(NotificationsService.name);

	constructor() {
		this.transporter = nodemailer.createTransport({
			host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
			port: Number(process.env.SMTP_PORT) || 2525,
			auth: {
				user: process.env.SMTP_USER,
				pass: process.env.SMTP_PASS,
			},
		});
	}

	async sendPasswordResetEmail(email: string, token: string) {
		const frontendUrl = process.env.FRONTEND_URL;
		if (!frontendUrl) {
			if (process.env.NODE_ENV === 'production') {
				this.logger.error('FRONTEND_URL is not defined in .env! This is critical for production.');
			} else {
				this.logger.warn('FRONTEND_URL is not defined in .env, defaulting to http://localhost:3000 for dev.');
			}
		}

		// Default to localhost ONLY for dev safety, but logic prefers env var
		const baseUrl = frontendUrl || 'http://localhost:3000';
		const resetLink = `${baseUrl}/reset-password?token=${token}`;

		const mailOptions = {
			from: process.env.SMTP_FROM || '"HR Automation" <noreply@hr-automation.com>',
			to: email,
			subject: 'Password Reset Request',
			html: `
        <h1>Password Reset</h1>
        <p>You requested a password reset. Click the link below to verify your email:</p>
        <a href="${resetLink}">Reset Password</a>
        <p>This link expires in 1 hour.</p>
        <p>If you did not request this, please ignore this email.</p>
        <p>Token: ${token}</p>
      `,
		};

		try {
			const info = await this.transporter.sendMail(mailOptions);
			this.logger.log(`Password reset email sent to ${email}: ${info.messageId}`);
			return info;
		} catch (error) {
			this.logger.error(`Failed to send password reset email to ${email}`, error.stack);
			// In dev environment without real SMTP, we might want to just log the token
			if (process.env.NODE_ENV !== 'production') {
				this.logger.warn(`DEV MODE: Reset token for ${email} is ${token}`);
				return { messageId: 'dev-mock-id' };
			}
			throw error;
		}
	}
}
