import { applyDecorators } from '@nestjs/common';
import { IsEmail, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

export function IsStandardEmail() {
	return applyDecorators(
		IsEmail(),
		IsNotEmpty(),
		Transform(({ value }) => value?.trim().toLowerCase()),
	);
}
