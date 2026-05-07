import Parser from 'rss-parser';

export interface Headline {
  outlet: string;
  title: string;
  link: string;
  description: string;
  pubDate: string;
}

const parser = new Parser({
  timeout: 15000,
  headers: { 'User-Agent': 'Mozilla/5.0 PoliticalAgent/1.0' },
});

const INTERNATIONAL_RSS_FEEDS: Array<{ outlet: string; url: string }> = [
  { outlet: 'BBC News (Politics)', url: 'https://feeds.bbci.co.uk/news/politics/rss.xml' },
  { outlet: 'BBC News (World)', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { outlet: 'BBC News (Europe)', url: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml' },
  { outlet: 'The Guardian (Politics)', url: 'https://www.theguardian.com/politics/rss' },
  { outlet: 'The Guardian (World)', url: 'https://www.theguardian.com/world/rss' },
  { outlet: 'Le Monde', url: 'https://www.lemonde.fr/rss/une.xml' },
  { outlet: 'Deutsche Welle', url: 'https://rss.dw.com/rdf/rss-en-all' },
  { outlet: 'El País (Portada)', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada' },
  { outlet: 'El País (Internacional)', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/internacional/portada' },
];

const POLITICAL_KEYWORDS = [
  'parliament', 'congress', 'senate', 'court', 'supreme', 'constitutional', 'supreme court',
  'election', 'vote', 'coalition', 'cabinet', 'prime minister', 'president', 'pm',
  'impeachment', 'crisis', 'government', 'opposition', 'legislation', 'ruling',
  'parlement', 'gouvernement', 'élection', 'congrès', 'constitutionnel', 'constitution',
  'parlamento', 'congreso', 'elecciones', 'gobierno', 'tribunal', 'constitucional', 'senado',
  'bundestag', 'bundesrat', 'wahl', 'regierung', 'koalition',
];

function isPoliticallyRelevant(title: string, description: string): boolean {
  const text = `${title} ${description}`.toLowerCase();
  return POLITICAL_KEYWORDS.some((k) => text.includes(k));
}

async function fetchRSS(outlet: string, url: string): Promise<Headline[]> {
  try {
    const feed = await parser.parseURL(url);
    const items = feed.items ?? [];
    return items
      .slice(0, 20)
      .filter((item) => isPoliticallyRelevant(item.title ?? '', item.contentSnippet ?? item.content ?? ''))
      .map((item) => ({
        outlet,
        title: item.title ?? '',
        link: item.link ?? '',
        description: (item.contentSnippet ?? item.content ?? '').replace(/\s+/g, ' ').slice(0, 400),
        pubDate: item.pubDate ?? item.isoDate ?? '',
      }))
      .slice(0, 8);
  } catch (err) {
    console.warn(`[feeds] ${outlet} falló: ${(err as Error).message}`);
    return [];
  }
}

interface NYTTopStory {
  title: string;
  url: string;
  abstract: string;
  published_date: string;
  section: string;
}

async function fetchNYT(): Promise<Headline[]> {
  const apiKey = process.env.NYT_API_KEY;
  if (!apiKey) return [];
  try {
    const response = await fetch(
      `https://api.nytimes.com/svc/topstories/v2/politics.json?api-key=${encodeURIComponent(apiKey)}`,
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = (await response.json()) as { results: NYTTopStory[] };
    return data.results.slice(0, 15).map((r) => ({
      outlet: 'The New York Times',
      title: r.title,
      link: r.url,
      description: r.abstract,
      pubDate: r.published_date,
    }));
  } catch (err) {
    console.warn(`[feeds] NYT API falló: ${(err as Error).message}`);
    return [];
  }
}

interface GuardianArticle {
  webTitle: string;
  webUrl: string;
  webPublicationDate: string;
  fields?: { trailText?: string };
}

async function fetchGuardianAPI(): Promise<Headline[]> {
  const apiKey = process.env.GUARDIAN_API_KEY;
  if (!apiKey) return [];
  try {
    const params = new URLSearchParams({
      section: 'politics|world',
      'order-by': 'newest',
      'show-fields': 'trailText',
      'page-size': '20',
      'api-key': apiKey,
    });
    const response = await fetch(`https://content.guardianapis.com/search?${params.toString()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = (await response.json()) as { response: { results: GuardianArticle[] } };
    return data.response.results.map((r) => ({
      outlet: 'The Guardian (API)',
      title: r.webTitle,
      link: r.webUrl,
      description: r.fields?.trailText ?? '',
      pubDate: r.webPublicationDate,
    }));
  } catch (err) {
    console.warn(`[feeds] Guardian API falló: ${(err as Error).message}`);
    return [];
  }
}

export async function fetchInternationalHeadlines(): Promise<Headline[]> {
  const [rssResults, nytResults, guardianResults] = await Promise.all([
    Promise.all(INTERNATIONAL_RSS_FEEDS.map(({ outlet, url }) => fetchRSS(outlet, url))),
    fetchNYT(),
    fetchGuardianAPI(),
  ]);

  const all = [...rssResults.flat(), ...nytResults, ...guardianResults];

  const seen = new Set<string>();
  const deduped = all.filter((h) => {
    const key = h.link || h.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return deduped.slice(0, 25);
}

export function formatHeadlinesForPrompt(headlines: Headline[]): string {
  const grouped = new Map<string, Headline[]>();
  for (const h of headlines) {
    const list = grouped.get(h.outlet) ?? [];
    list.push(h);
    grouped.set(h.outlet, list);
  }

  const lines: string[] = [];
  for (const [outlet, items] of grouped.entries()) {
    if (items.length === 0) continue;
    lines.push(`\n### ${outlet} (${items.length} titulares filtrados por política)`);
    for (const item of items) {
      lines.push(`- **${item.title}**${item.pubDate ? ` [${item.pubDate}]` : ''}`);
      if (item.description) lines.push(`  ${item.description}`);
      lines.push(`  URL: ${item.link}`);
    }
  }
  return lines.join('\n');
}
