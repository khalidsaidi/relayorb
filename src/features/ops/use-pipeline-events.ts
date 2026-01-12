import { useEffect, useRef, useState } from "react"

import { useAuth } from "@/features/auth/auth-context"
import { firebaseEnabled } from "@/lib/firebase"
import type { PipelineEvent } from "@/lib/types"

type ConnectionState = "idle" | "connecting" | "live" | "error"

type PipelineStream = {
  events: PipelineEvent[]
  status: ConnectionState
  error: string | null
  connectedAt: Date | null
}

const MAX_EVENTS = 500

export function usePipelineEvents(eventsUrl: string) {
  const { user } = useAuth()
  const [stream, setStream] = useState<PipelineStream>({
    events: [],
    status: "idle",
    error: null,
    connectedAt: null,
  })
  const seenRef = useRef<Set<string>>(new Set())
  const bufferRef = useRef("")
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!eventsUrl || !firebaseEnabled || !user) {
      setStream((prev) => ({
        ...prev,
        status: "idle",
        error: !eventsUrl ? "Missing VITE_REFRESH_URL" : null,
      }))
      return
    }

    let active = true
    const currentUser = user

    async function connect() {
      setStream((prev) => ({ ...prev, status: "connecting", error: null }))
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const token = await currentUser.getIdToken(true)
        const response = await fetch(eventsUrl, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        })

        if (!response.ok || !response.body) {
          const body = await response.text().catch(() => "")
          throw new Error(body || `Stream failed (${response.status})`)
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        setStream((prev) => ({
          ...prev,
          status: "live",
          connectedAt: new Date(),
        }))

        while (active) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          processChunk(chunk)
        }
      } catch (err) {
        if (!active) return
        const message = err instanceof Error ? err.message : "Stream failed"
        setStream((prev) => ({ ...prev, status: "error", error: message }))
        setTimeout(() => {
          if (active) connect()
        }, 3000)
      }
    }

    function processChunk(chunk: string) {
      bufferRef.current += chunk
      const parts = bufferRef.current.split("\n\n")
      bufferRef.current = parts.pop() || ""

      for (const part of parts) {
        const lines = part.split("\n")
        const dataLines: string[] = []
        let eventName = ""
        let id = ""

        for (const line of lines) {
          if (line.startsWith(":")) continue
          if (line.startsWith("event:")) {
            eventName = line.replace("event:", "").trim()
          } else if (line.startsWith("id:")) {
            id = line.replace("id:", "").trim()
          } else if (line.startsWith("data:")) {
            dataLines.push(line.replace("data:", "").trim())
          }
        }

        if (!dataLines.length) continue
        const raw = dataLines.join("\n")
        try {
          const payload = JSON.parse(raw)
          if (eventName === "ready") {
            continue
          }
          if (!payload || typeof payload !== "object") continue
          if (!payload.stationId && !payload.edgeKey && !payload.nodeIds) continue

          const eventId = payload.eventId || id
          if (eventId && seenRef.current.has(eventId)) continue
          if (eventId) seenRef.current.add(eventId)

          setStream((prev) => ({
            ...prev,
            events: [payload as PipelineEvent, ...prev.events].slice(0, MAX_EVENTS),
          }))
        } catch (err) {
          console.warn("Failed to parse stream event", err)
        }
      }
    }

    connect()

    return () => {
      active = false
      abortRef.current?.abort()
    }
  }, [eventsUrl, user])

  return stream
}
