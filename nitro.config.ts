import { defineConfig } from "nitro/config"

export default defineConfig({
  serverDir: "./server",
  runtimeConfig: {
    nitro: {
      envPrefix: "TURSO_",
    },
    databaseUrl: "",
    authToken: "",
  },
})
