const youtubeChannelUrl = "https://www.youtube.com/feeds/videos.xml?channel_id=UC5ynmbMZXolM-jo2hGR31qg"; // Substitua pelo canal desejado

// Função para buscar vídeos do YouTube
async function fetchYoutubeVideos() {
  const headers = { "User-Agent": "Mozilla/5.0" };

  const res = await fetch(youtubeChannelUrl, { headers });
  const xmlText = await res.text();

  // Usando DOMParser para parse do XML
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "application/xml");

  if (xmlDoc.querySelector("parsererror")) {
    throw new Error("Erro ao parsear XML");
  }

  const entries = xmlDoc.querySelectorAll("entry");

  // Extraímos os vídeos
  const videos = Array.from(entries).map((entry: any) => {
    return {
      title: entry.querySelector("title")?.textContent,
      link: entry.querySelector("link")?.getAttribute("href"),
      date: entry.querySelector("published")?.textContent,
      description: entry.querySelector("summary")?.textContent,
    };
  });

  return videos;
}

// Função para buscar as notícias da ANAC
async function fetchNews() {
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

      noticias.push({ title, link, date: dateTime, description, image });
    } catch (e) {
      console.warn("⚠️ Erro ao processar item:", e);
    }
  }

  return noticias;
}

async function main() {
  // Buscar vídeos do YouTube
  const youtubeVideos = await fetchYoutubeVideos();

  // Buscar notícias da ANAC
  const noticias = await fetchNews();

  // Mesclar dados de notícias e vídeos
  const allData = [...noticias, ...youtubeVideos];

  // Garante que a pasta data/ exista
  await Deno.mkdir("data", { recursive: true });

  // Salva JSON
  await Deno.writeTextFile("data/feed.json", JSON.stringify(allData, null, 2));

  // Gera HTML simples
  const htmlContent = `<!DOCTYPE html>
  <html lang="pt-br">
  <head>
    <meta charset="UTF-8">
    <title>Notícias e Vídeos ANAC</title>
  </head>
  <body>
    ${allData.map(n => `<a href="${n.link}">${n.title}</a> (${n.date})</br>`).join("\n")}
  </body>
  </html>
  `;
  await Deno.writeTextFile("index.html", htmlContent);
  await Deno.writeTextFile("data/index.html", htmlContent);

  // Gera RSS/XML
  const rssItems = allData.map(n => {
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
      <title>Notícias e Vídeos ANAC</title>
      <link>https://www.gov.br/anac/pt-br/noticias</link>
      <description>Últimas notícias e vídeos da ANAC</description>
      ${rssItems}
    </channel>
  </rss>`;
  await Deno.writeTextFile("data/rss.xml", rssXml);

  // Gera ATOM
  const atomItems = allData.map(n => {
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
    <title>Notícias e Vídeos ANAC</title>
    <link href="https://www.gov.br/anac/pt-br/noticias"/>
    <updated>${new Date().toISOString()}</updated>
    <id>https://www.gov.br/anac/pt-br/noticias</id>
    ${atomItems}
  </feed>`;
  await Deno.writeTextFile("data/atom.xml", atomXml);
}

await main();
