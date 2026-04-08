import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: this.config.get<string>('GMAIL_USER'),
        pass: this.config.get<string>('GMAIL_APP_PASSWORD'),
      },
      family: 4,
    } as SMTPTransport.Options);
  }

  async sendResultEmail(
    to: string,
    filePath: string,
    contentType: string,
  ): Promise<void> {
    const isVideo = contentType.startsWith('video/');
    const filename = isVideo ? 'advice-transform.mp4' : 'advice-transform.jpg';

    this.logger.log(`Preparing email to ${to}`);
    this.logger.log(`Attachment: ${filePath} (${contentType})`);

    const mediaHtml = isVideo
      ? `<p>Thanks for using Advice EdTech. Your AI-transformed video is attached.</p>`
      : `<img src="cid:result" alt="Your Transformation" style="max-width: 100%; border-radius: 12px;" />`;

    try {
      const info = (await this.transporter.sendMail({
        from: `"Advice EdTech" <${this.config.get<string>('GMAIL_USER')}>`,
        to,
        subject: 'Your AI-Transformed Photo from Advice EdTech',
        html: `
          <div style="font-family: sans-serif; text-align: center; padding: 2rem;">
            <h2 style="color: #7c3aed;">Your Transformation is Ready!</h2>
            ${mediaHtml}
            <p style="color: #888; font-size: 0.85rem;">— Advice EdTech Team</p>
          </div>
        `,
        attachments: [
          {
            filename,
            path: filePath,
            contentType,
            ...(isVideo ? {} : { cid: 'result' }),
          },
        ],
      })) as { messageId: string };

      this.logger.log(`Email sent to ${to} | messageId: ${info.messageId}`);
    } catch (err) {
      this.logger.error(`Failed to send email to ${to}: ${err}`);
      throw err;
    }
  }
}
