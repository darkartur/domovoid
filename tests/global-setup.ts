// telegram-test-api is a CJS package (module.exports = TelegramServer), but its d.ts uses
// "export default" instead of "export =" — TypeScript NodeNext resolution sees the default
// import as the module namespace (no construct signatures). The cast is safe: at runtime
// module.exports IS the TelegramServer class with start/stop/config as typed below.
import TelegramServerDefault from "telegram-test-api";

interface TelegramServerInstance {
  start: () => Promise<void>;
  stop: () => Promise<boolean>;
  config: { apiURL: string };
}

const TelegramServer = TelegramServerDefault as unknown as new (config: {
  port: number;
  storage: string;
  storeTimeout: number;
}) => TelegramServerInstance;

export default async function globalSetup() {
  const server = new TelegramServer({ port: 9001, storage: "RAM", storeTimeout: 60 });
  await server.start();
  process.env["TELEGRAM_API_URL"] = server.config.apiURL;

  return async () => {
    await server.stop();
  };
}
