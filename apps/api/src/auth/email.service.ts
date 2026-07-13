// src/auth/email.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: config.get<string>('SMTP_HOST', 'smtp.gmail.com'),
      port: config.get<number>('SMTP_PORT', 587),
      secure: false,
      auth: {
        user: config.getOrThrow<string>('SMTP_USER'),
        pass: config.getOrThrow<string>('SMTP_PASS'),
      },
    });
  }

  async sendEmailVerification(to: string, token: string): Promise<void> {
    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:3000');
    const verifyUrl = `${appUrl}/verify-email?token=${token}`;

    await this.send({
      to,
      subject: 'Verify your FSTail Platform email',
      html: `
        <h2>Verify your email</h2>
        <p>Click the link below to verify your email address. This link expires in 24 hours.</p>
        <a href="${verifyUrl}" style="
          display:inline-block;
          padding:12px 24px;
          background:#f59e0b;
          color:#0f172a;
          font-weight:600;
          border-radius:6px;
          text-decoration:none;
        ">Verify Email</a>
        <p style="color:#64748b;font-size:12px;margin-top:24px;">
          If you didn't create a FSTail account, you can ignore this email.
        </p>
      `,
    });
  }

  async sendPasswordReset(to: string, token: string): Promise<void> {
    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:3000');
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    await this.send({
      to,
      subject: 'Reset your FSTail Platform password',
      html: `
        <h2>Reset your password</h2>
        <p>Click the link below to set a new password. This link expires in 1 hour.</p>
        <a href="${resetUrl}" style="
          display:inline-block;
          padding:12px 24px;
          background:#f59e0b;
          color:#0f172a;
          font-weight:600;
          border-radius:6px;
          text-decoration:none;
        ">Reset Password</a>
        <p style="color:#64748b;font-size:12px;margin-top:24px;">
          If you didn't request a password reset, you can ignore this email.
          Your password will not change.
        </p>
      `,
    });
  }

  private async send(options: {
    to: string;
    subject: string;
    html: string;
  }): Promise<void> {
    const from = this.config.get<string>(
      'SMTP_FROM',
      'FSTail Solutions <no-reply@fstailsolutions.com.ar>',
    );

    try {
      await this.transporter.sendMail({ from, ...options });
      this.logger.log(`Email sent to ${options.to}: ${options.subject}`);
    } catch (err) {
      this.logger.error(`Failed to send email to ${options.to}`, err);
      // Don't throw — email failures should not break the auth flow
      // Log and monitor, retry via queue in Phase 6
    }
  }
}
