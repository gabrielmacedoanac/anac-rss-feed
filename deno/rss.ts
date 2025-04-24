import { parse } from "https://denopkg.com/ThauEx/deno-fast-xml-parser/mod.ts";
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

// ==================== CONFIGURAÇÕES ====================
const FAIR_METADATA = {
  // Identificação
  title: "Notícias ANAC",
  description: "Feed de notícias e vídeos da Agência Nacional de Aviação Civil",
  identifier: "urn:uuid:anac-feed-2024",

  // Proveniência
  publisher: {
    name: "Agência Nacional de Aviação Civil (ANAC)",
    url: "https://www.gov.br/anac"
  },
  creator: "Divisão de Comunicação Social - ANAC",
  source: "https://www.gov.br/anac/pt-br/noticias",
  generated: new Date().toISOString(),

  // Direitos
  license: {
    name: "Licença Creative Commons Atribuição 4.0",
    url: "https://creativecommons.org/licenses/by/4.0/"
  },
  rights: "Dados abertos para uso público",

  // Classificação
  keywords: ["aviação", "ANAC", "Brasil", "notícias", "regulação aérea"],
  language: "pt-BR",
  coverage: "Brasil",
  version: "2.1"
};

const CONFIG = {
  maxNoticias: 20,
  maxVideos: 15,
  youtubeChannelId: "UC5ynmbMZXolM-jo2hGR31qg",
  baseUrl: "https://www.gov.br/anac/pt-br/noticias",
  outputDir: "data"
};

// ==================== FUNÇÕES AUXILIARES ====================
function formatarData(date: Date): string {
  return date.toISOString();
}

function escapeXml(text: string): string {
  return text.replace(/[<>&'"]/g, char => 
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[char] || char));
}

