import { defineHandler } from "nitro"
import { handleMcp } from "../mcp/handler.js"
import { consumeMcpAllowance, insertProject } from "../utils/projects.js"

export default defineHandler((event) => handleMcp(event.req, {
  publicUrl: process.env.STACK_ARCHITECT_PUBLIC_URL ?? "",
  consumeRequest: () => consumeMcpAllowance("requests", 60, 60),
  consumeCreation: () => consumeMcpAllowance("creations", 100, 86_400),
  insertProject,
}))
