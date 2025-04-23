// deno/fetch_news.ts
import { DOMParser, Element } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

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

console.log(JSON.stringify(noticias, null, 2));
