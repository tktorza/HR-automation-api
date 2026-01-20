import { IsStandardEmail } from '../../common/decorators/standard-email.decorator';

export class ForgotPasswordDto {
	@IsStandardEmail()
	email: string;
}
