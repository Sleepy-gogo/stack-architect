import { defineHandler } from "nitro"
import {
  consumeProjectSyncAllowance,
  MAX_DOCUMENT_BYTES,
  PROJECT_ID_PATTERN,
  PROJECT_SYNC_RATE_LIMIT,
  updateProject,
} from "../../utils/projects.js"
import { json, serverError } from "../../utils/responses.js"

function isDocument(value: unknown): value is { nodes: unknown[]; edges: unknown[] } {
  if (!value || typeof value !== "object") return false
  const document = value as { nodes?: unknown; edges?: unknown }
  return Array.isArray(document.nodes) && Array.isArray(document.edges)
}

export default defineHandler(async (event) => {
  const id = event.context.params?.id ?? ""
  if (!PROJECT_ID_PATTERN.test(id)) return json({ error: "Diagram not found." }, { status: 404 })

  const authorization = event.req.headers.get("authorization") ?? ""
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : ""
  if (!/^[A-Za-z0-9_-]{32}$/u.test(token)) {
    return json({ error: "This browser cannot update this shared diagram." }, { status: 403 })
  }

  try {
    const body = (await event.req.json()) as { document?: unknown }
    if (!isDocument(body.document)) {
      return json({ error: "The request does not contain a diagram." }, { status: 400 })
    }

    const document = JSON.stringify(body.document)
    if (new TextEncoder().encode(document).byteLength > MAX_DOCUMENT_BYTES) {
      return json({ error: "This diagram is too large to sync." }, { status: 413 })
    }

    const allowance = await consumeProjectSyncAllowance(event.req, id)
    if (!allowance.allowed) {
      return json(
        { error: "Too many sync attempts. Try again in a minute." },
        {
          status: 429,
          headers: {
            "Retry-After": String(allowance.retryAfter),
            "X-RateLimit-Limit": String(PROJECT_SYNC_RATE_LIMIT),
            "X-RateLimit-Remaining": "0",
          },
        },
      )
    }

    const updated = await updateProject(id, document, token)
    if (!updated) {
      return json({ error: "This browser cannot update this shared diagram." }, { status: 403 })
    }

    return json(
      { updated: true },
      {
        headers: {
          "Cache-Control": "no-store",
          "X-RateLimit-Limit": String(PROJECT_SYNC_RATE_LIMIT),
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
