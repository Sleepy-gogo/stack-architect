import type { GraphDocument } from "./types"

const PROJECT_ID_PATTERN = /^[A-Za-z0-9_-]{12}$/u
const EDIT_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/u
const PROJECT_QUERY_PARAM = "project"

export type SharedDocumentLookup =
  | { kind: "absent" }
  | { kind: "found"; id: string; document: GraphDocument }
  | { kind: "missing" }

export type CreatedSharedProject = {
  id: string
  editToken: string
  url: string
}

function isGraphDocument(value: unknown): value is GraphDocument {
  if (!value || typeof value !== "object") return false
  const document = value as Partial<GraphDocument>
  return Array.isArray(document.nodes) && Array.isArray(document.edges)
}

function projectIdFromUrl(url: string): string | null | undefined {
  const parsed = new URL(url)
  if (parsed.searchParams.has(PROJECT_QUERY_PARAM)) {
    const id = parsed.searchParams.get(PROJECT_QUERY_PARAM) ?? ""
    return PROJECT_ID_PATTERN.test(id) ? id : null
  }

  const parts = parsed.pathname.split("/").filter(Boolean)
  const marker = parts.lastIndexOf("p")
  if (marker === -1 || marker !== parts.length - 2) return undefined
  const id = parts[marker + 1]
  return PROJECT_ID_PATTERN.test(id) ? id : null
}

async function responseMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown }
    return typeof body.error === "string" ? body.error : fallback
  } catch {
    return fallback
  }
}

export function sharedProjectUrl(id: string, url = window.location.href): string {
  const next = new URL(url)
  const base = import.meta.env.BASE_URL.replace(/\/$/u, "")
  next.pathname = base || "/"
  next.search = ""
  next.searchParams.set(PROJECT_QUERY_PARAM, id)
  next.hash = ""
  return next.toString()
}

export function clearProjectReferenceFromUrl(url = window.location.href): void {
  const next = new URL(url)
  const parts = next.pathname.split("/").filter(Boolean)
  const marker = parts.lastIndexOf("p")
  if (marker !== -1 && marker === parts.length - 2) {
    const base = import.meta.env.BASE_URL.replace(/\/$/u, "")
    next.pathname = base || "/"
  }
  next.searchParams.delete(PROJECT_QUERY_PARAM)
  window.history.replaceState(null, "", `${next.pathname}${next.search}${next.hash}`)
}

export async function readSharedDocumentFromUrl(
  url = window.location.href,
): Promise<SharedDocumentLookup> {
  const id = projectIdFromUrl(url)
  if (id === undefined) return { kind: "absent" }
  if (id === null) return { kind: "missing" }

  const response = await fetch(`/api/projects/${id}`, {
    headers: { Accept: "application/json" },
  })
  if (response.status === 404) return { kind: "missing" }
  if (!response.ok) {
    throw new Error(await responseMessage(response, "The shared diagram could not be loaded."))
  }

  const body = (await response.json()) as { document?: unknown }
  if (!isGraphDocument(body.document)) throw new Error("The shared diagram is invalid.")
  return { kind: "found", id, document: body.document }
}

export async function createSharedProject(
  document: GraphDocument,
  url = window.location.href,
): Promise<CreatedSharedProject> {
  const response = await fetch("/api/projects", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ document }),
  })
  if (!response.ok) {
    throw new Error(await responseMessage(response, "The diagram could not be saved for sharing."))
  }

  const body = (await response.json()) as { id?: unknown; editToken?: unknown }
  if (
    typeof body.id !== "string" ||
    !PROJECT_ID_PATTERN.test(body.id) ||
    typeof body.editToken !== "string" ||
    !EDIT_TOKEN_PATTERN.test(body.editToken)
  ) {
    throw new Error("The share service returned invalid project credentials.")
  }

  return {
    id: body.id,
    editToken: body.editToken,
    url: sharedProjectUrl(body.id, url),
  }
}

export async function updateSharedProject(
  id: string,
  editToken: string,
  document: GraphDocument,
): Promise<void> {
  const response = await fetch(`/api/projects/${id}`, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${editToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ document }),
  })
  if (!response.ok) {
    throw new Error(await responseMessage(response, "The shared diagram could not be synced."))
  }
}
