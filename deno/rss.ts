// Defina a quantidade de notícias e vídeos que você quer pegar
const maxNotícias = 10; // Exemplo de 10 notícias
const maxVídeos = 5; // Exemplo de 5 vídeos

// Extrai as notícias (máximo de `maxNotícias` notícias)
const noticias = [];
const artigos = doc.querySelectorAll("article.tileItem");
for (let i = 0; i < Math.min(maxNotícias, artigos.length); i++) {
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

// Função para buscar vídeos do canal da ANAC no YouTube
async function fetchYouTubeVideos(channelId: string) {
  const youtubeFeedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  const res = await fetch(youtubeFeedUrl);
  const xml = await res.text();
  const parsed = parse(xml, { ignoreAttributes: false });

  const entries = parsed.feed?.entry || [];
  const videos = Array.isArray(entries) ? entries : [entries];

  return videos.map((video: any) => {
    const date = video.published ? formatDate(video.published) : "ND";
    return {
      title: video.title,
      link: video.link?.["@_href"] || video.link?.["@_url"],
      date,
      description: video["media:group"]?.["media:description"] || "",
      image: video["media:group"]?.["media:thumbnail"]?.["@_url"] || null,
      type: "vídeo", // Adiciona o tipo para identificar
    };
  });
}

// Adiciona vídeos ao feed
const youtubeChannelId = "UC5ynmbMZXolM-jo2hGR31qg";
const youtubeVideos = await fetchYouTubeVideos(youtubeChannelId);

// Combina e ordena os conteúdos por data decrescente
const conteudos = [...noticias, ...youtubeVideos].sort((a, b) => {
  const d1 = new Date(a.date);
  const d2 = new Date(b.date);
  return d2.getTime() - d1.getTime(); // Ordena do mais recente para o mais antigo
});

// Garante que a pasta data/ exista
await Deno.mkdir("data", { recursive: true });

// Salva JSON
await Deno.writeTextFile("data/feed.json", JSON.stringify(conteudos, null, 2));

// Gera HTML simples
const htmlContent = `<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8">
  <title>Notícias e Vídeos ANAC</title>
</head>
<body>
  ${conteudos.map(n => `<a href="${n.link}">${n.title}</a> (${n.date}) (${n.type})</br>`).join("\n")}
</body>
</html>`;
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
    <title>Notícias e Vídeos ANAC</title>
    <link>https://www.gov.br/anac/pt-br/noticias</link>
    <description>Últimas notícias e vídeos da ANAC</description>
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
  <title>Notícias e Vídeos ANAC</title>
  <link href="https://www.gov.br/anac/pt-br/noticias"/>
  <updated>${new Date().toISOString()}</updated>
  <id>https://www.gov.br/anac/pt-br/noticias</id>
  ${atomItems}
</feed>`;
await Deno.writeTextFile("data/atom.xml", atomXml);
