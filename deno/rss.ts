import { parse } from "https://denopkg.com/ThauEx/deno-fast-xml-parser/mod.ts";
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

// Configurações
const MAX_NOTICIAS = 20;
const MAX_VIDEOS = 20;
const YOUTUBE_CHANNEL_ID = "UC5ynmbMZXolM-jo2hGR31qg";
const NEWS_URL = "https://www.gov.br/anac/pt-br/noticias";

// Utilitário de data - Converte tudo para UTC
class DateUtils {
  static parseBRDate(dateStr: string): Date | null {
    const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})/);
    if (!match) return null;
    
    const [, day, month, year, hours, minutes] = match;
    const date = new Date(Date.UTC(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hours),
      parseInt(minutes)
    ));
    
    return isNaN(date.getTime()) ? null : date;
  }

  static toUTCString(date: Date): string {
    return date.toISOString();
  }

  static formatForDisplay(date: Date): string {
    return date.toLocaleString("pt-BR", {
      timeZone: "UTC",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }
}

// Busca notícias
async function fetchNoticias() {
  const res = await fetch(NEWS_URL, { headers: { "User-Agent": "Mozilla/5.0" } });
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  
  if (!doc) throw new Error("Falha ao parsear HTML");

  const noticias = [];
  const artigos = doc.querySelectorAll("article.tileItem");

  for (let i = 0; i < Math.min(MAX_NOTICIAS, artigos.length); i++) {
    const el = artigos[i];
    try {
      const title = el.querySelector("h2.tileHeadline a")?.textContent?.trim() || "Sem título";
      const link = el.querySelector("h2.tileHeadline a")?.getAttribute("href") || "#";
      
      const dateStr = [
        el.querySelector("span.summary-view-icon i.icon-day")?.parentElement?.textContent?.trim(),
        el.querySelector("span.summary-view-icon i.icon-hour")?.parentElement?.textContent?.trim()
      ].filter(Boolean).join(" ");

      const date = DateUtils.parseBRDate(dateStr) || new Date(0);
      const description = el.querySelector("p.tileBody span.description")?.textContent?.trim() || "Sem descrição";
      const image = el.querySelector("div.tileImage img")?.getAttribute("src") || null;

      noticias.push({ 
        title, 
        link, 
        date: DateUtils.toUTCString(date),
        displayDate: DateUtils.formatForDisplay(date),
        description, 
        image, 
        type: "notícia" 
      });
    } catch (e) {
      console.warn("Erro ao processar notícia:", e);
    }
  }
  return noticias;
}

// Busca vídeos do YouTube
async function fetchVideos() {
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`);
  const xml = await res.text();
  const parsed = parse(xml, { ignoreAttributes: false });

  const entries = Array.isArray(parsed.feed?.entry) ? parsed.feed.entry : [parsed.feed?.entry].filter(Boolean);
  
  return entries.slice(0, MAX_VIDEOS).map((video: any) => {
    const date = new Date(video.published || 0);
    return {
      title: video.title || "Sem título",
      link: video.link?.["@_href"] || video.link?.["@_url"] || "#",
      date: DateUtils.toUTCString(date),
      displayDate: DateUtils.formatForDisplay(date),
      description: video["media:group"]?.["media:description"] || "",
      image: video["media:group"]?.["media:thumbnail"]?.["@_url"] || null,
      type: "vídeo"
    };
  });
}

// Processamento principal
async function main() {
  try {
    const [noticias, videos] = await Promise.all([
      fetchNoticias(),
      fetchVideos()
    ]);

    // Combina e ordena por data UTC
    const conteudos = [...noticias, ...videos].sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    // Gera saídas
    await Deno.mkdir("data", { recursive: true });
    
    // JSON
    await Deno.writeTextFile("data/feed.json", JSON.stringify(conteudos, null, 2));

    // HTML
    const htmlContent = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Notícias ANAC</title></head>
<body>
  ${conteudos.map(item => `
    <article>
      <h2><a href="${item.link}">${item.title}</a></h2>
      <time>${item.displayDate}</time>
      <p>${item.description}</p>
      ${item.image ? `<img src="${item.image}" alt="" width="200">` : ''}
      <span>${item.type}</span>
    </article>
  `).join('')}
</body></html>`;
    
    await Deno.writeTextFile("data/index.html", htmlContent);
    await Deno.writeTextFile("index.html", htmlContent);

    // RSS
    const rssItems = conteudos.map(item => `
      <item>
        <title><![CDATA[${item.title}]]></title>
        <link>${item.link}</link>
        <description><![CDATA[${item.description}]]></description>
        <pubDate>${new Date(item.date).toUTCString()}</pubDate>
      </item>
    `).join('');

    await Deno.writeTextFile("data/rss.xml", `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Notícias ANAC</title>
    <link>${NEWS_URL}</link>
    <description>Conteúdo agregado da ANAC</description>
    ${rssItems}
  </channel>
</rss>`);

    // ATOM
    const atomEntries = conteudos.map(item => `
      <entry>
        <title>${item.title}</title>
        <link href="${item.link}"/>
        <updated>${new Date(item.date).toISOString()}</updated>
        <summary>${item.description}</summary>
      </entry>
    `).join('');

    await Deno.writeTextFile("data/atom.xml", `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Notícias ANAC</title>
  <link href="${NEWS_URL}"/>
  <updated>${new Date().toISOString()}</updated>
  ${atomEntries}
</feed>`);

    console.log("✅ Conteúdo gerado com sucesso!");
  } catch (error) {
    console.error("❌ Erro:", error);
    Deno.exit(1);
  }
}

await main();