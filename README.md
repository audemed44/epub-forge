# epub-forge

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

### Persistent storage layout

The queue now writes completed EPUBs to disk and supports a `Move to Bookdrop` action.

- Local (non-Docker) default: `./.data` under the project root.
- Docker default: `/data` (or override via env vars below).

- `EPUB_OUTPUT_DIR` (default: `/data/epubs`): built EPUB files
- `BOOKDROP_DIR` (default: `/data/bookdrop`): destination when you click **Move to Bookdrop**
- `CONFIG_DIR` (default: `/data/config`): persisted queue/job state (`jobs.json`)

Example service config:

```yaml
services:
  epub-forge:
    image: ghcr.io/audemed44/epub-forge:latest
    container_name: epub-forge
    restart: unless-stopped
    ports:
      - "9780:3000"
    environment:
      DATA_ROOT: /data
      EPUB_OUTPUT_DIR: /data/epubs
      BOOKDROP_DIR: /data/bookdrop
      CONFIG_DIR: /data/config
    volumes:
      - /abc/bookdrop:/data/bookdrop
      - /abc/epub-forge:/data/epubs
      - /abc/epub-forge/config:/data/config
```

## GHCR auto-publish (GitHub Actions)

This repo includes `.github/workflows/publish-ghcr.yml` to build and push Docker images to GHCR on:

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
