import { parse } from "https://denopkg.com/ThauEx/deno-fast-xml-parser/mod.ts";
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

// 1. METADADOS FAIR DA FONTE
const FAIR_METADATA = {
  title: "Notícias ANAC",
  description: "Feed de notícias e vídeos da Agência Nacional de Aviação Civil do Brasil",
  publisher: "Agência Nacional de Aviação Civil (ANAC)",
  license: "http://www.planejamento.gov.br/assuntos/acoes-e-programas/dados-abertos/licenca-dados-abertos",
  creator: "ANAC",
  created: new Date().toISOString(),
  source: "https://www.gov.br/anac/pt-br/noticias",
  keywords: ["aviação civil", "ANAC", "Brasil", "notícias", "regulação aérea"],
  language: "pt-br",
  coverage: "Brasil",
  rights: "Dados abertos conforme Lei de Acesso à Informação"
};

// 2. CONFIGURAÇÕES
const maxNoticias = 20;
const maxVideos = 20;
const youtubeChannelId = "UC5ynmbMZXolM-jo2hGR31qg";
const baseUrl = "https://www.gov.br/anac/pt-br/noticias";

// 3. FUNÇÕES AUXILIARES
function parseCustomDate(dateStr: string): { formatted: string; dateObj: Date } {
  if (!dateStr || dateStr === "ND") {
    const now = new Date();
    return {
      formatted: `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}h${now.getMinutes().toString().padStart(2, '0')}`,
      dateObj: now
    };
  }

  const [datePart, timePart] = dateStr.split(' ');
  const [day, month, year] = datePart.split('/').map(Number);
  const [hours, minutes] = timePart.replace('h', ':').split(':').map(Number);

  const dateObj = new Date(year, month - 1, day, hours || 0, minutes || 0);
  
  return {
    formatted: dateStr,
    dateObj
  };
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

// 4. EXTRAÇÃO DE NOTÍCIAS
async function fetchNoticias() {
  const headers = { "User-Agent": "Mozilla/5.0" };
  const res = await fetch(baseUrl, { headers });
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, "text/html");

  if (!doc) {
    console.error("❌ Erro ao parsear HTML");
    Deno.exit(1);
  }

  const noticias = [];
  const artigos = doc.querySelectorAll("article.tileItem");

  for (let i = 0; i < Math.min(maxNoticias, artigos.length); i++) {
    const el = artigos[i];
    try {
      const titleElem = el.querySelector("h2.tileHeadline a");
      const title = titleElem?.textContent?.trim() || "Sem título";
      const link = titleElem?.getAttribute("href") || "#";

      const dateIcon = el.querySelector("span.summary-view-icon i.icon-day");
      const timeIcon = el.querySelector("span.summary-view-icon i.icon-hour");
      const date = dateIcon?.parentElement?.textContent?.trim().replace(/\s+/g, " ") || "ND";
      const time = timeIcon?.parentElement?.textContent?.trim().replace(/\s+/g, " ") || "ND";
      const dateTime = `${date} ${time}`.replace("ND ND", "").trim();

      const descElem = el.querySelector("p.tileBody span.description");
      const description = descElem?.textContent?.trim() || "Sem descrição";

      const imgElem = el.querySelector("div.tileImage img");
      const image = imgElem?.getAttribute("src") || null;

      noticias.push({ title, link, date: dateTime, description, image, type: "texto" });
    } catch (e) {
      console.warn("⚠️ Erro ao processar item:", e);
    }
  }

  return noticias;
}

