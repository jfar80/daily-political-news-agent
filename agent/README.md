# Agente político diario

Agente Node.js + TypeScript que genera un informe HTML sobre **transformaciones del poder político e institucional** y lo envía por correo todos los días a las **6:00 AM hora Colombia**.

## Arquitectura

- **`src/config.ts`** — Carga y valida variables de entorno.
- **`src/feeds.ts`** — Descarga titulares internacionales vía RSS oficiales (BBC, Guardian, Le Monde, DW, El País) y APIs públicas (NYT Developer API, Guardian Open Platform). Filtra por palabras clave políticas y deduplica. Corre antes de llamar a Claude para bypasear el bloqueo del crawler.
- **`src/agent.ts`** — Llama a la API de Anthropic inyectando los titulares primarios pre-cargados; Claude usa `web_search` adicional para contraste y para Colombia. Sigue la metodología de [`../memory.md`](../memory.md).
- **`src/mailer.ts`** — Envía el informe como adjunto HTML vía SMTP con Nodemailer.
- **`src/index.ts`** — Orquesta el cron (ejecuta `generateReport` + `sendReport` en la ventana programada).
- **`src/run-once.ts`** — Ejecuta una sola corrida (para pruebas).

## Instalación

```bash
cd agent
npm install
cp .env.example .env
# editar .env con tus credenciales
```

### Variables requeridas

| Variable | Descripción |
|---|---|
| `ANTHROPIC_API_KEY` | Llave API de Anthropic |
| `ANTHROPIC_MODEL` | (opcional) `claude-sonnet-4-6` por defecto |
| `EMAIL_TO` | Correo destinatario del informe |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | Configuración del servidor SMTP |
| `SMTP_USER`, `SMTP_PASS` | Credenciales SMTP |
| `SMTP_FROM` | (opcional) remitente con nombre, ej: `"Agente <x@y.com>"` |
| `CRON_EXPRESSION` | (opcional) `0 6 * * *` por defecto |
| `TIMEZONE` | (opcional) `America/Bogota` por defecto |
| `RUN_ON_START` | (opcional) `true` para ejecutar apenas arranca |

## Uso

### Prueba única

```bash
npm run run-once
```

Genera el informe del día y lo envía al `EMAIL_TO` configurado.

### Producción (con cron)

```bash
# Desarrollo con recarga
npm run dev

# Compilado
npm run build
npm start
```

## Despliegue

### Opción 1: servidor VPS con PM2

```bash
npm run build
npm install -g pm2
pm2 start dist/index.js --name political-agent
pm2 save
pm2 startup
```

### Opción 2: Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist ./dist
COPY ../memory.md /memory.md
CMD ["node", "dist/index.js"]
```

### Opción 3: servicio systemd

```ini
[Unit]
Description=Political News Agent
After=network.target

[Service]
Type=simple
User=nodeuser
WorkingDirectory=/opt/political-agent
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
EnvironmentFile=/opt/political-agent/.env

[Install]
WantedBy=multi-user.target
```

## Notas sobre SMTP (Gmail)

Para Gmail: usa **contraseña de aplicación**, no la contraseña normal.
1. Activa verificación en dos pasos en tu cuenta.
2. Genera una contraseña de aplicación en https://myaccount.google.com/apppasswords
3. Pon esa contraseña en `SMTP_PASS`.

## Cambiar el destinatario

Solo edita `EMAIL_TO` en el archivo `.env` y reinicia el proceso. No se requiere recompilar.
