import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

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
    });
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
      ? `<p>Gracias por usar Advice EdTech. Tu video transformado por IA está adjunto.</p>`
      : `<img src="cid:result" alt="Your Transformation" style="max-width: 100%; border-radius: 12px;" />`;

    try {
      const info = (await this.transporter.sendMail({
        from: `"Advice EdTech" <${this.config.get<string>('GMAIL_USER')}>`,
        to,
        subject: 'Tu foto transformada por IA - Advice EdTech',
        html: `
          <div style="font-family: sans-serif; text-align: center; padding: 2rem;">
            <h2 style="color: #7c3aed;">¡Tu transformación está lista!</h2>
            ${mediaHtml}
            <p style="margin-top: 1.5rem;">
              <a href="https://www.instagram.com/adviceedtech/" target="_blank" style="color: #7c3aed; text-decoration: none;">Seguinos en Instagram @adviceedtech</a>
            </p>
            <p style="color: #888; font-size: 0.85rem;">— Equipo Advice EdTech</p>
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
