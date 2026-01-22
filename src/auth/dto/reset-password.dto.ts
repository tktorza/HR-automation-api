import { IsString, IsNotEmpty, MinLength } from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
	@ApiProperty({ description: 'The token received by email' })
	@IsString()
	@IsNotEmpty()
	token: string;

	@ApiProperty({ example: 'newPassword123', minLength: 6 })
	@IsString()
	@IsNotEmpty()
	@MinLength(6)
	newPassword: string;
}
