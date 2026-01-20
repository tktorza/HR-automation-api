import { Module } from '@nestjs/common';
import { LinkedinService } from './linkedin.service';
import { LinkedinController } from './linkedin.controller';
import { CryptoModule } from '../crypto/crypto.module';

@Module({
	imports: [CryptoModule],
	controllers: [LinkedinController],
	providers: [LinkedinService],
	exports: [LinkedinService],
})
export class LinkedinModule { }
