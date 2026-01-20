import { IsString, IsNotEmpty } from 'class-validator';
import { IsStandardEmail } from '../../common/decorators/standard-email.decorator';

export class LoginDto {
	@IsStandardEmail()
	email: string;

	@IsString()
	@IsNotEmpty()
	password: string;
}
