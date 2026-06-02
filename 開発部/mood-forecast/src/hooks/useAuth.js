import { useState, useEffect } from 'react'
import { auth, googleProvider } from '../firebase'
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth'

export function useAuth() {
  const [user, setUser] = useState(undefined) // undefined = loading

  useEffect(() => {
    return onAuthStateChanged(auth, setUser)
  }, [])

  const signIn = () => signInWithPopup(auth, googleProvider)
  const signOutUser = () => signOut(auth)

  return { user, signIn, signOut: signOutUser }
}
