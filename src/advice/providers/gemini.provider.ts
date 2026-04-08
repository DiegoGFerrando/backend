import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { AiProvider, AiGenerationResult } from './ai-provider.interface';

const PROMPT =
  'Edit this photo: keep all people, their faces, clothing, and poses exactly as they are. Only replace the background with a futuristic tech environment with neon lights. Add a subtle cyan/purple neon glow effect around the edges of the people.';

@Injectable()
export class GeminiProvider implements AiProvider {
  private readonly logger = new Logger(GeminiProvider.name);
  private readonly client: GoogleGenAI | null = null;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (apiKey) {
      this.client = new GoogleGenAI({ apiKey });
    }
  }

  async generate(imageBase64: string): Promise<AiGenerationResult> {
    if (!this.client) {
      throw new InternalServerErrorException(
        'GEMINI_API_KEY no está configurada.',
      );
    }
    const startTime = Date.now();
    this.logger.log(
      'Sending image to Gemini gemini-2.0-flash-exp (image generation)...',
    );

    try {
      const response = await this.client.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: [
          {
            role: 'user',
            parts: [
              { text: PROMPT },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: imageBase64,
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['image', 'text'],
        },
      });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.log(`Gemini responded in ${elapsed}s`);

      const parts = response.candidates?.[0]?.content?.parts;
      if (!parts) {
        throw new Error('No parts in Gemini response');
      }

      for (const part of parts) {
        if (part.inlineData?.data) {
          const contentType = part.inlineData.mimeType || 'image/png';
          return {
            imageBuffer: Buffer.from(part.inlineData.data, 'base64'),
            contentType,
          };
        }
      }

      throw new Error('No image in Gemini response parts');
    } catch (err) {
      if (err instanceof InternalServerErrorException) throw err;
      this.logger.error(
        `Gemini API error | error: ${err instanceof Error ? err.message : err}`,
      );
      throw new InternalServerErrorException(
        'El servicio de IA devolvió un error. Por favor, intentá de nuevo.',
      );
    }
  }
}
