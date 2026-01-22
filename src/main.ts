import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	app.use(helmet());
	app.enableCors();
	app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

	const config = new DocumentBuilder()
		.setTitle('HR Automation API')
		.setDescription('The HR Automation API description')
		.setVersion('1.0')
		.addBearerAuth()
		.build();
	const document = SwaggerModule.createDocument(app, config);
	SwaggerModule.setup('api', app, document);

	const port = process.env.PORT || 3000;
	await app.listen(port);
	Logger.log(`Application is running on: http://localhost:${port}`);
	Logger.log(`Swagger documentation is available at: http://localhost:${port}/api`);
}
bootstrap();
