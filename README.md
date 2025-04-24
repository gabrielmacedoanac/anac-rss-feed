# ANAC RSS Feed

Este repositório coleta as últimas notícias da ANAC e gera feeds em formatos RSS, Atom, JSON e HTML.

## Funcionalidades

- **RSS 2.0**: `data/rss.xml`
- **Atom**: `data/atom.xml`
- **JSON Simples**: `data/feed.json`
- **HTML**: `data/index.html`

## Como usar

### 1. Clone o repositório

```bash
git clone https://github.com/gabrielmacedoanac/anac-rss-feed.git
cd anac-rss-feed
```

### 2. Execute o script Deno

```bash
deno run --allow-net --allow-write deno/rss.ts
```

Isso irá baixar as últimas notícias da ANAC e gerar os arquivos na pasta `data/`.

## Estrutura do Repositório

```
anac-rss-feed/
├── deno/
│   └── rss.ts             # Script para scraping e geração dos feeds
├── data/
│   ├── feed.json          # JSON Simples
│   ├── rss.xml            # RSS 2.0
│   ├── atom.xml           # Atom
│   ├── index.html         # Página HTML simples
│   └── index.xml          # Alias para RSS
├── .github/
│   └── workflows/
│       └── rss.yml        # GitHub Action para execução automatizada
└── index.html             # Página para carregamento automático com o GitHub Pages.
```

## Automação

Este repositório possui uma GitHub Action que executa o script de scraping automaticamente. O workflow está configurado em `.github/workflows/rss.yml`.

## Feeds Públicos

Os feeds gerados estão disponíveis em:

- [RSS](https://gabrielmacedoanac.github.io/anac-rss-feed/data/rss.xml)
- [Atom](https://gabrielmacedoanac.github.io/anac-rss-feed/data/atom.xml)
- [JSON Simples](https://gabrielmacedoanac.github.io/anac-rss-feed/data/feed.json)
- [HTML](https://gabrielmacedoanac.github.io/anac-rss-feed/data/index.html)

## Contribuindo

Contribuições são bem-vindas! Para sugestões ou melhorias, abra uma issue ou envie um pull request.
