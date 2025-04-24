// deno run --allow-net --allow-write deno/rss.ts

import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

// ---------- FUNÇÃO: Coleta de notícias do site da ANAC ----------
async function fetchNoticias() {
  const url = "https://www.gov.br/anac/pt-br/noticias";
  const headers = { "User-Agent": "Mozilla/5.0" };
  const res = await fetch(url, { headers });
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, "text/html");

  if (!doc) {
    console.error("❌ Erro ao parsear HTML");
    Deno.exit(1);
  }

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

      noticias.push({ type: "noticia", title, link, date: dateTime, description, image });
    } catch (e) {
      console.warn("⚠️ Erro ao processar item:", e);
    }
  }

  return noticias;
}

// ---------- FUNÇÃO: Coleta de vídeos do canal da ANAC ----------
async function fetchYoutubeVideos() {
  const ytFeedUrl = "https://www.youtube.com/feeds/videos.xml?channel_id=UC5ynmbMZXolM-jo2hGR31qg";
  const ytFeedText = await fetch(ytFeedUrl).then(res => res.text());
  const ytFeedXml = new DOMParser().parseFromString(ytFeedText, "application/xml");

  const videos = [];

  if (ytFeedXml) {
    const entries = ytFeedXml.querySelectorAll("entry");
    for (let i = 0; i < Math.min(10, entries.length); i++) {
      const entry = entries[i];
      const title = entry.querySelector("title")?.textContent || "Sem título";
      const link = entry.querySelector("link")?.getAttribute("href") || "#";
      const published = entry.querySelector("published")?.textContent || new Date().toISOString();
      const description = entry.querySelector("media\\:description")?.textContent || "Vídeo no canal da ANAC";
      const image = entry.querySelector("media\\:thumbnail")?.getAttribute("url");

      videos.push({
        type: "video",
        title,
        link,
        date: published,
        description,
        image
      });
    }
  }

  return videos;
}

// ---------- EXECUÇÃO PRINCIPAL ----------

const noticias = await fetchNoticias();
const videos = await fetchYoutubeVideos();
const todosItens = [...noticias, ...videos].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

// Garante pasta
await Deno.mkdir("data", { recursive: true });

// JSON
await Deno.writeTextFile("data/feed.json", JSON.stringify(todosItens, null, 2));

// HTML simples
const htmlContent = `
<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8">
  <title>Notícias e Vídeos ANAC</title>
</head>
<body>
  ${todosItens.map(n => `<a href="${n.link}">${n.title}</a> (${n.date}) [${n.type}]<br>`).join("\n")}
</body>
</html>
`;
await Deno.writeTextFile("index.html", htmlContent);
await Deno.writeTextFile("data/index.html", htmlContent);

// RSS
const rssItems = todosItens.map(n => {
  let pubDate;
  try {
    pubDate = new Date(n.date).toUTCString();
    if (pubDate === "Invalid Date") throw new Error();
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
    <title>Notícias e Vídeos ANAC</title>
    <link>https://www.gov.br/anac/pt-br/noticias</link>
    <description>Últimos conteúdos da Agência Nacional de Aviação Civil</description>
    ${rssItems}
  </channel>
</rss>`;
await Deno.writeTextFile("data/rss.xml", rssXml);

// ATOM
const atomItems = todosItens.map(n => {
  const id = n.link;
  let updated;
  try {
    updated = new Date(n.date).toISOString();
    if (updated === "Invalid Date") throw new Error();
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
  <title>Notícias e Vídeos ANAC</title>
  <link href="https://www.gov.br/anac/pt-br/noticias"/>
  <updated>${new Date().toISOString()}</updated>
  <id>https://www.gov.br/anac/pt-br/noticias</id>
  ${atomItems}
</feed>`;
await Deno.writeTextFile("data/atom.xml", atomXml);
