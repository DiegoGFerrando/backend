import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiProvider, AiGenerationResult } from './ai-provider.interface';
import { ZSkySubmitResponse, ZSkyPollResponse } from './zsky.types';

const PROMPT =
  'In this image there is at least one person. Replace the background with a futuristic tech one. Apply a tech neon glow filter to the people. Do not change anything else.';

@Injectable()
export class ZskyProvider implements AiProvider {
  private readonly logger = new Logger(ZskyProvider.name);
  private readonly baseUrl = 'https://zsky.ai';

  constructor(private config: ConfigService) {}

  async generate(imageBase64: string): Promise<AiGenerationResult> {
    const startTime = Date.now();
    const token = this.config.get<string>('ZSKY_TOKEN');
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    // 1. Submit the job
    let submitRes: Response;
    try {
      submitRes = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          type: 'i2i',
          prompt: PROMPT,
          image_base64: imageBase64,
          width: 1024,
          height: 1024,
          age_verified: true,
          tier: 'free',
        }),
      });
    } catch (err) {
      this.logger.error(
        `Failed to connect to ZSky API | error: ${err instanceof Error ? err.message : err}`,
      );
      throw new InternalServerErrorException(
        'No se pudo conectar con el servicio de IA. Por favor, intentá más tarde.',
      );
    }

    if (!submitRes.ok) {
      const body = await submitRes.text().catch(() => 'unknown');
      this.logger.error(
        `ZSky submit failed | status: ${submitRes.status} | statusText: ${submitRes.statusText} | body: ${body}`,
      );
      if (submitRes.status === 429) {
        throw new InternalServerErrorException(
          'El servicio de IA está ocupado. Esperá un momento e intentá de nuevo.',
        );
      }
      throw new InternalServerErrorException(
        'El servicio de IA devolvió un error. Por favor, intentá de nuevo.',
      );
    }

    const job = (await submitRes.json()) as ZSkySubmitResponse;
    const jobId = job.job_id;
    this.logger.log(`Job submitted: ${jobId} (status: ${job.status})`);

    // 2. Poll until completed
    const pollUrl = `${this.baseUrl}/api/job/${jobId}`;
    const maxAttempts = 180;

    for (let i = 0; i < maxAttempts; i++) {
      await this.delay(3000);

      let pollRes: Response;
      try {
        pollRes = await fetch(pollUrl, { headers });
      } catch (err) {
        this.logger.error(
          `Poll network error | attempt: ${i + 1} | error: ${err instanceof Error ? err.message : err}`,
        );
        continue;
      }

      if (!pollRes.ok) {
        const body = await pollRes.text().catch(() => 'unknown');
        this.logger.error(
          `ZSky poll failed | attempt: ${i + 1} | status: ${pollRes.status} | body: ${body}`,
        );
        throw new InternalServerErrorException(
          'No se pudo verificar el estado de la generación. Por favor, intentá de nuevo.',
        );
      }

      const status = (await pollRes.json()) as ZSkyPollResponse;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.log(
        `Poll #${i + 1} | status: ${status.status} | progress: ${status.progress ?? '-'} | queue: ${status.queue_position ?? '-'} | elapsed: ${elapsed}s`,
      );

      if (status.status === 'completed') {
        const result = status.results?.[0];
        if (!result?.url) {
          throw new InternalServerErrorException(
            'La generación se completó pero no se devolvió imagen. Por favor, intentá de nuevo.',
          );
        }
        const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
        this.logger.log(
          `Job ${jobId} completed in ${totalTime}s | content_type: ${result.content_type}`,
        );

        const imageBuffer = await this.downloadFile(
          `${this.baseUrl}${result.url}`,
        );
        return {
          imageBuffer,
          contentType: result.content_type,
        };
      }

      if (status.status === 'failed' || status.status === 'error') {
        this.logger.error(
          `Job ${jobId} failed | elapsed: ${elapsed}s | status: ${JSON.stringify(status)}`,
        );
        throw new InternalServerErrorException(
          'La generación de imagen falló. Por favor, intentá de nuevo.',
        );
      }
    }

    const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    this.logger.error(
      `Job ${jobId} timed out | polls: ${maxAttempts} | elapsed: ${totalElapsed}s`,
    );
    throw new InternalServerErrorException(
      'La generación de imagen expiró. Por favor, intentá de nuevo.',
    );
  }

  private async downloadFile(remoteUrl: string): Promise<Buffer> {
    let res: Response;
    try {
      res = await fetch(remoteUrl);
    } catch (err) {
      this.logger.error(
        `Download network error | url: ${remoteUrl} | error: ${err instanceof Error ? err.message : err}`,
      );
      throw new InternalServerErrorException(
        'No se pudo descargar la imagen generada. Por favor, intentá de nuevo.',
      );
    }

    if (!res.ok) {
      this.logger.error(
        `Download HTTP error | url: ${remoteUrl} | status: ${res.status}`,
      );
      throw new InternalServerErrorException(
        'No se pudo descargar la imagen generada. Por favor, intentá de nuevo.',
      );
    }

    return Buffer.from(await res.arrayBuffer());
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
