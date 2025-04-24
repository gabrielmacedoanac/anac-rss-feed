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

// Converte ISO 8601 para "DD/MM/YYYY HHhMM"
function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}h${pad(d.getMinutes())}`;
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
    const date = video.published ? formatDate(video.published) : "ND";
    return {
      title: video.title,
      link: video.link?.["@_href"] || video.link?.["@_url"],
      date,
      description: video["media:group"]?.["media:description"] || "",
      image: video["media:group"]?.["media:thumbnail"]?.["@_url"] || null,
      type: "vídeo",
    };
  });
}

// Adiciona vídeos ao feed
const youtubeChannelId = "UC5ynmbMZXolM-jo2hGR31qg";
const youtubeVideos = await fetchYouTubeVideos(youtubeChannelId);

// Combina e ordena os conteúdos por data decrescente
const conteudos = [...noticias, ...youtubeVideos].sort((a, b) => {
  const d1 = new Date(b.date);
  const d2 = new Date(a.date);
  return d1.getTime() - d2.getTime();
});

// Garante que a pasta data/ exista
await Deno.mkdir("data", { recursive: true });

// Salva JSON
await Deno.writeTextFile("data/feed.json", JSON.stringify(conteudos, null, 2));

// Gera HTML simples
const htmlContent = `
<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8">
  <title>Notícias ANAC</title>
</head>
<body>
  ${conteudos.map(n => `<a href="${n.link}">${n.title}</a> (${n.date}) - ${n.type}</br>`).join("\n")}
</body>
</html>
`;
await Deno.writeTextFile("index.html", htmlContent);
await Deno.writeTextFile("data/index.html", htmlContent);

// Gera RSS/XML
const rssItems = conteudos.map(n => {
  let pubDate;
  try {
    pubDate = new Date(n.date).toUTCString();
    if (pubDate === 'Invalid Date') throw new Error();
  } catch {
    pubDate = new Date().toUTCString();
  }

  return `
  <item>
    <title><![CDATA[${n.title}]]></title>
    <link>${n.link}</link>
    <description><![CDATA[${n.description}]]></description>
    <pubDate>${pubDate}</pubDate>
  </item>`;
}).join("\n");

const rssXml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>Notícias ANAC</title>
    <link>https://www.gov.br/anac/pt-br/noticias</link>
    <description>Últimas notícias da Agência Nacional de Aviação Civil</description>
    ${rssItems}
  </channel>
</rss>`;
await Deno.writeTextFile("data/rss.xml", rssXml);

// Gera ATOM
const atomItems = conteudos.map(n => {
  const id = n.link;
  let updated;
  try {
    updated = new Date(n.date).toISOString();
    if (updated === 'Invalid Date') throw new Error();
  } catch {
    updated = new Date().toISOString();
  }

  return `
  <entry>
    <title><![CDATA[${n.title}]]></title>
    <link href="${n.link}" />
    <id>${id}</id>
    <updated>${updated}</updated>
    <summary><![CDATA[${n.description}]]></summary>
  </entry>`;
}).join("\n");

const atomXml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Notícias ANAC</title>
  <link href="https://www.gov.br/anac/pt-br/noticias"/>
  <updated>${new Date().toISOString()}</updated>
  <id>https://www.gov.br/anac/pt-br/noticias</id>
  ${atomItems}
</feed>`;
await Deno.writeTextFile("data/atom.xml", atomXml);
