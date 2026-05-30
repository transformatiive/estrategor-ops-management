import nodemailer from "nodemailer";
import { env } from "../env.js";

export interface EmailMessage {
  to: string;
  cc?: string;
  subject: string;
  body: string;
}

export interface EmailAdapter {
  readonly mode: "smtp" | "stub";
  send(msg: EmailMessage): Promise<void>;
}

/** Stub: não envia, apenas regista (dev/CI/demo sem SMTP). */
class StubEmail implements EmailAdapter {
  readonly mode = "stub" as const;
  async send(msg: EmailMessage): Promise<void> {
    // O registo em activity_log/reminders é feito pelo chamador; aqui só log.
    console.log(`[email:stub] para=${msg.to}${msg.cc ? ` cc=${msg.cc}` : ""} :: ${msg.subject}`);
  }
}

/** SMTP real via nodemailer (quando SMTP_HOST está definido). */
class SmtpEmail implements EmailAdapter {
  readonly mode = "smtp" as const;
  private transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 587,
    secure: (env.SMTP_PORT ?? 587) === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });

  async send(msg: EmailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: env.SMTP_FROM,
      to: msg.to,
      cc: msg.cc,
      subject: msg.subject,
      text: msg.body,
    });
  }
}

export function getEmail(): EmailAdapter {
  return env.SMTP_HOST ? new SmtpEmail() : new StubEmail();
}
