import { defineHandler } from "nitro"
import {
  consumeShareAllowance,
  insertProject,
  MAX_DOCUMENT_BYTES,
  SHARE_RATE_LIMIT,
} from "../utils/projects.js"
import { json, serverError } from "../utils/responses.js"

function isDocument(value: unknown): value is { nodes: unknown[]; edges: unknown[] } {
  if (!value || typeof value !== "object") return false
  const document = value as { nodes?: unknown; edges?: unknown }
  return Array.isArray(document.nodes) && Array.isArray(document.edges)
}

export default defineHandler(async (event) => {
  try {
    const body = (await event.req.json()) as { document?: unknown }
    if (!isDocument(body.document)) {
      return json({ error: "The request does not contain a diagram." }, { status: 400 })
    }

    const document = JSON.stringify(body.document)
    if (new TextEncoder().encode(document).byteLength > MAX_DOCUMENT_BYTES) {
      return json({ error: "This diagram is too large to share." }, { status: 413 })
    }

    const allowance = await consumeShareAllowance(event.req)
    if (!allowance.allowed) {
      return json(
        { error: "Too many share links. Try again in a minute." },
        {
          status: 429,
          headers: {
            "Retry-After": String(allowance.retryAfter),
            "X-RateLimit-Limit": String(SHARE_RATE_LIMIT),
            "X-RateLimit-Remaining": "0",
          },
        },
      )
    }

    const project = await insertProject(document)
    return json(
      project,
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store",
          "X-RateLimit-Limit": String(SHARE_RATE_LIMIT),
          "X-RateLimit-Remaining": String(allowance.remaining),
        },
      },
    )
  } catch (error) {
    if (error instanceof SyntaxError) {
      return json({ error: "The request body is not valid JSON." }, { status: 400 })
    }
    return serverError(error)
  }
})
