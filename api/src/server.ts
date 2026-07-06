import { port } from "./config.js";
import { createApp } from "./app.js";

const app = createApp();

app.listen(port, () => {
  console.log(`Genesis Locker API listening on ${port}`);
});
