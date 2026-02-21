import { createApp } from "./app.js";

async function start(): Promise<void> {
  const { app, config } = await createApp();
  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`scraper-epub listening on :${config.port}`);
  });
}

start().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
