import { connect, DatabaseError, type Connection } from "@tursodatabase/serverless"
import { useRuntimeConfig as getRuntimeConfig } from "nitro/runtime-config"

const PROJECT_ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
export const PROJECT_ID_PATTERN = /^[A-Za-z0-9_-]{12}$/u
export const MAX_DOCUMENT_BYTES = 1_000_000
export const SHARE_RATE_LIMIT = 10
export const PROJECT_SYNC_RATE_LIMIT = 30
const RATE_WINDOW_SECONDS = 60

type RuntimeConfig = {
  databaseUrl: string
  authToken: string
}

export class SharingNotConfiguredError extends Error {}

let connection: Connection | null = null
let schemaPromise: Promise<void> | null = null

export type ShareAllowance = {
  allowed: boolean
  remaining: number
  retryAfter: number
}

function configuration(): RuntimeConfig {
  const config = getRuntimeConfig() as RuntimeConfig
  if (!config.databaseUrl || !config.authToken) {
    throw new SharingNotConfiguredError("Sharing is not configured yet.")
  }
  return config
}

function database(): Connection {
  if (connection) return connection
  const config = configuration()
  connection = connect({
    url: config.databaseUrl,
    authToken: config.authToken,
  })
  return connection
}

async function initializeSchema(): Promise<void> {
  await database().run(`
    CREATE TABLE IF NOT EXISTS shared_projects (
      id TEXT PRIMARY KEY CHECK (length(id) = 12),
      document TEXT NOT NULL,
      edit_token_hash TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)
  await database().run(`
    CREATE TABLE IF NOT EXISTS share_rate_limits (
      fingerprint TEXT PRIMARY KEY,
      window_start INTEGER NOT NULL,
      count INTEGER NOT NULL
    )
  `)

  const columns = (await database().all("PRAGMA table_info(shared_projects)")) as Array<{
    name?: unknown
  }>
  const names = new Set(columns.flatMap((column) =>
    typeof column.name === "string" ? [column.name] : [],
  ))
  if (!names.has("edit_token_hash")) {
    await database().run("ALTER TABLE shared_projects ADD COLUMN edit_token_hash TEXT")
  }
  if (!names.has("updated_at")) {
    await database().run("ALTER TABLE shared_projects ADD COLUMN updated_at INTEGER")
  }
}

async function ensureSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = initializeSchema().catch((error: unknown) => {
        schemaPromise = null
        throw error
      })
  }
  await schemaPromise
}

function clientAddress(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() ??
    "unknown"
  )
}

async function addressFingerprint(request: Request, scope: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(configuration().authToken),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${scope}:${clientAddress(request)}`),
    ),
  )
  return Array.from(signature.subarray(0, 16), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

async function consumeAllowance(
  request: Request,
  scope: string,
  limit: number,
): Promise<ShareAllowance> {
  await ensureSchema()
  const now = Math.floor(Date.now() / 1000)
  const windowStart = now - (now % RATE_WINDOW_SECONDS)
  const fingerprint = await addressFingerprint(request, scope)
  const row = (await database().get(
    `
      INSERT INTO share_rate_limits (fingerprint, window_start, count)
      VALUES (?, ?, 1)
      ON CONFLICT(fingerprint) DO UPDATE SET
        window_start = excluded.window_start,
        count = CASE
          WHEN share_rate_limits.window_start = excluded.window_start
          THEN share_rate_limits.count + 1
          ELSE 1
        END
      RETURNING count
    `,
    fingerprint,
    windowStart,
  )) as { count?: unknown } | undefined
  const count = typeof row?.count === "bigint" ? Number(row.count) : Number(row?.count ?? 1)
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfter: RATE_WINDOW_SECONDS - (now - windowStart),
  }
}

export function consumeShareAllowance(request: Request): Promise<ShareAllowance> {
  return consumeAllowance(request, "share", SHARE_RATE_LIMIT)
}

export function consumeProjectSyncAllowance(
  request: Request,
  projectId: string,
): Promise<ShareAllowance> {
  return consumeAllowance(request, `sync:${projectId}`, PROJECT_SYNC_RATE_LIMIT)
}

function projectId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(9))
  let id = ""
  for (let offset = 0; offset < bytes.length; offset += 3) {
    const value = (bytes[offset] << 16) | (bytes[offset + 1] << 8) | bytes[offset + 2]
    id += PROJECT_ID_ALPHABET[(value >>> 18) & 63]
    id += PROJECT_ID_ALPHABET[(value >>> 12) & 63]
    id += PROJECT_ID_ALPHABET[(value >>> 6) & 63]
    id += PROJECT_ID_ALPHABET[value & 63]
  }
  return id
}

function editToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  let token = ""
  for (let offset = 0; offset < bytes.length; offset += 3) {
    const value = (bytes[offset] << 16) | (bytes[offset + 1] << 8) | bytes[offset + 2]
    token += PROJECT_ID_ALPHABET[(value >>> 18) & 63]
    token += PROJECT_ID_ALPHABET[(value >>> 12) & 63]
    token += PROJECT_ID_ALPHABET[(value >>> 6) & 63]
    token += PROJECT_ID_ALPHABET[value & 63]
  }
  return token
}

async function tokenHash(token: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
  )
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

function isConstraintError(error: unknown): boolean {
  return error instanceof DatabaseError && error.code?.includes("CONSTRAINT") === true
}

export async function insertProject(
  document: string,
): Promise<{ id: string; editToken: string }> {
  await ensureSchema()
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const id = projectId()
    const token = editToken()
    try {
      await database().run(
        `
          INSERT INTO shared_projects (id, document, edit_token_hash, updated_at)
          VALUES (?, ?, ?, unixepoch())
        `,
        id,
        document,
        await tokenHash(token),
      )
      return { id, editToken: token }
    } catch (error) {
      if (!isConstraintError(error)) throw error
    }
  }
  throw new Error("Could not allocate a project ID.")
}

export async function updateProject(
  id: string,
  document: string,
  token: string,
): Promise<boolean> {
  await ensureSchema()
  const row = (await database().get(
    `
      UPDATE shared_projects
      SET document = ?, updated_at = unixepoch()
      WHERE id = ? AND edit_token_hash = ?
      RETURNING id
    `,
    document,
    id,
    await tokenHash(token),
  )) as { id?: unknown } | undefined
  return row?.id === id
}

export async function findProject(id: string): Promise<string | null> {
  await ensureSchema()
  const row = (await database().get(
    "SELECT document FROM shared_projects WHERE id = ? LIMIT 1",
    id,
  )) as { document?: unknown } | undefined
  return typeof row?.document === "string" ? row.document : null
}
