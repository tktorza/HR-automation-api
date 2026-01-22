import { IsString, MinLength, IsNotEmpty, IsOptional } from 'class-validator';
import { IsStandardEmail } from '../../common/decorators/standard-email.decorator';

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
	@ApiProperty({ example: 'user@example.com' })
	@IsStandardEmail()
	email: string;

	@ApiProperty({ example: 'password123', minLength: 6 })
	@IsString()
	@IsNotEmpty()
	@MinLength(6)
	password: string;

	@ApiPropertyOptional({ example: 'Acme Corp' })
	@IsString()
	@IsOptional()
	tenantName?: string;
}
