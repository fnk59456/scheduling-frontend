import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'

type AuthMode = 'firebase' | 'token'
const AUTH_MODE = (import.meta.env.VITE_AUTH_MODE as AuthMode | undefined) || 'firebase'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
}

// 在本地 token 模式下，不初始化 Firebase（避免未设定 key 时直接崩溃）
let app: FirebaseApp | null = null
let auth: Auth | null = null

if (AUTH_MODE === 'firebase') {
  app = initializeApp(firebaseConfig)
  auth = getAuth(app)
}

export { auth }
export default app
