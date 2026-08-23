import { useEffect } from "react"
import { useStore as useReactFlowStore } from "@xyflow/react"

export function ConnectionFlag() {
  const inProgress = useReactFlowStore((s) => s.connection.inProgress)
  useEffect(() => {
    document.body.classList.toggle("connecting-edge", inProgress)
    return () => document.body.classList.remove("connecting-edge")
  }, [inProgress])
  return null
}
