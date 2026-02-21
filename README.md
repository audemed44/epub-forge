# scraper-epub

Self-hosted web app version of WebToEpub flow. Current target parsers:

- `royalroad.com`
- `novelfire.net`
- generic WordPress-style pages

## Run locally

```bash
npm install
npm run dev
```

This starts:

- One-port dev server on `http://localhost:3000` (API + Vite UI middleware)

For production-style local run:

```bash
npm run build
npm start
```

Open `http://localhost:3000`.

## Docker

```bash
docker compose up --build
```

Then open `http://localhost:3000`.

## GHCR auto-publish (GitHub Actions)

This repo includes `REDACTED_PATH/.github/workflows/publish-ghcr.yml` to build and push Docker images to GHCR on:

- push to `main`
- push to `codex/**` branches
- `v*` tags
- manual workflow dispatch

Published image:

- `ghcr.io/audemed44/epub-forge` (owner comes from repository owner)

After your first successful workflow run, deploy on server with:

```bash
docker login ghcr.io -u audemed44
docker pull ghcr.io/audemed44/epub-forge:latest
docker run -d --name epub-forge -p 3000:3000 --restart unless-stopped ghcr.io/audemed44/epub-forge:latest
```

## API

- `POST /api/preview`
  - body: `{ "url": "https://..." }`
  - response: parser id, metadata, chapter list
- `POST /api/build`
  - body: `{ "url": "...", "parserId": "...", "metadata": {...}, "chapterUrls": ["..."] }`
  - response: `.epub` download

## Notes

- This repo currently reimplements parser behavior for the 3 target sites in server-side code for mobile use.
- Next step is deeper extraction/reuse of upstream WebToEpub modules under `vendor/WebToEpub`.
