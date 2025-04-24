# ✈️ ANAC RSS Feed

Este repositório publica automaticamente um feed **RSS** com as últimas notícias do site da [Agência Nacional de Aviação Civil (ANAC)](https://www.gov.br/anac/pt-br/noticias).

Os dados são extraídos periodicamente e publicados como:

- 🗂️ Arquivo JSON
- 📰 Página HTML com visualização
- 📡 Feed RSS 2.0

---

## 📌 Links Úteis

| Tipo        | Link                                                                                   |
|-------------|-----------------------------------------------------------------------------------------|
| 🔄 Feed RSS | [rss.xml](https://gabrielmacedoanac.github.io/anac-rss-feed/data/rss.xml)              |
| 🔁 Alias    | [index.xml](https://gabrielmacedoanac.github.io/anac-rss-feed/data/index.xml)          |
| 📊 Visual   | [noticias.html](https://gabrielmacedoanac.github.io/anac-rss-feed/data/noticias.html)  |
| 📁 JSON     | [noticias.json](https://gabrielmacedoanac.github.io/anac-rss-feed/data/noticias.json)  |

---

## ⚙️ Como funciona?

1. O script [`fetch_news.ts`](deno/fetch_news.ts) faz scraping do site da ANAC e salva:
   - `noticias.json`
   - `noticias.html`

2. O script [`json_to_rss.ts`](deno/json_to_rss.ts) converte o JSON em:
   - `rss.xml`
   - `index.xml`

3. O workflow GitHub Actions (`.github/workflows/rss.yml`) executa automaticamente **a cada hora**.

---

## 🛠️ Tecnologias

- [Deno](https://deno.land/) para scraping e conversão
- [GitHub Actions](https://github.com/features/actions) para automação
- RSS 2.0 padrão
- HTML com estilo simples e responsivo

---

## 📥 Como usar este feed?

Você pode assinar o feed no seu leitor de RSS preferido:

https://gabrielmacedoanac.github.io/anac-rss-feed/data/rss.xml


Também pode embutir em páginas, newsletters ou monitoramentos automáticos.

---

## 🤝 Contribua

Achou algum problema? Quer ajudar? Sinta-se à vontade para:

- Abrir uma issue
- Criar um pull request
- Sugerir melhorias nos scripts ou visual

---

## 👨‍💼 Autor

Desenvolvido e mantido por [Gabriel Macedo](https://github.com/gabrielmacedoanac).
