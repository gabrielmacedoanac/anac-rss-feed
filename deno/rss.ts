// deno run --allow-net --allow-write deno/rss.ts

import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";
import { parse } from "https://denopkg.com/ThauEx/deno-fast-xml-parser/mod.ts";

const NUM_NOTICIAS = 20;
const NUM_VIDEOS = 10;

async function main() {
  const noticias = await fetchNoticias();
  const videos = await fetchVideos();

  const todos = [...noticias, ...videos];

  // Ordena pela data (mais recente primeiro)
  todos.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  await Deno.mkdir("data", { recursive: true });
  await Deno.writeTextFile("data/feed.json", JSON.stringify(todos, null, 2));

  const html = geraHTML(todos);
  await Deno.writeTextFile("index.html", html);
  await Deno.writeTextFile("data/index.html", html);

  const rss = geraRSS(todos);
  await Deno.writeTextFile("data/rss.xml", rss);

  const atom = geraATOM(todos);
  await Deno.writeTextFile("data/atom.xml", atom);
}

async function fetchNoticias() {
  const url = "https://www.gov.br/anac/pt-br/noticias";
  const headers = { "User-Agent": "Mozilla/5.0" };
  const res = await fetch(url, { headers });
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) throw new Error("Erro ao parsear HTML");

  const artigos = doc.querySelectorAll("article.tileItem");
  const noticias = [];

  for (let i = 0; i < Math.min(NUM_NOTICIAS, artigos.length); i++) {
    const el = artigos[i];
    try {
      const titleElem = el.querySelector("h2.tileHeadline a");
      const title = titleElem?.textContent?.trim() || "Sem título";
      const link = titleElem?.getAttribute("href") || "#";

      const dateIcon = el.querySelector("span.summary-view-icon i.icon-day");
      const timeIcon = el.querySelector("span.summary-view-icon i.icon-hour");
      const date = dateIcon?.parentElement?.textContent?.trim().replace(/\s+/g, " ") || "ND";
      const time = timeIcon?.parentElement?.textContent?.trim().replace(/\s+/g, " ") || "ND";
      const dateTime = new Date(`${date} ${time}`.replace("ND ND", "").trim()).toISOString();

      const descElem = el.querySelector("p.tileBody span.description");
      const description = descElem?.textContent?.trim() || "Sem descrição";

      const imgElem = el.querySelector("div.tileImage img");
      const image = imgElem?.getAttribute("src") || null;

      noticias.push({ type: "noticia", title, link, date: dateTime, description, image });
    } catch (e) {
      console.warn("⚠️ Erro ao processar item de notícia:", e);
    }
  }

  return noticias;
}

async function fetchVideos() {
  const feedUrl = "https://www.youtube.com/feeds/videos.xml?channel_id=UC5ynmbMZXolM-jo2hGR31qg";
  const res = await fetch(feedUrl);
  const xml = await res.text();
  const parsed = parse(xml, { ignoreAttributes: false });

  const entries = parsed.feed?.entry || [];
  const videos = [];

  for (let i = 0; i < Math.min(NUM_VIDEOS, entries.length); i++) {
    const v = entries[i];
    try {
      const title = v.title;
      const link = Array.isArray(v.link) ? v.link[0]["@_href"] : v.link["@_href"];
      const description = v["media:group"]?.["media:description"] || "Sem descrição";
      const published = new Date(v.published).toISOString();

      videos.push({ type: "video", title, link, date: published, description });
    } catch (e) {
      console.warn("⚠️ Erro ao processar vídeo:", e);
    }
  }

  return videos;
}

function geraHTML(itens) {
  return `
<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8">
  <title>Notícias e Vídeos ANAC</title>
</head>
<body>
  ${itens.map(n => `<a href="${n.link}">${n.title} (${n.type === 'video' ? 'vídeo' : 'texto'})</a> (${n.date})</br>`).join("\n")}
</body>
</html>`;
}

function geraRSS(itens) {
  const rssItems = itens.map(n => {
    let pubDate;
    try {
      pubDate = new Date(n.date).toUTCString();
    } catch {
      pubDate = new Date().toUTCString();
    }

    return `
    <item>
      <title><![CDATA[${n.title} (${n.type === 'video' ? 'vídeo' : 'texto'})]]></title>
      <link>${n.link}</link>
      <description><![CDATA[${n.description}]]></description>
      <pubDate>${pubDate}</pubDate>
    </item>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>Notícias e Vídeos ANAC</title>
    <link>https://www.gov.br/anac/pt-br/noticias</link>
    <description>Últimas atualizações da Agência Nacional de Aviação Civil</description>
    ${rssItems}
  </channel>
</rss>`;
}

function geraATOM(itens) {
  const atomItems = itens.map(n => {
    const id = n.link;
    let updated;
    try {
      updated = new Date(n.date).toISOString();
    } catch {
      updated = new Date().toISOString();
    }

    return `
    <entry>
      <title><![CDATA[${n.title} (${n.type === 'video' ? 'vídeo' : 'texto'})]]></title>
      <link href="${n.link}" />
      <id>${id}</id>
      <updated>${updated}</updated>
      <summary><![CDATA[${n.description}]]></summary>
    </entry>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Notícias e Vídeos ANAC</title>
  <link href="https://www.gov.br/anac/pt-br/noticias"/>
  <updated>${new Date().toISOString()}</updated>
  <id>https://www.gov.br/anac/pt-br/noticias</id>
  ${atomItems}
</feed>`;
}

main();
