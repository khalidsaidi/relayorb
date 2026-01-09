import { useEffect, useRef } from 'react'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, firebaseEnabled } from '@/lib/firebase'
import { useAuth } from '@/features/auth/auth-context'

const PRESENCE_COLLECTION = 'presence'

export function usePresence() {
  const { user } = useAuth()
  const lastUpdateRef = useRef<number>(0)
  const presenceRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!firebaseEnabled || !db || !user) return

    const userId = user.uid
    const userEmail = user.email || 'unknown'
    const presenceDocRef = doc(db, PRESENCE_COLLECTION, userId)

    // Track activity on mount
    const updatePresence = async () => {
      const now = Date.now()
      // Rate limit updates to once per 30 seconds to avoid too many writes
      if (now - lastUpdateRef.current < 30000) return
      lastUpdateRef.current = now

      try {
        await setDoc(
          presenceDocRef,
          {
            userId,
            email: userEmail,
            active: true,
            lastSeen: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        )
      } catch (err: unknown) {
        console.error('Failed to update presence', err)
      }
    }

    // Update on mount
    updatePresence()

    // Track activity on user interaction
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    const handleActivity = () => {
      updatePresence()
    }

    // Add listeners with throttling
    let activityThrottle: ReturnType<typeof setTimeout> | null = null
    const throttledActivity = () => {
      if (activityThrottle) return
      activityThrottle = setTimeout(() => {
        handleActivity()
        activityThrottle = null
      }, 30000) // Throttle to max once per 30 seconds
    }

    activityEvents.forEach((event) => {
      document.addEventListener(event, throttledActivity, { passive: true })
    })

    // Periodic heartbeat every 45 seconds while tab is visible
    const heartbeatInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        updatePresence()
      }
    }, 45000)

    // Track visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updatePresence()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Cleanup
    presenceRef.current = () => {
      activityEvents.forEach((event) => {
        document.removeEventListener(event, throttledActivity)
      })
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearInterval(heartbeatInterval)
      if (activityThrottle) clearTimeout(activityThrottle)
    }

    return () => {
      if (presenceRef.current) {
        presenceRef.current()
      }
      // Mark as inactive on cleanup
      setDoc(
        presenceDocRef,
        {
          userId,
          email: userEmail,
          active: false,
          lastSeen: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ).catch((err: unknown) => {
        console.error('Failed to clear presence', err)
      })
    }
  }, [user])
}
