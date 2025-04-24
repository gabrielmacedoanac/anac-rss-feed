import { parse } from "https://denopkg.com/ThauEx/deno-fast-xml-parser/mod.ts";
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

// ==================== CONFIGURAÇÕES ====================
const FAIR_METADATA = {
  title: "Notícias ANAC",
  description: "Feed de notícias e vídeos da Agência Nacional de Aviação Civil",
  identifier: "urn:uuid:anac-feed-" + crypto.randomUUID(),
  publisher: {
    name: "Agência Nacional de Aviação Civil (ANAC)",
    url: "https://www.gov.br/anac"
  },
  creator: "Divisão de Comunicação Social - ANAC",
  source: "https://www.gov.br/anac/pt-br/noticias",
  license: {
    name: "Licença Creative Commons Atribuição 4.0",
    url: "https://creativecommons.org/licenses/by/4.0/"
  },
  rights: "Dados abertos para uso público",
  keywords: ["aviação", "ANAC", "Brasil", "notícias", "regulação aérea"],
  language: "pt-BR",
  coverage: "Brasil"
};

const CONFIG = {
  maxNoticias: 20,
  maxVideos: 15,
  youtubeChannelId: "UC5ynmbMZXolM-jo2hGR31qg",
  baseUrl: "https://www.gov.br/anac/pt-br/noticias",
  outputDir: "data"
};

// ==================== FUNÇÕES AUXILIARES ====================
function escapeXml(text: string): string {
  return text.replace(/[<>&'"]/g, char => 
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[char] || char));
}

function parseCustomDate(dateStr: string): { display: string; iso: string; obj: Date } {
  const now = new Date();
  
  // Fallback padrão
  const fallback = {
    display: now.toLocaleString("pt-BR"),
    iso: now.toISOString(),
    obj: now
  };

  if (!dateStr || dateStr === "ND") return fallback;

  try {
    // Formato "DD/MM/YYYY HHhMM"
    if (dateStr.includes('/') && dateStr.includes('h')) {
      const [datePart, timePart] = dateStr.split(' ');
      const [day, month, year] = datePart.split('/').map(Number);
      const [hours, minutes] = timePart.replace('h', ':').split(':').map(Number);
      
      const dateObj = new Date(year, month - 1, day, hours || 0, minutes || 0);
      
      if (!isNaN(dateObj.getTime())) {
        return {
          display: `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year} ${hours.toString().padStart(2, '0')}h${minutes.toString().padStart(2, '0')}`,
          iso: dateObj.toISOString(),
          obj: dateObj
        };
      }
    }

    // Tenta parsear como objeto Date existente
    if (dateStr instanceof Date && !isNaN(dateStr.getTime())) {
      return {
        display: dateStr.toLocaleString("pt-BR"),
        iso: dateStr.toISOString(),
        obj: dateStr
      };
    }

    // Tenta parsear como ISO string
    const dateObj = new Date(dateStr);
    if (!isNaN(dateObj.getTime())) {
      return {
        display: dateObj.toLocaleString("pt-BR"),
        iso: dateObj.toISOString(),
        obj: dateObj
      };
    }

    throw new Error(`Formato não reconhecido: ${dateStr}`);
  } catch (e) {
    console.warn(`⚠️ Erro ao parsear data "${dateStr}":`, e.message);
    return fallback;
  }
}

