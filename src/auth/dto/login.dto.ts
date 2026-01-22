import { IsString, IsNotEmpty } from 'class-validator';
import { IsStandardEmail } from '../../common/decorators/standard-email.decorator';

import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
	@ApiProperty({ example: 'user@example.com', description: 'The email of the user' })
	@IsStandardEmail()
	email: string;

	@ApiProperty({ example: 'password123', description: 'The password of the user' })
	@IsString()
	@IsNotEmpty()
	password: string;
}
