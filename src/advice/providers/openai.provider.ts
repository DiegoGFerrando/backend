import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiProvider, AiGenerationResult } from './ai-provider.interface';

const PROMPT =
  'Edit this photo: keep all people, their faces, clothing, and poses exactly as they are. Only replace the background with a futuristic tech environment with neon lights. Add a subtle cyan/purple neon glow effect around the edges of the people.';

@Injectable()
export class OpenAiProvider implements AiProvider {
  private readonly logger = new Logger(OpenAiProvider.name);

  constructor(private config: ConfigService) {}

  async generate(imageBase64: string): Promise<AiGenerationResult> {
    const startTime = Date.now();
    const apiKey = this.config.get<string>('OPENAI_API_KEY');

    const body = {
      model: 'gpt-image-1',
      prompt: PROMPT,
      images: [{ image_url: `data:image/jpeg;base64,${imageBase64}` }],
      input_fidelity: 'high',
      quality: 'medium',
      size: '1024x1024',
      output_format: 'jpeg',
    };

    this.logger.log('Sending image to OpenAI gpt-image-1...');

    let res: Response;
    try {
      res = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      this.logger.error(
        `Failed to connect to OpenAI API | error: ${err instanceof Error ? err.message : err}`,
      );
      throw new InternalServerErrorException(
        'No se pudo conectar con el servicio de IA. Por favor, intentá más tarde.',
      );
    }

    if (!res.ok) {
      const errorBody = await res.text().catch(() => 'unknown');
      this.logger.error(
        `OpenAI API error | status: ${res.status} | statusText: ${res.statusText} | body: ${errorBody}`,
      );
      if (res.status === 429) {
        throw new InternalServerErrorException(
          'El servicio de IA está ocupado. Esperá un momento e intentá de nuevo.',
        );
      }
      throw new InternalServerErrorException(
        'El servicio de IA devolvió un error. Por favor, intentá de nuevo.',
      );
    }

    const data = (await res.json()) as {
      data?: Array<{ b64_json?: string; revised_prompt?: string }>;
    };

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    this.logger.log(`OpenAI responded in ${elapsed}s`);

    const b64 = data.data?.[0]?.b64_json;
    if (!b64) {
      this.logger.error(
        `No image in OpenAI response | response: ${JSON.stringify(data).slice(0, 500)}`,
      );
      throw new InternalServerErrorException(
        'La IA no devolvió una imagen. Por favor, intentá de nuevo.',
      );
    }

    return {
      imageBuffer: Buffer.from(b64, 'base64'),
      contentType: 'image/jpeg',
    };
  }
}