// ==================== EXTRAÇÃO DE DADOS ====================
async function fetchNoticias() {
  try {
    const res = await fetch(CONFIG.baseUrl, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");

    if (!doc) throw new Error("Falha ao parsear HTML");

    const noticias = [];
    const artigos = doc.querySelectorAll("article.tileItem");

    for (const el of Array.from(artigos).slice(0, CONFIG.maxNoticias)) {
      try {
        const title = el.querySelector("h2.tileHeadline a")?.textContent?.trim() || "Sem título";
        const link = el.querySelector("h2.tileHeadline a")?.getAttribute("href") || "#";
        
        const dateIcon = el.querySelector("span.summary-view-icon i.icon-day");
        const timeIcon = el.querySelector("span.summary-view-icon i.icon-hour");
        const date = dateIcon?.parentElement?.textContent?.trim().replace(/\s+/g, " ") || "ND";
        const time = timeIcon?.parentElement?.textContent?.trim().replace(/\s+/g, " ") || "ND";
        const dateTime = `${date} ${time}`.replace("ND ND", "").trim();

        const description = el.querySelector("p.tileBody span.description")?.textContent?.trim() || "Sem descrição";
        const image = el.querySelector("div.tileImage img")?.getAttribute("src") || null;

        noticias.push({ 
          title, 
          link, 
          date: dateTime, 
          description, 
          image, 
          type: "texto" 
        });
      } catch (e) {
        console.warn("Erro ao processar notícia:", e);
      }
    }

    return noticias;
  } catch (error) {
    console.error("Erro ao buscar notícias:", error);
    return [];
  }
}

async function fetchVideos() {
  try {
    const res = await fetch(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${CONFIG.youtubeChannelId}`
    );
    const xml = await res.text();
    const parsed = parse(xml, { ignoreAttributes: false });

    const entries = Array.isArray(parsed.feed?.entry) 
      ? parsed.feed.entry 
      : [parsed.feed?.entry].filter(Boolean);

    return entries.slice(0, CONFIG.maxVideos).map((video: any) => {
      const date = video.published ? new Date(video.published) : new Date();
      return {
        title: video.title,
        link: video.link?.["@_href"] || "#",
        date: date.toISOString(), // Já vem como Date válido do YouTube
        description: video["media:group"]?.["media:description"] || "",
        image: video["media:group"]?.["media:thumbnail"]?.["@_url"] || null,
        type: "vídeo",
        dateObj: date
      };
    });
  } catch (error) {
    console.error("Erro ao buscar vídeos:", error);
    return [];
  }
}

// ==================== PROCESSAMENTO PRINCIPAL ====================
async function main() {
  console.log("⏳ Iniciando coleta de dados...");
  
  const [noticias, videos] = await Promise.all([
    fetchNoticias(),
    fetchVideos()
  ]);

  console.log(`✅ ${noticias.length} notícias e ${videos.length} vídeos coletados`);

  // Processa todos os itens garantindo datas válidas
  const conteudos = [...noticias, ...videos].map(item => {
    // Se já tiver dateObj válido (vídeos), usa esse
    if (item.dateObj instanceof Date && !isNaN(item.dateObj.getTime())) {
      const dateInfo = parseCustomDate(item.dateObj);
      return {
        ...item,
        ...dateInfo
      };
    }
    
    // Caso contrário, faz o parse da data string
    const dateInfo = parseCustomDate(item.date);
    return {
      ...item,
      ...dateInfo
    };
  });

  // Ordena por data (mais recente primeiro)
  conteudos.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());

  console.log("⏳ Gerando arquivos...");
  await generateFiles(conteudos);
  console.log("✅ Todos os arquivos foram gerados com sucesso!");
}

// ==================== GERAÇÃO DE ARQUIVOS ====================
async function generateFiles(conteudos: any[]) {
  await Deno.mkdir(CONFIG.outputDir, { recursive: true });
  const generationDate = new Date();

  // 1. HTML SIMPLES (diretório raiz)
  const simpleHtml = `<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8">
  <title>Notícias ANAC</title>
</head>
<body>
  ${conteudos.map(item => 
    `<a href="${item.link}" target="_blank">${item.title}</a> (${item.display}) - ${item.type}</br>`
  ).join('\n')}
</body>
</html>`;

  await Deno.writeTextFile("index.html", simpleHtml);

  // 2. JSON (Schema.org Dataset)
  const jsonData = {
    "@context": ["https://schema.org", "https://www.w3.org/ns/dcat"],
    "@type": "Dataset",
    name: FAIR_METADATA.title,
    description: FAIR_METADATA.description,
    identifier: FAIR_METADATA.identifier,
    url: CONFIG.baseUrl,
    license: FAIR_METADATA.license.url,
    dateCreated: generationDate.toISOString(),
    dateModified: generationDate.toISOString(),
    publisher: {
      "@type": "Organization",
      name: FAIR_METADATA.publisher.name,
      url: FAIR_METADATA.publisher.url
    },
    distribution: [
      {
        "@type": "DataDownload",
        encodingFormat: "application/json",
        contentUrl: "./feed.json"
      }
    ],
    items: conteudos.map(item => ({
      "@type": item.type === "vídeo" ? "VideoObject" : "NewsArticle",
      name: item.title,
      url: item.link,
      datePublished: item.iso,
      description: item.description,
      ...(item.image && { image: item.image })
    }))
  };

  await Deno.writeTextFile(
    `${CONFIG.outputDir}/feed.json`,
    JSON.stringify(jsonData, null, 2)
  );

  // 3. RSS Feed
  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${FAIR_METADATA.title}</title>
    <link>${CONFIG.baseUrl}</link>
    <description>${FAIR_METADATA.description}</description>
    <language>${FAIR_METADATA.language}</language>
    <pubDate>${generationDate.toUTCString()}</pubDate>
    ${conteudos.map(item => `
    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${item.link}</link>
      <description>${escapeXml(item.description)}</description>
      <pubDate>${item.dateObj.toUTCString()}</pubDate>
      <guid>${item.link}</guid>
      ${item.image ? `<enclosure url="${item.image}" type="image/jpeg"/>` : ''}
    </item>
    `).join('\n    ')}
  </channel>
</rss>`;

  await Deno.writeTextFile(`${CONFIG.outputDir}/rss.xml`, rssXml);

  // 4. ATOM Feed
  const atomXml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${FAIR_METADATA.title}</title>
  <link href="${CONFIG.baseUrl}"/>
  <link href="./atom.xml" rel="self"/>
  <id>${FAIR_METADATA.identifier}</id>
  <updated>${conteudos[0]?.dateObj.toISOString() || generationDate.toISOString()}</updated>
  <author>
    <name>${FAIR_METADATA.creator}</name>
  </author>
  ${conteudos.map(item => `
  <entry>
    <title>${escapeXml(item.title)}</title>
    <link href="${item.link}"/>
    <id>${item.link}</id>
    <published>${item.iso}</published>
    <updated>${item.iso}</updated>
    <summary>${escapeXml(item.description)}</summary>
  </entry>
  `).join('\n  ')}
</feed>`;

  await Deno.writeTextFile(`${CONFIG.outputDir}/atom.xml`, atomXml);
}

await main();
