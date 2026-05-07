# Daily Political News Agent

Agente Node.js + TypeScript que **genera un informe HTML diario sobre transformaciones del poder político e institucional** y lo entrega por correo a las 6:00 AM (hora Colombia, configurable).

Está diseñado para ser **genérico y reutilizable**: el motor (código) es el mismo para cualquier dominio; el rol del agente y la metodología de análisis se definen en archivos de configuración (`claude.md` y `memory.md`) que cada usuario adapta a su caso de uso.

> El repositorio publica el motor. El contenido editorial (rol, criterios, fuentes) lo aporta cada usuario en sus archivos privados.

![Vista previa del informe](docs/preview.png)

---

## Capacidades

- 🤖 Llamada a la API de [Anthropic Claude](https://www.anthropic.com/) con la tool oficial `web_search` para investigación en vivo.
- 📰 Pre-carga de titulares primarios desde RSS oficiales (BBC, Guardian, Le Monde, Deutsche Welle, El País) y APIs públicas opcionales (NYT Developer API, Guardian Open Platform).
- 🎨 Generación de HTML autocontenido con CSS en línea, navegación sticky, tarjetas colapsables, sin dependencias externas.
- 📧 Entrega por correo SMTP (Nodemailer) con HTML adjunto. Compatible con Gmail vía contraseña de aplicación.
- ⏰ Programación por cron (`node-cron`) con zona horaria configurable.
- 🔧 Configurable por completo vía variables de entorno (`.env`).

## Stack

- **Runtime:** Node.js 20 + TypeScript
- **AI:** `@anthropic-ai/sdk` con `web_search_20250305` tool
- **Feeds:** `rss-parser` + `fetch` nativo
- **Mail:** `nodemailer`
- **Scheduling:** `node-cron`
- **Build:** `tsx` (dev) / `tsc` (prod)

## Estructura

```
.
├── agent/              # Código Node.js del motor
│   ├── src/
│   │   ├── agent.ts    # Llamada a Claude + extracción de HTML
│   │   ├── feeds.ts    # Pre-carga de titulares (RSS + APIs)
│   │   ├── mailer.ts   # Envío SMTP
│   │   ├── config.ts   # Carga y validación de env
│   │   ├── index.ts    # Cron scheduler
│   │   └── run-once.ts # Ejecución única (testing)
│   ├── .env.example    # Plantilla de variables de entorno
│   └── README.md       # Detalles de despliegue
├── claude.md.example   # Plantilla del rol del agente
├── memory.md.example   # Plantilla de metodología de búsqueda
└── README.md           # Este archivo
```

Los archivos `claude.md`, `memory.md` y `agent/.env` no están versionados (`.gitignore`). Cada usuario los crea localmente a partir de los `.example`.

## Quickstart

```bash
# 1. Clonar
git clone https://github.com/jfar80/daily-political-news-agent.git
cd daily-political-news-agent

# 2. Crear archivos de configuración a partir de plantillas
cp claude.md.example claude.md
cp memory.md.example memory.md
cp agent/.env.example agent/.env

# 3. Editar claude.md y memory.md con tu rol y metodología

# 4. Editar agent/.env con tus credenciales:
#    - ANTHROPIC_API_KEY (obténla en console.anthropic.com)
#    - SMTP_USER / SMTP_PASS (Gmail: contraseña de aplicación)
#    - EMAIL_TO (a dónde llega el informe)

# 5. Instalar dependencias y probar
cd agent
npm install
npm run run-once     # Genera y envía un informe ahora

# 6. Producción (con cron)
npm run build
npm start            # Ejecuta el cron 24/7
```

Detalles completos de variables de entorno y despliegue (PM2, Docker, systemd) en [`agent/README.md`](agent/README.md).

## Despliegue

- **Local:** `npm start` o `npm run dev`.
- **VPS con PM2:** `pm2 start dist/index.js`.
- **Docker:** Dockerfile incluido en `agent/README.md`.
- **systemd:** Unit file de ejemplo incluido en `agent/README.md`.
- **Plataformas como Railway / Render / Fly.io:** soporta cron jobs nativos. Sube las variables de entorno desde el panel del proveedor; los archivos `claude.md` y `memory.md` se incluyen en el build.

## Costo aproximado

Ejecutar el agente una vez al día consume entre **0.10 y 0.30 USD** en API de Anthropic (modelo `claude-sonnet-4-6`), dependiendo del volumen de búsquedas web que active la tool. Con 20 USD precargados en una cuenta nueva, hay margen para meses de uso diario y desarrollo.

## Licencia

MIT.
