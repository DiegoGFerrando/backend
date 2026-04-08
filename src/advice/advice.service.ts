import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { writeFile, mkdir, access, copyFile, readFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

@Injectable()
export class AdviceService {
  private readonly logger = new Logger(AdviceService.name);

  constructor(private config: ConfigService) {}

  async transform(
    imageBase64: string,
  ): Promise<{ imageUrl: string; contentType: string }> {
    const startTime = Date.now();
    const apiKey = this.config.get<string>('OPENAI_API_KEY');

    const logoPath = join(__dirname, '..', '..', 'logo.png');
    const logoBase64 = (await readFile(logoPath)).toString('base64');

    const body = {
      model: 'gpt-image-1',
      prompt:
        'Edit this photo: keep all people, their faces, clothing, and poses exactly as they are. Only replace the background with a futuristic tech environment with neon lights. Add a subtle cyan/purple neon glow effect around the edges of the people. Place the logo from the second image in the bottom-right corner of the final image, without its background, at a small size like a watermark. Do not modify the logo in any way, use the original image. Do not apply any filter to the logo',
      images: [
        { image_url: `data:image/jpeg;base64,${imageBase64}` },
        { image_url: `data:image/jpeg;base64,${logoBase64}` },
      ],
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
        'Could not connect to the AI service. Please try again later.',
      );
    }

    if (!res.ok) {
      const errorBody = await res.text().catch(() => 'unknown');
      this.logger.error(
        `OpenAI API error | status: ${res.status} | statusText: ${res.statusText} | body: ${errorBody}`,
      );
      if (res.status === 429) {
        throw new InternalServerErrorException(
          'The AI service is busy. Please wait a moment and try again.',
        );
      }
      throw new InternalServerErrorException(
        'The AI service returned an error. Please try again.',
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
        'AI did not return an image. Please try again.',
      );
    }

    const imageBuffer = Buffer.from(b64, 'base64');
    this.logger.log(
      `Got image: image/jpeg | size: ${imageBuffer.length} bytes`,
    );

    const { urlPath } = await this.saveFile(imageBuffer, 'image/jpeg');

    return {
      imageUrl: urlPath,
      contentType: 'image/jpeg',
    };
  }

  private async saveFile(
    buffer: Buffer,
    contentType: string,
  ): Promise<{ urlPath: string; filePath: string }> {
    const ext = contentType.includes('png') ? 'png' : 'jpg';
    const uploadsDir = join(__dirname, '..', 'uploads');
    await mkdir(uploadsDir, { recursive: true });

    const filename = `${randomUUID()}.${ext}`;
    const filePath = join(uploadsDir, filename);

    await writeFile(filePath, buffer);
    this.logger.log(`Saved result to ${filePath} (${buffer.length} bytes)`);
    return { urlPath: `/uploads/${filename}`, filePath };
  }

  async copyToEmail(currentUrlPath: string, email: string): Promise<string> {
    const uploadsDir = join(__dirname, '..', 'uploads');
    const oldFilename = currentUrlPath.replace('/uploads/', '');
    const oldPath = join(uploadsDir, oldFilename);
    const ext = oldFilename.split('.').pop() ?? 'jpg';
    const safeEmail = email.replace(/[^a-zA-Z0-9@._-]/g, '_');

    let filename = `${safeEmail}.${ext}`;
    let counter = 1;
    while (await this.fileExists(join(uploadsDir, filename))) {
      counter++;
      filename = `${safeEmail} - ${counter}.${ext}`;
    }

    const newPath = join(uploadsDir, filename);
    await copyFile(oldPath, newPath);
    this.logger.log(`Copied ${oldFilename} → ${filename}`);
    return newPath;
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }
}
