import { parseFeed as parseRSSFeed } from "https://deno.land/x/rss/mod.ts";
import { join } from "https://deno.land/std/path/mod.ts";
import { ensureDir } from "https://deno.land/std/fs/ensure_dir.ts";
import { Feed } from "https://esm.sh/feed@4.2.2";

const site = "https://www.gov.br/anac/pt-br";
const outDir = "data";

function parseDate(dateStr: string): Date {
  const matchBR = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (matchBR) {
    const [_, dd, mm, yyyy, hh = "00", min = "00"] = matchBR;
    return new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:00`);
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date() : d;
}

function formatDate(dateInput: string): string {
  const d = parseDate(dateInput);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function safeParseFeed(url: string) {
  try {
    const res = await fetch(url);
    const xml = await res.text();
    return await parseRSSFeed(xml);
  } catch (err) {
    console.warn(`⚠️ Falha ao processar RSS de ${url}: ${err.message}`);
    return { entries: [] };
  }
}

const noticias: any[] = [];

const noticiasFeed = await safeParseFeed("https://www.gov.br/anac/pt-br/assuntos/noticias/noticias-por-assunto/noticias-anac/RSS");

for (const entry of noticiasFeed.entries) {
  const link = entry.links?.[0]?.href || "";
  const description = entry.description || "";
  const imageMatch = description.match(/<img[^>]+src=['"]([^'"]+)['"]/);
  const image = imageMatch ? imageMatch[1] : null;
  const text = description.replace(/<[^>]+>/g, "").trim();

  const date = entry.published || "";

  noticias.push({
    title: entry.title?.value || "",
    link,
    date: formatDate(date),
    rawDate: date,
    description: text,
    image,
    type: "notícia",
  });
}

async function fetchYouTubeVideos(): Promise<any[]> {
  try {
    const res = await fetch("https://www.youtube.com/feeds/videos.xml?channel_id=UCtHjDYWv0A69w1AoUCoW97A");
    const feed = await parseRSSFeed(await res.text());

    return feed.entries.map(entry => {
      const link = entry.links?.[0]?.href || "";
      const title = entry.title?.value || "";
      const description = entry.description?.replace(/<[^>]+>/g, "").trim() || "";
      const published = entry.published || "";
      const date = formatDate(published);
      const videoId = entry.id?.split(":").pop();
      const image = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;

      return {
        title,
        link,
        date,
        rawDate: published,
        description,
        image,
        type: "vídeo",
      };
    });
  } catch (err) {
    console.warn("⚠️ Erro ao buscar vídeos do YouTube:", err.message);
    return [];
  }
}

const videos = await fetchYouTubeVideos();
const conteudo = [...noticias, ...videos].sort((a, b) => parseDate(b.rawDate).getTime() - parseDate(a.rawDate).getTime());

await ensureDir(outDir);
await Deno.writeTextFile(join(outDir, "feed.json"), JSON.stringify(conteudo, null, 2));

const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Feed ANAC</title></head>
<body>
  <h1>Feed ANAC (Notícias e Vídeos)</h1>
  <ul>
    ${conteudo.map(item => `
      <li>
        <strong>[${item.type}]</strong> <a href="${item.link}">${item.title}</a><br>
        <small>${item.date}</small><br>
        ${item.image ? `<img src="${item.image}" alt="" width="200"><br>` : ""}
        <p>${item.description}</p>
      </li>
    `).join("")}
  </ul>
</body>
</html>
`;

await Deno.writeTextFile(join(outDir, "feed.html"), html);

// Criar RSS/Atom
const feedExport = new Feed({
  title: "Feed ANAC - Notícias e Vídeos",
  description: "Conteúdo atualizado da ANAC (gov.br/anac e YouTube)",
  id: site,
  link: site,
  language: "pt-br",
  favicon: `${site}/favicon.ico`,
  updated: new Date(),
  generator: "Deno Feed Generator",
  feedLinks: {
    json: `${site}/feed.json`,
    atom: `${site}/feed.atom`,
    rss: `${site}/feed.rss`,
  },
  author: {
    name: "ANAC",
    link: site,
  },
});

for (const item of conteudo) {
  feedExport.addItem({
    title: item.title,
    id: item.link,
    link: item.link,
    date: parseDate(item.rawDate),
    description: item.description,
    image: item.image,
  });
}

await Deno.writeTextFile(join(outDir, "feed.rss"), feedExport.rss2());
await Deno.writeTextFile(join(outDir, "feed.atom"), feedExport.atom1());

console.log("✅ Feed gerado com sucesso em /data");
