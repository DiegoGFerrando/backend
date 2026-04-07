import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdviceController } from './advice/advice.controller';
import { AdviceService } from './advice/advice.service';
import { EmailService } from './advice/email.service';

@Module({
  imports: [ConfigModule.forRoot()],
  controllers: [AdviceController],
  providers: [AdviceService, EmailService],
})
export class AppModule {}
