import cron from 'node-cron';
import { config } from './config';
import { generateReport } from './agent';
import { sendReport } from './mailer';

async function runOnce(): Promise<void> {
  const startedAt = new Date();
  console.log(`[${startedAt.toISOString()}] Iniciando generación del informe diario...`);

  try {
    const report = await generateReport();
    console.log(`[${new Date().toISOString()}] Informe generado: ${report.filepath}`);

    await sendReport(report);
    console.log(`[${new Date().toISOString()}] Correo enviado a ${config.email.to}`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error en la ejecución:`, err);
  }
}

function main(): void {
  if (!cron.validate(config.cron.expression)) {
    throw new Error(`Expresión cron inválida: ${config.cron.expression}`);
  }

  console.log('=== Agente político diario ===');
  console.log(`Programación: ${config.cron.expression} (${config.cron.timezone})`);
  console.log(`Destinatario: ${config.email.to}`);
  console.log(`Modelo: ${config.anthropic.model}`);
  console.log('===============================');

  cron.schedule(config.cron.expression, runOnce, {
    timezone: config.cron.timezone,
  });

  if (config.runOnStart) {
    console.log('RUN_ON_START=true → ejecutando inmediatamente');
    void runOnce();
  }

  const shutdown = (signal: string): void => {
    console.log(`\nRecibida señal ${signal}. Cerrando el agente...`);
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main();
