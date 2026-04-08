import {
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithCustomToken,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";

import { getFirebaseAuth } from "@/lib/firebase";

export const observeAuthState = (callback: (user: User | null) => void) =>
  onAuthStateChanged(getFirebaseAuth(), callback);

export const signInWithEmail = (email: string, password: string) =>
  signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);

export const signInWithServerToken = (customToken: string) =>
  signInWithCustomToken(getFirebaseAuth(), customToken);

export const signInWithGoogle = () =>
  signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());

export const requestPasswordReset = (email: string) =>
  sendPasswordResetEmail(getFirebaseAuth(), email.trim());

export const signOutSession = () => signOut(getFirebaseAuth());