// 5. EXTRAÇÃO DE VÍDEOS
async function fetchYouTubeVideos() {
  const youtubeFeedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${youtubeChannelId}`;
  const res = await fetch(youtubeFeedUrl);
  const xml = await res.text();
  const parsed = parse(xml, { ignoreAttributes: false });

  const entries = parsed.feed?.entry || [];
  const videos = Array.isArray(entries) ? entries : [entries];

  return videos.slice(0, maxVideos).map((video: any) => {
    const date = video.published ? new Date(video.published) : new Date();
    return {
      title: video.title,
      link: video.link?.["@_href"] || video.link?.["@_url"],
      date: `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}h${date.getMinutes().toString().padStart(2, '0')}`,
      dateObj: date,
      description: video["media:group"]?.["media:description"] || "",
      image: video["media:group"]?.["media:thumbnail"]?.["@_url"] || null,
      type: "vídeo",
    };
  });
}

// 6. PROCESSAMENTO PRINCIPAL
async function main() {
  // Coleta e processa dados
  const noticias = await fetchNoticias();
  const youtubeVideos = await fetchYouTubeVideos();

  const processedNoticias = noticias.map(n => {
    const { formatted, dateObj } = parseCustomDate(n.date);
    return { ...n, date: formatted, dateObj };
  });

  const conteudos = [...processedNoticias, ...youtubeVideos].sort((a, b) => {
    return b.dateObj.getTime() - a.dateObj.getTime();
  });

  // Cria diretório de saída
  await Deno.mkdir("data", { recursive: true });

  // 7. GERAÇÃO DE ARQUIVOS

  // JSON
  const jsonData = {
    ...FAIR_METADATA,
    version: "1.0",
    generated: new Date().toISOString(),
    items: conteudos.map(c => ({
      ...c,
      date: c.date,
      dateObj: undefined
    }))
  };
  await Deno.writeTextFile("data/feed.json", JSON.stringify(jsonData, null, 2));

  // HTML
  const htmlContent = `<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8">
  <title>${FAIR_METADATA.title}</title>
  ${Object.entries(FAIR_METADATA).map(([key, value]) => 
    Array.isArray(value) 
      ? `<meta name="${key}" content="${value.join(', ')}">`
      : `<meta name="${key}" content="${value}">`
  ).join('\n  ')}
</head>
<body>
  <h1>${FAIR_METADATA.title}</h1>
  ${conteudos.map(n => `
    <article>
      <h2><a href="${n.link}">${n.title}</a></h2>
      <p><time datetime="${n.dateObj.toISOString()}">${n.date}</time> | ${n.type}</p>
      ${n.image ? `<img src="${n.image}" alt="${n.title}" width="200">` : ''}
      <p>${n.description}</p>
    </article>
  `).join('\n')}
</body>
</html>`;
  await Deno.writeTextFile("data/index.html", htmlContent);

  // RSS
  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${FAIR_METADATA.title}</title>
    <link>${baseUrl}</link>
    <description>${FAIR_METADATA.description}</description>
    <language>${FAIR_METADATA.language}</language>
    <pubDate>${new Date().toUTCString()}</pubDate>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <generator>Deno Feed Generator</generator>
    ${conteudos.map(n => `
    <item>
      <title><![CDATA[${n.title}]]></title>
      <link>${n.link}</link>
      <guid>${n.link}</guid>
      <pubDate>${n.dateObj.toUTCString()}</pubDate>
      <description><![CDATA[${n.description}]]></description>
      ${n.image ? `<enclosure url="${n.image}" type="image/jpeg"/>` : ''}
    </item>
    `).join('\n    ')}
  </channel>
</rss>`;
  await Deno.writeTextFile("data/rss.xml", rssXml);

  // ATOM
  const atomXml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"
      xmlns:dc="http://purl.org/dc/elements/1.1/">
  
  <title>${FAIR_METADATA.title}</title>
  <subtitle>${FAIR_METADATA.description}</subtitle>
  <link href="${baseUrl}"/>
  <link href="https://exemplo.com/data/atom.xml" rel="self"/>
  <id>${baseUrl}</id>
  <updated>${conteudos[0]?.dateObj.toISOString() || new Date().toISOString()}</updated>
  <rights>${FAIR_METADATA.rights}</rights>

  ${conteudos.map(n => `
  <entry>
    <title>${escapeXml(n.title)}</title>
    <link href="${n.link}"/>
    <id>${n.link}</id>
    <published>${n.dateObj.toISOString()}</published>
    <updated>${n.dateObj.toISOString()}</updated>
    <summary>${escapeXml(n.description)}</summary>
    <dc:creator>${FAIR_METADATA.creator}</dc:creator>
    <dc:date>${n.dateObj.toISOString()}</dc:date>
  </entry>
  `).join('\n')}
</feed>`;
  await Deno.writeTextFile("data/atom.xml", atomXml);

  console.log("✅ Arquivos gerados com sucesso!");
}

// 8. EXECUÇÃO
await main();
