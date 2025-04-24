// gerar_feeds.ts
import { parse } from "https://deno.land/x/deno_html_parser/mod.ts";

// Função para escapar caracteres especiais no XML e HTML
function escapeXml(str: string): string {
  return str.replace(/[<>&'"]/g, (c) => {
    return { "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]!;
  });
}

// Função para pegar as notícias da página
async function getNoticias() {
  const url = "https://www.gov.br/anac/pt-br/noticias";
  const response = await fetch(url);
  const html = await response.text();
  const doc = parse(html);

  const articles = Array.from(doc.querySelectorAll('article.tileItem')).slice(0, 30);

  const noticias = articles.map((article) => {
    const titleElem = article.querySelector('h2.tileHeadline a');
    const dateElem = article.querySelector('span.summary-view-icon i.icon-day');
    const timeElem = article.querySelector('span.summary-view-icon i.icon-hour');
    const descriptionElem = article.querySelector('p.tileBody span.description');
    const imgElem = article.querySelector('div.tileImage img');

    const title = titleElem ? titleElem.textContent.trim() : "Sem título";
    const link = titleElem ? titleElem.getAttribute("href") : "#";
    const date = dateElem ? dateElem.nextSibling?.textContent.trim() : "ND";
    const time = timeElem ? timeElem.nextSibling?.textContent.trim().replace('h', ':') : "ND";
    const description = descriptionElem ? descriptionElem.textContent.trim() : "Sem descrição";
    const image = imgElem ? imgElem.getAttribute("src") : null;

    return {
      title,
      link,
      date: `${date} ${time}`.trim(),
      description,
      image
    };
  });

  return noticias;
}

// Função para gerar RSS 2.0
async function generateRssXml(noticias: any[]) {
  const rssItems = noticias.map((n) => `
    <item>
      <title><![CDATA[${n.title}]]></title>
      <link>${n.link}</link>
      <description><![CDATA[${n.description}]]></description>
      <pubDate>${new Date(n.date).toUTCString()}</pubDate>
    </item>
  `).join("");

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
}

// Função para gerar JSON Feed
async function generateJsonFeed(noticias: any[]) {
  const jsonFeed = {
    version: "https://jsonfeed.org/version/1.1",
    title: "Notícias ANAC",
    home_page_url: "https://www.gov.br/anac/pt-br/noticias",
    feed_url: "https://gabrielmacedoanac.github.io/anac-rss-feed/data/feed.json",
    items: noticias.map((n) => ({
      id: n.link,
      url: n.link,
      title: n.title,
      content_text: n.description,
      date_published: new Date(n.date).toISOString()
    }))
  };

  await Deno.writeTextFile("data/feed.json", JSON.stringify(jsonFeed, null, 2));
}

// Função para gerar Atom
async function generateAtom(noticias: any[]) {
  const atomItems = noticias.map((n) => `
    <entry>
      <title>${escapeXml(n.title)}</title>
      <link href="${n.link}" />
      <id>${n.link}</id>
      <updated>${new Date(n.date).toISOString()}</updated>
      <summary>${escapeXml(n.description)}</summary>
    </entry>
  `).join("");

  const atomXml = `<?xml version="1.0" encoding="UTF-8" ?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Notícias ANAC</title>
  <link href="https://www.gov.br/anac/pt-br/noticias" />
  <updated>${new Date().toISOString()}</updated>
  <id>https://www.gov.br/anac/pt-br/noticias</id>
  ${atomItems}
</feed>`;

  await Deno.writeTextFile("data/feed.atom", atomXml);
}

// Função para gerar HTML visual simples
async function generateHtml(noticias: any[]) {
  const html = `<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8">
  <title>Notícias ANAC</title>
  <style>
    body { margin: auto; }
    .noticia { margin-bottom: 1em; }
    h2 { margin-bottom: 0.2em; }
    p { margin-top: 0.2em; }
    time { color: gray; font-size: 0.9em; }
  </style>
</head>
<body>
  ${noticias.map((n) => `
    <div class="noticia">
      <h2><a href="${n.link}" target="_blank" rel="noopener">${escapeXml(n.title)}</a></h2>
      <time>${n.date}</time>
      <p>${escapeXml(n.description)}</p>
    </div>
  `).join("")}
</body>
</html>`;

  await Deno.writeTextFile("data/noticias.html", html);
}

// Main execution
async function main() {
  const noticias = await getNoticias();

  await generateRssXml(noticias);
  await generateJsonFeed(noticias);
  await generateAtom(noticias);
  await generateHtml(noticias);
}

main();
