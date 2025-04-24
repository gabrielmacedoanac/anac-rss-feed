// deno run --allow-net --allow-write deno/rss.ts

import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";
import { XMLParser } from "https://deno.land/x/xml_parser@1.0.0/mod.ts";

// Canal da ANAC no YouTube
const youtubeRssUrl = "https://www.youtube.com/feeds/videos.xml?channel_id=UC5ynmbMZXolM-jo2hGR31qg";

async function fetchYoutubeRSS(url: string) {
  const response = await fetch(url);
  const xmlText = await response.text();

  const parser = new XMLParser();
  const parsed = parser.parse(xmlText);

  const entries = parsed.feed?.entry ?? [];
  const videos = [];

  for (const entry of entries) {
    try {
      const title = entry.title ?? "Sem título";
      const link = entry.link?.["@_href"] ?? "#";
      const date = entry.published ?? "";
      const description = entry["media:group"]?.["media:description"] ?? "Sem descrição";
      const image = entry["media:group"]?.["media:thumbnail"]?.["@_url"] ?? null;

      videos.push({ title, link, date, description, image });
    } catch (e) {
      console.warn("⚠️ Erro ao processar vídeo:", e);
    }
  }

  return videos;
}

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

for (let i = 0; i < Math.min(30, artigos.length); i++) {
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

    noticias.push({ title, link, date: dateTime, description, image });
  } catch (e) {
    console.warn("⚠️ Erro ao processar item:", e);
  }
}

// Junta com vídeos do canal do YouTube
const videos = await fetchYoutubeRSS(youtubeRssUrl);
const conteudoFinal = [...noticias, ...videos];

// Garante que a pasta data/ exista
await Deno.mkdir("data", { recursive: true });

// Salva JSON
await Deno.writeTextFile("data/feed.json", JSON.stringify(conteudoFinal, null, 2));

// Gera HTML simples
const htmlContent = `
<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8">
  <title>Notícias ANAC</title>
</head>
<body>
  ${conteudoFinal.map(n => `<a href="${n.link}">${n.title}</a> (${n.date})</br>`).join("\n")}
</body>
</html>
`;
await Deno.writeTextFile("index.html", htmlContent);
await Deno.writeTextFile("data/index.html", htmlContent);

// Gera RSS/XML
const rssItems = conteudoFinal.map(n => {
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
const atomItems = conteudoFinal.map(n => {
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
