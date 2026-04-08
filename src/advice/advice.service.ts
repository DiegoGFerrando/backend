import {
  Injectable,
  Logger,
  InternalServerErrorException,
  Inject,
} from '@nestjs/common';
import {
  writeFile,
  mkdir,
  access,
  copyFile,
  readFile,
  unlink,
} from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import type { AiProvider } from './providers/ai-provider.interface';

@Injectable()
export class AdviceService {
  private readonly logger = new Logger(AdviceService.name);

  constructor(@Inject('AI_PROVIDER') private aiProvider: AiProvider) {}

  async transform(
    imageBase64: string,
  ): Promise<{ imageUrl: string; contentType: string }> {
    const logoPath = join(__dirname, '..', '..', 'logo.png');

    const { imageBuffer, contentType } =
      await this.aiProvider.generate(imageBase64);

    this.logger.log(
      `Got image: ${contentType} | size: ${imageBuffer.length} bytes`,
    );

    // Composite logo onto bottom-right corner
    const logoBuffer = await readFile(logoPath);
    const logo = sharp(logoBuffer).resize(120, 120, { fit: 'inside' });
    const composited = await sharp(imageBuffer)
      .composite([
        {
          input: await logo.toBuffer(),
          gravity: 'southeast',
        },
      ])
      .jpeg()
      .toBuffer();

    this.logger.log(`Composited logo | final size: ${composited.length} bytes`);

    const { urlPath } = await this.saveFile(composited, 'image/jpeg');

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

  async deleteFiles(imageUrl: string, emailCopyPath: string): Promise<void> {
    const uploadsDir = join(__dirname, '..', 'uploads');
    const originalPath = join(uploadsDir, imageUrl.replace('/uploads/', ''));
    for (const filePath of [originalPath, emailCopyPath]) {
      try {
        await unlink(filePath);
        this.logger.log(`Deleted ${filePath}`);
      } catch {
        this.logger.warn(`Could not delete ${filePath}`);
      }
    }
  }
}