function parseCustomDate(dateStr: string): { display: string; iso: string; obj: Date } {
  if (!dateStr || dateStr === "ND") {
    const now = new Date();
    return {
      display: now.toLocaleString("pt-BR"),
      iso: now.toISOString(),
      obj: now
    };
  }

  const [datePart, timePart] = dateStr.split(' ');
  const [day, month, year] = datePart.split('/').map(Number);
  const [hours, minutes] = timePart.replace('h', ':').split(':').map(Number);

  const dateObj = new Date(year, month - 1, day, hours || 0, minutes || 0);
  
  return {
    display: dateStr,
    iso: dateObj.toISOString(),
    obj: dateObj
  };
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
          type: "notícia" 
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
        date: date.toLocaleString("pt-BR"),
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

// ==================== GERAÇÃO DE ARQUIVOS ====================
async function generateFiles(conteudos: any[]) {
  await Deno.mkdir(CONFIG.outputDir, { recursive: true });

  // 1. JSON (Schema.org Dataset)
  const jsonData = {
    "@context": ["https://schema.org", "https://www.w3.org/ns/dcat"],
    "@type": "Dataset",
    name: FAIR_METADATA.title,
    description: FAIR_METADATA.description,
    identifier: FAIR_METADATA.identifier,
    url: `${CONFIG.baseUrl}/feed.json`,
    license: FAIR_METADATA.license.url,
    dateCreated: FAIR_METADATA.generated,
    dateModified: new Date().toISOString(),
    publisher: {
      "@type": "Organization",
      name: FAIR_METADATA.publisher.name,
      url: FAIR_METADATA.publisher.url
    },
    creator: {
      "@type": "Organization",
      name: FAIR_METADATA.creator,
      url: FAIR_METADATA.publisher.url
    },
    distribution: [
      {
        "@type": "DataDownload",
        encodingFormat: "application/json",
        contentUrl: `${CONFIG.baseUrl}/feed.json`
      },
      {
        "@type": "DataDownload",
        encodingFormat: "application/rss+xml",
        contentUrl: `${CONFIG.baseUrl}/rss.xml`
      }
    ],
    items: conteudos.map(item => ({
      "@type": item.type === "vídeo" ? "VideoObject" : "NewsArticle",
      headline: item.title,
      url: item.link,
      datePublished: item.dateObj.toISOString(),
      description: item.description,
      ...(item.image && { image: item.image })
    }))
  };

  await Deno.writeTextFile(
    `${CONFIG.outputDir}/feed.json`,
    JSON.stringify(jsonData, null, 2)
  );

  // 2. HTML (Semântico + Microdados)
  const htmlContent = `<!DOCTYPE html>
<html lang="${FAIR_METADATA.language}" prefix="og: https://ogp.me/ns#">
<head>
  <meta charset="UTF-8">
  <title>${FAIR_METADATA.title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${FAIR_METADATA.description}">
  <meta name="generator" content="Deno Feed Generator">
  
  <!-- Schema.org -->
  <script type="application/ld+json">
    ${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: FAIR_METADATA.title,
      description: FAIR_METADATA.description,
      url: CONFIG.baseUrl,
      license: FAIR_METADATA.license.url,
      datePublished: FAIR_METADATA.generated,
      creator: {
        "@type": "Organization",
        name: FAIR_METADATA.creator
      }
    })}
  </script>
</head>
<body>
  <header vocab="https://schema.org/" typeof="Dataset">
    <h1 property="name">${FAIR_METADATA.title}</h1>
    <p property="description">${FAIR_METADATA.description}</p>
    <p>Fonte: <a property="url" href="${CONFIG.baseUrl}">${CONFIG.baseUrl}</a></p>
    <p>Licença: <a property="license" href="${FAIR_METADATA.license.url}">${FAIR_METADATA.license.name}</a></p>
  </header>

  <main>
    ${conteudos.map(item => `
    <article typeof="${item.type === 'vídeo' ? 'VideoObject' : 'NewsArticle'}">
      <h2 property="headline"><a property="url" href="${item.link}">${item.title}</a></h2>
      <p><time property="datePublished" datetime="${item.dateObj.toISOString()}">${
        item.dateObj.toLocaleDateString("pt-BR")
      }</time> | <span property="genre">${item.type}</span></p>
      ${item.image ? `<img property="image" src="${item.image}" alt="${item.title}" width="300">` : ''}
      <div property="description">${item.description}</div>
    </article>
    `).join('\n')}
  </main>

  <footer>
    <p>Última atualização: <time datetime="${new Date().toISOString()}">${
      new Date().toLocaleString("pt-BR")
    }</time></p>
    <p><small>${FAIR_METADATA.rights}</small></p>
  </footer>
</body>
</html>`;

  await Deno.writeTextFile(`${CONFIG.outputDir}/index.html`, htmlContent);

  // 3. RSS Feed
  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${FAIR_METADATA.title}</title>
    <link>${CONFIG.baseUrl}</link>
    <description>${FAIR_METADATA.description}</description>
    <language>${FAIR_METADATA.language}</language>
    <pubDate>${new Date().toUTCString()}</pubDate>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <generator>Deno Feed Generator</generator>
    <docs>https://www.rssboard.org/rss-specification</docs>
    <managingEditor>${FAIR_METADATA.creator} (${FAIR_METADATA.publisher.name})</managingEditor>
    <webMaster>${FAIR_METADATA.creator}</webMaster>
    <copyright>${FAIR_METADATA.rights}</copyright>
    <image>
      <url>https://www.gov.br/anac/++theme++padrao_govbr/img/govbr-colorido-bg.png</url>
      <title>${FAIR_METADATA.title}</title>
      <link>${CONFIG.baseUrl}</link>
    </image>
    
    ${conteudos.map(item => `
    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${item.link}</link>
      <description>${escapeXml(item.description)}</description>
      <pubDate>${item.dateObj.toUTCString()}</pubDate>
      <guid isPermaLink="true">${item.link}</guid>
      <dc:creator>${FAIR_METADATA.creator}</dc:creator>
      <dc:date>${item.dateObj.toISOString()}</dc:date>
      ${item.image ? `<enclosure url="${item.image}" type="image/jpeg" length="0"/>` : ''}
      <content:encoded><![CDATA[
        <p>${item.description}</p>
        ${item.image ? `<img src="${item.image}" alt="${item.title}">` : ''}
      ]]></content:encoded>
    </item>
    `).join('\n    ')}
  </channel>
</rss>`;

  await Deno.writeTextFile(`${CONFIG.outputDir}/rss.xml`, rssXml);

  // 4. ATOM Feed
  const atomXml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <title>${FAIR_METADATA.title}</title>
  <subtitle>${FAIR_METADATA.description}</subtitle>
  <link href="${CONFIG.baseUrl}" rel="alternate"/>
  <link href="${CONFIG.baseUrl}/atom.xml" rel="self"/>
  <id>${FAIR_METADATA.identifier}</id>
  <updated>${conteudos[0]?.dateObj.toISOString() || new Date().toISOString()}</updated>
  <author>
    <name>${FAIR_METADATA.creator}</name>
    <uri>${FAIR_METADATA.publisher.url}</uri>
  </author>
  <rights>${FAIR_METADATA.rights}</rights>
  
  ${conteudos.map(item => `
  <entry>
    <title type="html">${escapeXml(item.title)}</title>
    <link href="${item.link}" rel="alternate"/>
    <id>${item.link}</id>
    <published>${item.dateObj.toISOString()}</published>
    <updated>${item.dateObj.toISOString()}</updated>
    <author>
      <name>${FAIR_METADATA.creator}</name>
    </author>
    <summary type="html">${escapeXml(item.description)}</summary>
    <content type="html"><![CDATA[
      <p>${item.description}</p>
      ${item.image ? `<img src="${item.image}" alt="${item.title}">` : ''}
    ]]></content>
    <dc:publisher>${FAIR_METADATA.publisher.name}</dc:publisher>
  </entry>
  `).join('\n  ')}
</feed>`;

  await Deno.writeTextFile(`${CONFIG.outputDir}/atom.xml`, atomXml);
}

// ==================== EXECUÇÃO PRINCIPAL ====================
async function main() {
  console.log("⏳ Iniciando coleta de dados...");
  
  const [noticias, videos] = await Promise.all([
    fetchNoticias(),
    fetchVideos()
  ]);

  console.log(`✅ ${noticias.length} notícias e ${videos.length} vídeos coletados`);

  const conteudos = [...noticias, ...videos]
    .map(item => ({
      ...item,
      ...parseCustomDate(item.date),
      dateObj: item.dateObj || new Date()
    }))
    .sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());

  console.log("⏳ Gerando arquivos FAIR...");
  await generateFiles(conteudos);
  console.log("✅ Todos os arquivos foram gerados com sucesso!");
}

await main();
