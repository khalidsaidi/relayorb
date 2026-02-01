import { createContext, useContext, type ReactNode } from "react"
import { usePipelineHealth } from "@/features/ops/use-pipeline-health"

type PipelineHealthContextValue = ReturnType<typeof usePipelineHealth>

const PipelineHealthContext = createContext<PipelineHealthContextValue | null>(null)

export function PipelineHealthProvider({ children }: { children: ReactNode }) {
  const value = usePipelineHealth()
  return <PipelineHealthContext.Provider value={value}>{children}</PipelineHealthContext.Provider>
}

export function usePipelineHealthContext() {
  const ctx = useContext(PipelineHealthContext)
  return ctx ?? usePipelineHealth()
}
