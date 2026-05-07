import Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config';
import { fetchInternationalHeadlines, formatHeadlinesForPrompt } from './feeds';

export interface GeneratedReport {
  html: string;
  filename: string;
  filepath: string;
  dateIso: string;
  dateEsp: string;
}

function formatDateEsp(date: Date): string {
  return date.toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: config.cron.timezone,
  });
}

function formatDateIso(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: config.cron.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')!.value;
  const m = parts.find((p) => p.type === 'month')!.value;
  const d = parts.find((p) => p.type === 'day')!.value;
  return `${y}-${m}-${d}`;
}

async function loadMemoryCriteria(): Promise<string> {
  const memoryPath = path.join(config.projectRoot, 'memory.md');
  return fs.readFile(memoryPath, 'utf-8');
}

function buildSystemPrompt(memoryCriteria: string): string {
  return `Eres un experto en investigación de noticias de carácter político. Sigues estrictamente la metodología definida a continuación:

${memoryCriteria}

---

# Formato de salida OBLIGATORIO

Tu única salida es un ARCHIVO HTML completo y autocontenido (CSS en línea, sin dependencias externas). Debe:

1. Empezar con \`<!DOCTYPE html>\` y terminar con \`</html>\`.
2. Usar el texto del eyebrow: "INFORME DIARIO · INVESTIGACIÓN POLÍTICA".
3. Tener navegación sticky clicable con anclas a: #internacional, #colombia, #fuentes, #metodologia.
4. Presentar cada noticia como una tarjeta \`<details>\` desplegable con: título, tags (tema, país, sesgo, contraste), resumen ≤ 5 líneas, tema, sesgo, contraste, por qué importa, riesgos, implicaciones para América Latina/Colombia, y lista de fuentes con enlaces \`target="_blank" rel="noopener"\`.
5. Incluir sección de fuentes con nivel de confiabilidad (alta/media).
6. Incluir nota de metodología y nota de transparencia. La **nota de transparencia** DEBE aclarar:
   - Que los titulares internacionales fueron **pre-cargados por el agente Node** vía RSS oficial (BBC, Guardian, Le Monde, Deutsche Welle, El País) y APIs públicas (NYT Developer API y/o Guardian Open Platform) cuando están configuradas. Son fuentes primarias verificadas.
   - Enumerar explícitamente qué medios internacionales tuvieron **acceso primario directo** en esta edición (mirar los titulares PRE-CARGADOS que recibiste) y cuáles, si alguno, cayeron a **fuentes secundarias** verificables (ECFR, Carnegie, CFR) — típicamente The Economist por no tener canal gratis.
   - Que los medios colombianos (El Tiempo, El Espectador, La Silla Vacía, Cambio, Semana) se consultaron vía \`web_search\` directo a sus dominios.
   - Que ninguna cita fue inventada: si un medio no tenía material disponible, se omite y se declara aquí.
7. Diseño profesional: tipografía system-ui, paleta clara con azul accent (#2563eb), buen contraste, responsive.
8. Todos los enlaces deben ser URLs reales obtenidos en la búsqueda o de los titulares pre-cargados, nunca inventados.

REGLA ABSOLUTA DE SALIDA: tu primer carácter debe ser \`<\` (comienzo de \`<!DOCTYPE html>\`). No saludes, no expliques, no anuncies que vas a generar el informe, no escribas markdown ni bloques de código. Salida = HTML puro y nada más. Si necesitas usar tools, hazlo internamente; el texto que entregues como respuesta final es solo el HTML.`;
}

function buildUserPrompt(
  dateIso: string,
  dateEsp: string,
  internationalHeadlines: string,
): string {
  return `Genera el informe diario para ${dateEsp} (${dateIso}).

# Titulares internacionales PRE-CARGADOS (fuentes primarias verificadas)

Los siguientes titulares fueron obtenidos hoy directamente de los feeds oficiales de los medios objetivo. Úsalos como **fuentes primarias** para el bloque internacional. Cada URL es real y clicable.

${internationalHeadlines || '(Sin titulares pre-cargados. Usa web_search para todo.)'}

# Instrucciones

1. **Bloque internacional (5 noticias):** selecciona las 5 más relevantes del material pre-cargado arriba, priorizando los ejes ejecutivo–legislativo, cortes, elecciones y crisis institucionales. Usa las URLs pre-cargadas como enlaces de fuente. Si necesitas contraste o contexto adicional, usa \`web_search\`.

2. **Bloque Colombia (5 noticias):** usa \`web_search\` en los dominios de El Tiempo, El Espectador, La Silla Vacía, Cambio y Semana (todos accesibles). Aplica los mismos filtros temáticos.

3. **Formato:** cada noticia ≤ 10 líneas con resumen, tema, sesgo, contraste, por qué importa, riesgos, implicaciones para América Latina/Colombia y enlaces reales.

4. **Rigor:** no presentes como hecho información de una sola fuente sin verificación. Contrasta cuando sea relevante.

5. **Salida:** SOLO el HTML completo, desde \`<!DOCTYPE html>\` hasta \`</html>\`.`;
}

function extractHtml(text: string): string {
  const cleaned = text.replace(/```(?:html)?\s*/gi, '').replace(/```/g, '');
  const start = cleaned.indexOf('<!DOCTYPE html>');
  const end = cleaned.lastIndexOf('</html>');
  if (start === -1 || end === -1) {
    const preview = text.slice(0, 500).replace(/\n/g, ' ');
    throw new Error(
      `La respuesta del modelo no contiene un documento HTML completo. Inicio recibido: "${preview}..."`,
    );
  }
  return cleaned.slice(start, end + '</html>'.length);
}

export async function generateReport(): Promise<GeneratedReport> {
  const client = new Anthropic({ apiKey: config.anthropic.apiKey });
  const memoryCriteria = await loadMemoryCriteria();

  const now = new Date();
  const dateIso = formatDateIso(now);
  const dateEsp = formatDateEsp(now);

  console.log('[agent] Descargando feeds internacionales (RSS + APIs públicas)...');
  const headlines = await fetchInternationalHeadlines();
  console.log(`[agent] Titulares pre-cargados: ${headlines.length}`);
  const headlinesBlock = formatHeadlinesForPrompt(headlines);

  const useWebSearch = process.env.ENABLE_WEB_SEARCH !== 'false';
  const response = await client.messages.create({
    model: config.anthropic.model,
    max_tokens: 14000,
    system: buildSystemPrompt(memoryCriteria),
    ...(useWebSearch
      ? {
          tools: [
            {
              type: 'web_search_20250305',
              name: 'web_search',
              max_uses: 6,
            },
          ] as unknown as Anthropic.Tool[],
        }
      : {}),
    messages: [{ role: 'user', content: buildUserPrompt(dateIso, dateEsp, headlinesBlock) }],
  });

  let raw = '';
  for (const block of response.content) {
    if (block.type === 'text') raw += block.text;
  }

  const reportsDir = path.join(config.projectRoot, 'reports');
  await fs.mkdir(reportsDir, { recursive: true });
  await fs.writeFile(path.join(reportsDir, `_raw_${formatDateIso(now)}.txt`), raw, 'utf-8');
  console.log(`[agent] Stop reason: ${response.stop_reason}, output tokens: ${response.usage?.output_tokens}`);

  const html = extractHtml(raw);

  const filename = `informe_${dateIso}.html`;
  const filepath = path.join(reportsDir, filename);
  await fs.writeFile(filepath, html, 'utf-8');

  return { html, filename, filepath, dateIso, dateEsp };
}
