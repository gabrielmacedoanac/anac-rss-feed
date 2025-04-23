// deno/fetch_news.ts
import { DOMParser, Element } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";
import { writeTextFile } from "https://deno.land/std/fs/mod.ts";

const url = "https://www.gov.br/anac/pt-br/noticias";
const res = await fetch(url, {
  headers: { "User-Agent": "Mozilla/5.0" }
});
const html = await res.text();
const document = new DOMParser().parseFromString(html, "text/html");

if (!document) throw new Error("Erro ao carregar DOM");

const articles = document.querySelectorAll("article.tileItem");
const noticias = [];

for (let i = 0; i < Math.min(articles.length, 30); i++) {
  const article = articles[i] as Element;
  const titleElem = article.querySelector("h2.tileHeadline a");
  const dateElem = article.querySelector("span.summary-view-icon i.icon-day");
  const timeElem = article.querySelector("span.summary-view-icon i.icon-hour");
  const descElem = article.querySelector("p.tileBody span.description");
  const imgElem = article.querySelector("div.tileImage img");

  const title = titleElem?.textContent.trim() ?? "Sem título";
  const link = titleElem?.getAttribute("href") ?? "#";
  const date = dateElem?.nextSibling?.textContent.trim() ?? "ND";
  const time = timeElem?.nextSibling?.textContent.trim().replace("h", ":") ?? "ND";
  const description = descElem?.textContent.trim() ?? "Sem descrição";
  const image = imgElem?.getAttribute("src") ?? null;

  noticias.push({ title, link, date: `${date} ${time}`, description, image });
}

// JSON
await Deno.writeTextFile("data/noticias.json", JSON.stringify(noticias, null, 2));

// RSS/XML
const rssItems = noticias.map(noticia => `
  <item>
    <title><![CDATA[${noticia.title}]]></title>
    <link>${noticia.link}</link>
    <description><![CDATA[${noticia.description}]]></description>
    <pubDate>${new Date(noticia.date).toUTCString()}</pubDate>
  </item>`).join("\n");

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

// HTML
const htmlDoc = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Notícias ANAC</title>
  <style>
    body { font-family: sans-serif; margin: 2em; background: #f9f9f9; }
    article { background: #fff; border: 1px solid #ccc; padding: 1em; margin-bottom: 1em; border-radius: 6px; }
    h2 { margin-top: 0; }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  <h1>📰 Últimas Notícias da ANAC</h1>
  ${noticias.map(noticia => `
    <article>
      <h2><a href="${noticia.link}" target="_blank">${noticia.title}</a></h2>
      <p><strong>Publicado:</strong> ${noticia.date}</p>
      ${noticia.image ? `<img src="${noticia.image}" alt="">` : ""}
      <p>${noticia.description}</p>
    </article>`).join("\n")}
</body>
</html>`;
await Deno.writeTextFile("data/noticias.html", htmlDoc);
