import { initializeApp, type FirebaseApp } from "firebase/app"
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth"
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore"

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string | undefined,
}

export const firebaseEnabled = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
)

export let app: FirebaseApp | null = null
export let auth: Auth | null = null
export let db: Firestore | null = null

if (firebaseEnabled) {
  app = initializeApp(firebaseConfig)
  auth = getAuth(app)
  db = getFirestore(app)

  if (import.meta.env.VITE_USE_EMULATORS === "true") {
    const authHost = import.meta.env.VITE_AUTH_EMULATOR_HOST || "127.0.0.1"
    const authPort = Number(import.meta.env.VITE_AUTH_EMULATOR_PORT || "9099")
    connectAuthEmulator(auth, `http://${authHost}:${authPort}`, { disableWarnings: true })

    const firestoreHost = import.meta.env.VITE_FIRESTORE_EMULATOR_HOST || "127.0.0.1"
    const firestorePort = Number(import.meta.env.VITE_FIRESTORE_EMULATOR_PORT || "8081")
    connectFirestoreEmulator(db, firestoreHost, firestorePort)
  }
}
