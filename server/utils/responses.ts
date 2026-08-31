import { SharingNotConfiguredError } from "./projects.js"

export function json(value: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers)
  headers.set("Content-Type", "application/json; charset=utf-8")
  return new Response(JSON.stringify(value), { ...init, headers })
}

export function serverError(error: unknown): Response {
  if (error instanceof SharingNotConfiguredError) {
    return json({ error: error.message }, { status: 503 })
  }
  console.error("Share service error", error)
  return json({ error: "The share service is temporarily unavailable." }, { status: 503 })
}
