// deno/json_to_rss.ts
const url = "https://raw.githubusercontent.com/gabrielmacedoanac/anac-rss-feed/main/data/noticias.json";

// 1. Carrega o JSON com as notícias
const response = await fetch(url);
if (!response.ok) throw new Error("Falha ao carregar noticias.json");
const noticias = await response.json();

// 2. Gera os itens RSS
const rssItems = noticias.map((noticia: any) => `
  <item>
    <title><![CDATA[${noticia.title}]]></title>
    <link>${noticia.link}</link>
    <description><![CDATA[${noticia.description}]]></description>
    <pubDate>${new Date(noticia.date).toUTCString()}</pubDate>
  </item>`).join("\n");

// 3. Gera o XML completo
const rssXml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>Notícias ANAC</title>
    <link>https://www.gov.br/anac/pt-br/noticias</link>
    <description>Últimas notícias da Agência Nacional de Aviação Civil</description>
    ${rssItems}
  </channel>
</rss>`;

// 4. Salva o arquivo
await Deno.writeTextFile("data/rss.xml", rssXml);
console.log("✅ rss.xml gerado com sucesso");

// 5. Gera um arquivo index.xml como alias do feed principal
const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href=""?>
<rss version="2.0">
  <channel>
    <title>Notícias ANAC (redirect)</title>
    <link>https://www.gov.br/anac/pt-br/noticias</link>
    <description>Feed de redirecionamento para o RSS principal</description>
    <item>
      <title>Feed disponível</title>
      <link>https://gabrielmacedoanac.github.io/anac-rss-feed/data/rss.xml</link>
      <guid>https://gabrielmacedoanac.github.io/anac-rss-feed/data/rss.xml</guid>
      <description>Redirecionamento para o feed principal</description>
      <pubDate>${new Date().toUTCString()}</pubDate>
    </item>
  </channel>
</rss>`;

await Deno.writeTextFile("data/index.xml", indexXml);
console.log("✅ index.xml gerado como alias do feed principal");
