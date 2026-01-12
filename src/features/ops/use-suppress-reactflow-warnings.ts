import { useEffect } from "react"

const REACTFLOW_WARNING =
  "[React Flow]: It looks like you've created a new nodeTypes or edgeTypes object."

export function useSuppressReactFlowWarnings() {
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const original = console.warn
    console.warn = (...args: unknown[]) => {
      if (typeof args[0] === "string" && args[0].includes(REACTFLOW_WARNING)) {
        return
      }
      original(...args)
    }
    return () => {
      console.warn = original
    }
  }, [])
}
