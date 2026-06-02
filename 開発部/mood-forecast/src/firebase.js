import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const app = initializeApp({
  apiKey:            'AIzaSyCRwPVssA88ojJLdUMsMdR5OCKXNdRlUCw',
  authDomain:        'mood-forecast-4c16b.firebaseapp.com',
  projectId:         'mood-forecast-4c16b',
  storageBucket:     'mood-forecast-4c16b.firebasestorage.app',
  messagingSenderId: '1082528902224',
  appId:             '1:1082528902224:web:1de0fbf17357698d103555',
})

export const auth = getAuth(app)
export const db = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()
