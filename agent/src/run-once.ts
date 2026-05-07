import { config } from './config';
import { generateReport } from './agent';
import { sendReport } from './mailer';

async function main(): Promise<void> {
  console.log('Ejecución única (sin cron)');
  console.log(`Destinatario: ${config.email.to}`);
  console.log(`Modelo: ${config.anthropic.model}`);

  const report = await generateReport();
  console.log(`Informe generado: ${report.filepath}`);

  await sendReport(report);
  console.log(`Correo enviado a ${config.email.to}`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
