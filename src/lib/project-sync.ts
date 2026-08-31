import { create } from "zustand"
import { updateSharedProject } from "./share"
import { useStore } from "./store"
import type { GraphDocument } from "./types"

const OWNED_PROJECT_KEY = "tech-stack-architect:owned-project"
const SYNC_INTERVAL_MS = 60_000
const PROJECT_ID_PATTERN = /^[A-Za-z0-9_-]{12}$/u
const EDIT_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/u

export type OwnedProject = {
  id: string
  editToken: string
  dirty: boolean
  lastSyncedAt: number | null
}

export type ProjectSyncStatus = "local" | "pending" | "syncing" | "synced" | "error"

type ProjectSyncState = {
  project: OwnedProject | null
  status: ProjectSyncStatus
  error: string | null
  attachProject: (id: string, editToken: string, sharedDocument: GraphDocument) => void
  prepareImportedProject: (id: string) => void
  detachProject: () => void
  markPending: () => void
  syncNow: (force?: boolean) => Promise<void>
}

let documentVersion = 0
let syncPromise: Promise<void> | null = null

function readOwnedProject(): OwnedProject | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(OWNED_PROJECT_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<OwnedProject>
    if (
      typeof value.id !== "string" ||
      !PROJECT_ID_PATTERN.test(value.id) ||
      typeof value.editToken !== "string" ||
      !EDIT_TOKEN_PATTERN.test(value.editToken)
    ) {
      return null
    }
    return {
      id: value.id,
      editToken: value.editToken,
      dirty: value.dirty === true,
      lastSyncedAt: typeof value.lastSyncedAt === "number" ? value.lastSyncedAt : null,
    }
  } catch {
    return null
  }
}

function persistOwnedProject(project: OwnedProject | null): void {
  if (typeof window === "undefined") return
  if (!project) {
    window.localStorage.removeItem(OWNED_PROJECT_KEY)
    return
  }
  window.localStorage.setItem(OWNED_PROJECT_KEY, JSON.stringify(project))
}

function sameDocument(left: GraphDocument, right: GraphDocument): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

const storedProject = readOwnedProject()

export const useProjectSync = create<ProjectSyncState>((set, get) => ({
  project: storedProject,
  status: storedProject ? (storedProject.dirty ? "pending" : "synced") : "local",
  error: null,

  attachProject: (id, editToken, sharedDocument) => {
    const dirty = !sameDocument(useStore.getState().exportDocument(), sharedDocument)
    const project: OwnedProject = {
      id,
      editToken,
      dirty,
      lastSyncedAt: Date.now(),
    }
    persistOwnedProject(project)
    set({ project, status: dirty ? "pending" : "synced", error: null })
  },

  prepareImportedProject: (id) => {
    const project = get().project
    if (!project || project.id !== id) {
      persistOwnedProject(null)
      set({ project: null, status: "local", error: null })
      return
    }
    const synced = { ...project, dirty: false, lastSyncedAt: Date.now() }
    persistOwnedProject(synced)
    set({ project: synced, status: "synced", error: null })
  },

  detachProject: () => {
    persistOwnedProject(null)
    set({ project: null, status: "local", error: null })
  },

  markPending: () => {
    const { project, status } = get()
    if (!project || status === "pending" || status === "error") return
    if (status === "syncing" && project.dirty) return
    const dirty = { ...project, dirty: true }
    persistOwnedProject(dirty)
    if (status === "syncing") {
      set({ project: dirty })
      return
    }
    set({ project: dirty, status: "pending", error: null })
  },

  syncNow: async (force = false) => {
    if (syncPromise) return syncPromise
    const start = get()
    if (!start.project || (!force && start.status !== "pending" && start.status !== "error")) return

    const project = start.project
    const version = documentVersion
    const document = useStore.getState().exportDocument()
    set({ status: "syncing", error: null })

    syncPromise = (async () => {
      try {
        await updateSharedProject(project.id, project.editToken, document)
        const current = get().project
        if (!current || current.id !== project.id || current.editToken !== project.editToken) return
        const dirty = documentVersion !== version
        const next = { ...current, dirty, lastSyncedAt: Date.now() }
        persistOwnedProject(next)
        set({ project: next, status: dirty ? "pending" : "synced", error: null })
      } catch (error) {
        const current = get().project
        if (current && current.id === project.id && current.editToken === project.editToken) {
          const dirty = { ...current, dirty: true }
          persistOwnedProject(dirty)
          set({
            project: dirty,
            status: "error",
            error: error instanceof Error ? error.message : "Unable to sync. Try again.",
          })
        }
        throw error
      } finally {
        syncPromise = null
      }
    })()

    return syncPromise
  },
}))

export function startProjectSync(): () => void {
  const unsubscribe = useStore.subscribe((state, previous) => {
    if (
      state.title === previous.title &&
      state.nodes === previous.nodes &&
      state.edges === previous.edges
    ) {
      return
    }
    const sync = useProjectSync.getState()
    if (!sync.project) return
    documentVersion += 1
    if (sync.status === "synced" || sync.status === "syncing") sync.markPending()
  })

  const interval = window.setInterval(() => {
    void useProjectSync.getState().syncNow().catch(() => undefined)
  }, SYNC_INTERVAL_MS)

  return () => {
    unsubscribe()
    window.clearInterval(interval)
  }
}
