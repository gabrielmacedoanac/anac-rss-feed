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

function parseCustomDate(dateInput: Date | string): { display: string; iso: string; obj: Date } {
  const now = new Date();
  
  // Fallback padrão
  const fallback = {
    display: now.toLocaleString("pt-BR"),
    iso: now.toISOString(),
    obj: now
  };

  // Se já for um objeto Date válido
  if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
    return {
      display: dateInput.toLocaleString("pt-BR"),
      iso: dateInput.toISOString(),
      obj: dateInput
    };
  }

  // Se for string vazia
  if (typeof dateInput !== 'string' || !dateInput || dateInput === "ND") {
    return fallback;
  }

  try {
    // Formato "DD/MM/YYYY HHhMM"
    if (/^\d{2}\/\d{2}\/\d{4} \d{2}h\d{2}$/.test(dateInput)) {
      const [datePart, timePart] = dateInput.split(' ');
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

    // Tenta parsear como ISO string
    const dateObj = new Date(dateInput);
    if (!isNaN(dateObj.getTime())) {
      return {
        display: dateObj.toLocaleString("pt-BR"),
        iso: dateObj.toISOString(),
        obj: dateObj
      };
    }

    throw new Error(`Formato não reconhecido: ${dateInput}`);
  } catch (e) {
    console.warn(`⚠️ Erro ao parsear data:`, e.message);
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
        date: date, // Passamos o objeto Date diretamente
        description: video["media:group"]?.["media:description"] || "",
        image: video["media:group"]?.["media:thumbnail"]?.["@_url"] || null,
        type: "vídeo"
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
    const dateInfo = parseCustomDate(item.date);
    return {
      ...item,
      display: dateInfo.display,
      iso: dateInfo.iso,
      dateObj: dateInfo.obj
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

  // 2. HTML SEMÂNTICO (data/index.html)
  const semanticHtml = `<!DOCTYPE html>
<html lang="pt-br" vocab="https://schema.org/">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${FAIR_METADATA.title}</title>
  <meta name="description" content="${FAIR_METADATA.description}">
  <script type="application/ld+json">
    ${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": FAIR_METADATA.title,
      "description": FAIR_METADATA.description,
      "publisher": {
        "@type": "Organization",
        "name": FAIR_METADATA.publisher.name,
        "url": FAIR_METADATA.publisher.url
      }
    })}
  </script>
</head>
<body>
  <header typeof="WPHeader">
    <h1 property="name">${FAIR_METADATA.title}</h1>
    <p property="description">${FAIR_METADATA.description}</p>
    <p>Atualizado em: <time datetime="${generationDate.toISOString()}">${generationDate.toLocaleString("pt-BR")}</time></p>
  </header>

  <main>
    ${conteudos.map(item => `
    <article typeof="${item.type === 'vídeo' ? 'VideoObject' : 'NewsArticle'}">
      <h2 property="headline"><a property="url" href="${item.link}">${item.title}</a></h2>
      <p><time property="datePublished" datetime="${item.iso}">${item.display}</time> | 
         <span property="genre">${item.type}</span></p>
      ${item.image ? `<img property="image" src="${item.image}" alt="${item.title}" width="300">` : ''}
      <p property="description">${item.description}</p>
    </article>
    `).join('\n    ')}
  </main>

  <footer typeof="WPFooter">
    <p><small>${FAIR_METADATA.rights}</small></p>
  </footer>
</body>
</html>`;

  await Deno.writeTextFile(`${CONFIG.outputDir}/index.html`, semanticHtml);

  // 3. JSON (Schema.org Dataset)
  const jsonData = {
    "@context": ["https://schema.org", "https://www.w3.org/ns/dcat"],
    "@type": "Dataset",
    "name": FAIR_METADATA.title,
    "description": FAIR_METADATA.description,
    "license": FAIR_METADATA.license.url,
    "dateModified": generationDate.toISOString(),
    "distribution": conteudos.map(item => ({
      "@type": "DataDownload",
      "encodingFormat": item.type === "vídeo" ? "video/mp4" : "text/html",
      "contentUrl": item.link,
      "datePublished": item.iso
    }))
  };

  await Deno.writeTextFile(
    `${CONFIG.outputDir}/feed.json`,
    JSON.stringify(jsonData, null, 2)
  );

  // 4. RSS Feed
  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${FAIR_METADATA.title}</title>
    <link>${CONFIG.baseUrl}</link>
    <description>${FAIR_METADATA.description}</description>
    <lastBuildDate>${generationDate.toUTCString()}</lastBuildDate>
    ${conteudos.map(item => `
    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${item.link}</link>
      <description>${escapeXml(item.description)}</description>
      <pubDate>${new Date(item.iso).toUTCString()}</pubDate>
      <guid isPermaLink="true">${item.link}</guid>
      ${item.image ? `<enclosure url="${item.image}" type="image/jpeg"/>` : ''}
    </item>
    `).join('\n    ')}
  </channel>
</rss>`;

  await Deno.writeTextFile(`${CONFIG.outputDir}/rss.xml`, rssXml);

  // 5. ATOM Feed
  const atomXml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${FAIR_METADATA.title}</title>
  <subtitle>${FAIR_METADATA.description}</subtitle>
  <link href="${CONFIG.baseUrl}"/>
  <link href="./atom.xml" rel="self"/>
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
    <summary type="html">${escapeXml(item.description)}</summary>
  </entry>
  `).join('\n  ')}
</feed>`;

  await Deno.writeTextFile(`${CONFIG.outputDir}/atom.xml`, atomXml);
}

await main();
