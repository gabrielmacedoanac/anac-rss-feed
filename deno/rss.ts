import { parse } from "https://denopkg.com/ThauEx/deno-fast-xml-parser/mod.ts";
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

// Variáveis para definir quantos vídeos e notícias serão recuperados
const maxNoticias = 20; // Quantidade de notícias a recuperar
const maxVideos = 20;    // Quantidade de vídeos a recuperar

// URL de origem
const url = "https://www.gov.br/anac/pt-br/noticias";
const headers = { "User-Agent": "Mozilla/5.0" };

// Faz a requisição
const res = await fetch(url, { headers });
const html = await res.text();

// Parse do HTML
const doc = new DOMParser().parseFromString(html, "text/html");
if (!doc) {
  console.error("❌ Erro ao parsear HTML");
  Deno.exit(1);
}

// Extrai notícias
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

// Converte "DD/MM/YYYY HHhMM" para Date e para string formatada
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

// Função para buscar vídeos do canal da ANAC no YouTube
async function fetchYouTubeVideos(channelId: string) {
  const youtubeFeedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
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

// Adiciona vídeos ao feed
const youtubeChannelId = "UC5ynmbMZXolM-jo2hGR31qg";
const youtubeVideos = await fetchYouTubeVideos(youtubeChannelId);

// Processa as notícias para incluir o objeto Date
const processedNoticias = noticias.map(n => {
  const { formatted, dateObj } = parseCustomDate(n.date);
  return { ...n, date: formatted, dateObj };
});

// Combina e ordena os conteúdos por data decrescente
const conteudos = [...processedNoticias, ...youtubeVideos].sort((a, b) => {
  return b.dateObj.getTime() - a.dateObj.getTime();
});

// Garante que a pasta data/ exista
await Deno.mkdir("data", { recursive: true });

// Salva JSON
await Deno.writeTextFile("data/feed.json", JSON.stringify(conteudos.map(c => ({
  ...c,
  date: c.date,
  // Removemos dateObj do JSON para não poluir a saída
  dateObj: undefined
})), null, 2));

// Gera HTML simples
const htmlContent = `
<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8">
  <title>Notícias ANAC</title>
</head>
<body>
  ${conteudos.map(n => `<a href="${n.link}" target="_blank">${n.title}</a> (${n.date}) - ${n.type}</br>`).join("\n")}
</body>
</html>
`;
await Deno.writeTextFile("index.html", htmlContent);
await Deno.writeTextFile("data/index.html", htmlContent);

// Gera RSS/XML com datas corretas
const rssItems = conteudos.map(n => {
  // Garante que a data está no formato correto para RSS (RFC 2822)
  const pubDate = n.dateObj.toUTCString();
  
  return `
  <item>
    <title><![CDATA[${n.title}]]></title>
    <link>${n.link}</link>
    <description><![CDATA[${n.description}]]></description>
    <pubDate>${pubDate}</pubDate>
    <guid isPermaLink="true">${n.link}</guid>
    <dc:date>${n.dateObj.toISOString()}</dc:date>
  </item>`;
}).join("\n");

const rssXml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Notícias ANAC</title>
    <link>https://www.gov.br/anac/pt-br/noticias</link>
    <description>Últimas notícias da Agência Nacional de Aviação Civil</description>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${rssItems}
  </channel>
</rss>`;
await Deno.writeTextFile("data/rss.xml", rssXml);

// Gera ATOM com datas corretas
const atomItems = conteudos.map(n => {
  // Usa a data correta no formato ISO
  const updated = n.dateObj.toISOString();
  
  return `
  <entry>
    <title type="html"><![CDATA[${n.title}]]></title>
    <link rel="alternate" type="text/html" href="${n.link}" />
    <id>urn:uuid:${n.link}</id>
    <updated>${updated}</updated>
    <published>${updated}</published>
    <summary type="html"><![CDATA[${n.description}]]></summary>
  </entry>`;
}).join("\n");

// Usa a data do item mais recente para o feed
const feedUpdated = conteudos.length > 0 ? conteudos[0].dateObj.toISOString() : new Date().toISOString();

const atomXml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Notícias ANAC</title>
  <link href="https://www.gov.br/anac/pt-br/noticias"/>
  <updated>${feedUpdated}</updated>
  <id>urn:uuid:https://www.gov.br/anac/pt-br/noticias</id>
  ${atomItems}
</feed>`;
await Deno.writeTextFile("data/atom.xml", atomXml);