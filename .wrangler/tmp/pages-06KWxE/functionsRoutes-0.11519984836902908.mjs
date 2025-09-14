import { onRequestPost as __chat_ts_onRequestPost } from "/Users/alko/projects/carpeta sin título/solverive/functions/chat.ts"
import { onRequestPost as __embed_ts_onRequestPost } from "/Users/alko/projects/carpeta sin título/solverive/functions/embed.ts"

export const routes = [
    {
      routePath: "/chat",
      mountPath: "/",
      method: "POST",
      middlewares: [],
      modules: [__chat_ts_onRequestPost],
    },
  {
      routePath: "/embed",
      mountPath: "/",
      method: "POST",
      middlewares: [],
      modules: [__embed_ts_onRequestPost],
    },
  ]