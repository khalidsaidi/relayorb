import { initializeApp, getApps } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import { getFirestore } from "firebase-admin/firestore"

const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT || "relayorb"

export function getAdmin() {
  if (!getApps().length) {
    initializeApp({ projectId })
  }

  return {
    auth: getAuth(),
    db: getFirestore(),
  }
}
