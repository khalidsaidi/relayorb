import {
  DocumentReference,
  Query,
  onSnapshot,
  getDocs,
  DocumentSnapshot,
  QuerySnapshot,
  FirestoreError,
  Unsubscribe
} from "firebase/firestore"

export type RetryConfig = {
  maxRetries?: number
  baseDelayMs?: number
  maxDelayMs?: number
  onRetry?: (attempt: number, error: FirestoreError) => void
}

const DEFAULT_CONFIG: Required<Omit<RetryConfig, 'onRetry'>> = {
  maxRetries: 5,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
}

/**
 * Creates a Firestore onSnapshot subscription with automatic retry on failure.
 * Uses exponential backoff with jitter for reconnection attempts.
 */
export function onSnapshotWithRetry<T>(
  docRef: DocumentReference<T>,
  onNext: (snapshot: DocumentSnapshot<T>) => void,
  onError: (error: FirestoreError) => void,
  config: RetryConfig = {}
): Unsubscribe {
  const { maxRetries, baseDelayMs, maxDelayMs } = { ...DEFAULT_CONFIG, ...config }

  let retryCount = 0
  let unsubscribe: Unsubscribe | null = null
  let retryTimeout: ReturnType<typeof setTimeout> | null = null
  let isCleanedUp = false

  function calculateBackoff(attempt: number): number {
    // Exponential backoff with jitter
    const exponentialDelay = baseDelayMs * Math.pow(2, attempt)
    const jitter = Math.random() * 0.3 * exponentialDelay
    return Math.min(exponentialDelay + jitter, maxDelayMs)
  }

  function subscribe() {
    if (isCleanedUp) return

    unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        // Reset retry count on successful snapshot
        retryCount = 0
        onNext(snapshot)
      },
      (error) => {
        console.error(`Firestore subscription error (attempt ${retryCount + 1}):`, error.message)

        if (retryCount < maxRetries && !isCleanedUp) {
          const delay = calculateBackoff(retryCount)
          retryCount++

          config.onRetry?.(retryCount, error)

          console.log(`Retrying Firestore subscription in ${Math.round(delay)}ms...`)

          retryTimeout = setTimeout(() => {
            if (!isCleanedUp) {
              subscribe()
            }
          }, delay)
        } else {
          // Max retries exceeded, report final error
          onError(error)
        }
      }
    )
  }

  // Start initial subscription
  subscribe()

  // Return cleanup function
  return () => {
    isCleanedUp = true
    if (retryTimeout) {
      clearTimeout(retryTimeout)
      retryTimeout = null
    }
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
  }
}

/**
 * Executes a Firestore getDocs query with automatic retry on failure.
 * Uses exponential backoff with jitter for retry attempts.
 */
export async function getDocsWithRetry<T>(
  query: Query<T>,
  config: RetryConfig = {}
): Promise<QuerySnapshot<T>> {
  const { maxRetries, baseDelayMs, maxDelayMs } = { ...DEFAULT_CONFIG, ...config }

  let lastError: FirestoreError | Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await getDocs(query)
    } catch (error) {
      lastError = error as FirestoreError | Error
      console.error(`Firestore query failed (attempt ${attempt + 1}/${maxRetries + 1}):`, lastError.message)

      if (attempt < maxRetries) {
        const exponentialDelay = baseDelayMs * Math.pow(2, attempt)
        const jitter = Math.random() * 0.3 * exponentialDelay
        const delay = Math.min(exponentialDelay + jitter, maxDelayMs)

        config.onRetry?.(attempt + 1, lastError as FirestoreError)

        console.log(`Retrying Firestore query in ${Math.round(delay)}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError
}
