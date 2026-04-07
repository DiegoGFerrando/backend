import {
  Controller,
  Post,
  Body,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import 'multer';
import { AdviceService } from './advice.service';
import { EmailService } from './email.service';

@Controller('api/advice')
export class AdviceController {
  private readonly logger = new Logger(AdviceController.name);

  constructor(
    private readonly adviceService: AdviceService,
    private readonly emailService: EmailService,
  ) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('image', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  async transform(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No image provided');
    }

    const base64 = file.buffer.toString('base64');

    try {
      const result = await this.adviceService.transform(base64);
      return {
        imageUrl: result.imageUrl,
        contentType: result.contentType,
      };
    } catch (err) {
      this.logger.error(`Transform failed: ${err}`);
      throw err;
    }
  }

  @Post('send-email')
  async sendEmail(
    @Body() body: { email: string; imageUrl: string; contentType: string },
  ) {
    if (!body.email || !body.imageUrl) {
      throw new BadRequestException('email and imageUrl are required');
    }

    const localPath = await this.adviceService.copyToEmail(
      body.imageUrl,
      body.email.trim().toLowerCase(),
    );

    try {
      await this.emailService.sendResultEmail(
        body.email,
        localPath,
        body.contentType || 'image/jpeg',
      );
      return { sent: true };
    } catch (err) {
      this.logger.error(`Email send failed for ${body.email}: ${err}`);
      throw new InternalServerErrorException(
        'Failed to send email. Please try again.',
      );
    }
  }
}
