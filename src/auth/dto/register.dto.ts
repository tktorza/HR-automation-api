import { IsString, MinLength, IsNotEmpty, IsOptional } from 'class-validator';
import { IsStandardEmail } from '../../common/decorators/standard-email.decorator';

export class RegisterDto {
	@IsStandardEmail()
	email: string;

	@IsString()
	@IsNotEmpty()
	@MinLength(6)
	password: string;

	@IsString()
	@IsOptional()
	tenantName?: string;
}
