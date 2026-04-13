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
      : `
        <img src="cid:result" alt="Tu foto" style="max-width: 400px; width: 100%; height: auto; border-radius: 12px; margin-bottom: 1.5rem;" />
      `;

    try {
      const info = (await this.transporter.sendMail({
        from: `"Advice EdTech" <${this.config.get<string>('GMAIL_USER')}>`,
        to,
        subject: 'Tu foto transformada por IA - Advice EdTech',
        html: `
          <div style="font-family: sans-serif; text-align: center; padding: 2rem;">
            <h2 style="color: #7c3aed; margin-bottom: 1.5rem;">Subí tu foto y etiquetanos!</h2>
            <p style="margin-bottom: 1.5rem;">
              <a href="https://www.instagram.com/adviceedtech/" target="_blank" style="color: #f52df5; text-decoration: none; font-size: 1.1rem; font-weight: bold;">￫ @adviceedtech en Instagram ￩</a>
            </p>
            ${mediaHtml}
            <p style="color: #888; font-size: 0.85rem; margin-top: 1.5rem;">
              Desarrollado por <a href="https://www.instagram.com/vkcomunicaciondigital" target="_blank" style="color: #7c3aed; text-decoration: none;">VK Comunicación Digital</a>
            </p>
          </div>
        `,
        attachments: [
          // Inline image for HTML body (if not video)
          ...(!isVideo
            ? [
                {
                  filename,
                  path: filePath,
                  contentType,
                  cid: 'result',
                },
              ]
            : []),
          // Always attach as a downloadable file
          {
            filename,
            path: filePath,
            contentType,
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
