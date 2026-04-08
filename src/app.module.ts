import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AdviceController } from './advice/advice.controller';
import { AdviceService } from './advice/advice.service';
import { EmailService } from './advice/email.service';
import { OpenAiProvider } from './advice/providers/openai.provider';
import { GeminiProvider } from './advice/providers/gemini.provider';
import { ZskyProvider } from './advice/providers/zsky.provider';

@Module({
  imports: [ConfigModule.forRoot()],
  controllers: [AdviceController],
  providers: [
    AdviceService,
    EmailService,
    OpenAiProvider,
    GeminiProvider,
    ZskyProvider,
    {
      provide: 'AI_PROVIDER',
      useFactory: (
        config: ConfigService,
        openai: OpenAiProvider,
        gemini: GeminiProvider,
        zsky: ZskyProvider,
      ) => {
        const provider = config.get<string>('AI_PROVIDER') || 'openai';
        switch (provider) {
          case 'gemini':
            return gemini;
          case 'zsky':
            return zsky;
          case 'openai':
          default:
            return openai;
        }
      },
      inject: [ConfigService, OpenAiProvider, GeminiProvider, ZskyProvider],
    },
  ],
})
export class AppModule {}
