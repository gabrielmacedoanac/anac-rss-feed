import { parse } from "https://denopkg.com/ThauEx/deno-fast-xml-parser/mod.ts";
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

// Metadados FAIR da fonte de dados
const FAIR_METADATA = {
  title: "Notícias ANAC",
  description: "Feed de notícias e vídeos da Agência Nacional de Aviação Civil do Brasil",
  publisher: "Agência Nacional de Aviação Civil (ANAC)",
  license: "http://www.planejamento.gov.br/assuntos/acoes-e-programas/dados-abertos/licenca-dados-abertos",
  creator: "ANAC",
  created: new Date().toISOString(),
  source: "https://www.gov.br/anac/pt-br/noticias",
  keywords: ["aviação civil", "ANAC", "Brasil", "notícias", "regulação aérea"],
  language: "pt-br",
  coverage: "Brasil",
  rights: "Dados abertos conforme Lei de Acesso à Informação"
};

// Variáveis para definir quantos vídeos e notícias serão recuperados
const maxNoticias = 20;
const maxVideos = 20;

// [Restante do código de extração permanece igual...]

// Gera JSON com metadados FAIR
const jsonData = {
  ...FAIR_METADATA,
  version: "1.0",
  generated: new Date().toISOString(),
  items: conteudos.map(c => ({
    ...c,
    date: c.date,
    dateObj: undefined // Remove o objeto Date da saída JSON
  }))
};
await Deno.writeTextFile("data/feed.json", JSON.stringify(jsonData, null, 2));

// Gera HTML com metadados FAIR
const htmlContent = `
<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8">
  <title>${FAIR_METADATA.title}</title>
  <meta name="description" content="${FAIR_METADATA.description}">
  <meta name="keywords" content="${FAIR_METADATA.keywords.join(", ")}">
  <meta name="dc.title" content="${FAIR_METADATA.title}">
  <meta name="dc.creator" content="${FAIR_METADATA.creator}">
  <meta name="dc.publisher" content="${FAIR_METADATA.publisher}">
  <meta name="dc.date" content="${new Date().toISOString()}">
  <meta name="dc.language" content="${FAIR_METADATA.language}">
  <meta name="dc.rights" content="${FAIR_METADATA.rights}">
  <link rel="schema.DC" href="http://purl.org/dc/elements/1.1/">
</head>
<body>
  <h1>${FAIR_METADATA.title}</h1>
  <p>${FAIR_METADATA.description}</p>
  <p><strong>Fonte:</strong> <a href="${FAIR_METADATA.source}">${FAIR_METADATA.source}</a></p>
  <p><strong>Licença:</strong> <a href="${FAIR_METADATA.license}">Dados Abertos</a></p>
  
  <h2>Conteúdos</h2>
  ${conteudos.map(n => `
    <article>
      <h3><a href="${n.link}" target="_blank">${n.title}</a></h3>
      <p><small>Publicado em: ${n.date} | Tipo: ${n.type}</small></p>
      <p>${n.description}</p>
      ${n.image ? `<img src="${n.image}" alt="${n.title}" width="200">` : ''}
    </article>
  `).join("\n")}
  
  <footer>
    <p>Gerado em: ${new Date().toLocaleString()} | Metadados FAIR</p>
  </footer>
</body>
</html>
`;
await Deno.writeTextFile("index.html", htmlContent);
await Deno.writeTextFile("data/index.html", htmlContent);

// Gera RSS/XML com metadados FAIR
const rssXml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" 
     xmlns:dc="http://purl.org/dc/elements/1.1/"
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:dcterms="http://purl.org/dc/terms/">
  <channel>
    <title>${FAIR_METADATA.title}</title>
    <atom:link href="https://exemplo.com/data/rss.xml" rel="self" type="application/rss+xml" />
    <link>${FAIR_METADATA.source}</link>
    <description>${FAIR_METADATA.description}</description>
    <language>${FAIR_METADATA.language}</language>
    <copyright>${FAIR_METADATA.rights}</copyright>
    <generator>Deno Script</generator>
    <pubDate>${new Date().toUTCString()}</pubDate>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <docs>https://www.rssboard.org/rss-specification</docs>
    <dc:publisher>${FAIR_METADATA.publisher}</dc:publisher>
    <dc:creator>${FAIR_METADATA.creator}</dc:creator>
    <dc:rights>${FAIR_METADATA.rights}</dc:rights>
    <dc:date>${new Date().toISOString()}</dc:date>
    <dcterms:license>${FAIR_METADATA.license}</dcterms:license>
    
    ${conteudos.map(n => `
    <item>
      <title><![CDATA[${n.title}]]></title>
      <link>${n.link}</link>
      <description><![CDATA[${n.description}]]></description>
      <pubDate>${n.dateObj.toUTCString()}</pubDate>
      <guid isPermaLink="true">${n.link}</guid>
      <dc:date>${n.dateObj.toISOString()}</dc:date>
      <dc:type>${n.type}</dc:type>
      <content:encoded><![CDATA[
        <p>${n.description}</p>
        ${n.image ? `<img src="${n.image}" alt="${n.title}">` : ''}
      ]]></content:encoded>
    </item>
    `).join("\n")}
  </channel>
</rss>`;
await Deno.writeTextFile("data/rss.xml", rssXml);

// Gera ATOM com metadados FAIR
const atomXml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      xmlns:dcterms="http://purl.org/dc/terms/">
  <title>${FAIR_METADATA.title}</title>
  <subtitle>${FAIR_METADATA.description}</subtitle>
  <link href="https://exemplo.com/data/atom.xml" rel="self"/>
  <link href="${FAIR_METADATA.source}"/>
  <id>urn:uuid:${FAIR_METADATA.source}</id>
  <updated>${conteudos[0]?.dateObj.toISOString() || new Date().toISOString()}</updated>
  <generator>Deno Script</generator>
  <rights>${FAIR_METADATA.rights}</rights>
  <dc:publisher>${FAIR_METADATA.publisher}</dc:publisher>
  <dc:creator>${FAIR_METADATA.creator}</dc:creator>
  <dc:rights>${FAIR_METADATA.rights}</dc:rights>
  <dcterms:license>${FAIR_METADATA.license}</dcterms:license>
  
  ${conteudos.map(n => `
  <entry>
    <title type="html"><![CDATA[${n.title}]]></title>
    <link rel="alternate" type="text/html" href="${n.link}"/>
    <id>urn:uuid:${n.link}</id>
    <updated>${n.dateObj.toISOString()}</updated>
    <published>${n.dateObj.toISOString()}</published>
    <author><name>${FAIR_METADATA.creator}</name></author>
    <summary type="html"><![CDATA[${n.description}]]></summary>
    <content type="html"><![CDATA[
      <p>${n.description}</p>
      ${n.image ? `<img src="${n.image}" alt="${n.title}">` : ''}
    ]]></content>
    <dc:type>${n.type}</dc:type>
    <dc:date>${n.dateObj.toISOString()}</dc:date>
  </entry>
  `).join("\n")}
</feed>`;
await Deno.writeTextFile("data/atom.xml", atomXml);
