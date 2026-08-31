import { defineHandler } from "nitro"
import { findProject, PROJECT_ID_PATTERN } from "../../utils/projects.js"
import { json, serverError } from "../../utils/responses.js"

export default defineHandler(async (event) => {
  const id = event.context.params?.id ?? ""
  if (!PROJECT_ID_PATTERN.test(id)) return json({ error: "Diagram not found." }, { status: 404 })

  try {
    const stored = await findProject(id)
    if (!stored) return json({ error: "Diagram not found." }, { status: 404 })
    return new Response(`{"document":${stored}}`, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    return serverError(error)
  }
})
