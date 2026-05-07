import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Variable de entorno requerida no definida: ${name}`);
  }
  return value;
}

export interface Config {
  anthropic: { apiKey: string; model: string };
  email: { to: string; from: string };
  smtp: { host: string; port: number; secure: boolean; user: string; pass: string };
  cron: { expression: string; timezone: string };
  runOnStart: boolean;
  projectRoot: string;
}

export const config: Config = {
  anthropic: {
    apiKey: required('ANTHROPIC_API_KEY'),
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
  },
  email: {
    to: required('EMAIL_TO'),
    from: process.env.SMTP_FROM ?? required('SMTP_USER'),
  },
  smtp: {
    host: required('SMTP_HOST'),
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: required('SMTP_USER'),
    pass: required('SMTP_PASS'),
  },
  cron: {
    expression: process.env.CRON_EXPRESSION ?? '0 6 * * *',
    timezone: process.env.TIMEZONE ?? 'America/Bogota',
  },
  runOnStart: process.env.RUN_ON_START === 'true',
  projectRoot: path.resolve(__dirname, '..', '..'),
};
