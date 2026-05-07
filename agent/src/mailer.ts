import nodemailer from 'nodemailer';
import { config } from './config';
import type { GeneratedReport } from './agent';

export async function sendReport(report: GeneratedReport): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  });

  await transporter.verify();

  const subject = `Informe político diario · ${report.dateEsp}`;
  const bodyHtml = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; color:#0f172a; max-width:640px;">
      <h2 style="margin:0 0 12px; font-size:18px;">Informe diario · Transformaciones del poder político e institucional</h2>
      <p style="margin:0 0 12px; color:#475569;">Adjunto el informe correspondiente a <b>${report.dateEsp}</b>.</p>
      <p style="margin:0 0 12px; color:#475569;">El archivo HTML es autocontenido. Ábrelo con cualquier navegador para ver el informe completo con las tarjetas desplegables.</p>
      <hr style="border:none; border-top:1px solid #e2e8f0; margin:16px 0;">
      <p style="margin:0; font-size:12px; color:#94a3b8;">Generado automáticamente por el agente político · ${report.dateIso}</p>
    </div>
  `;

  await transporter.sendMail({
    from: config.email.from,
    to: config.email.to,
    subject,
    html: bodyHtml,
    attachments: [
      {
        filename: report.filename,
        content: report.html,
        contentType: 'text/html; charset=utf-8',
      },
    ],
  });
}
