import { IsStandardEmail } from '../../common/decorators/standard-email.decorator';

import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
	@ApiProperty({ example: 'user@example.com' })
	@IsStandardEmail()
	email: string;
}
