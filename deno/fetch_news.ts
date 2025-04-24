// deno run --allow-net --allow-write deno/fetch_news.ts

import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

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

// Garante que a pasta data/ exista
await Deno.mkdir("data", { recursive: true });

// Salva JSON
await Deno.writeTextFile("data/news.json", JSON.stringify(noticias, null, 2));

// Gera HTML simples
const htmlContent = `
<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8">
  <title>Notícias ANAC</title>
</head>
<body>
  <h1>Últimas Notícias da ANAC</h1>
  <ul>
    ${noticias.map(n => `<li><a href="${n.link}">${n.title}</a> (${n.date})</li>`).join("\n")}
  </ul>
</body>
</html>
`;
await Deno.writeTextFile("data/index.html", htmlContent);

// Gera RSS/XML
const rssItems = noticias.map(n => {
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

try {
  await Deno.writeTextFile("data/rss.xml", rssXml);
  console.log("✅ RSS salvo com sucesso em data/rss.xml");
} catch (err) {
  console.error("❌ Erro ao salvar rss.xml:", err);
}
