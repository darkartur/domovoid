import { runServer } from "verdaccio";

const app = await runServer("./verdaccio-config.yml");

app.listen(4873);
