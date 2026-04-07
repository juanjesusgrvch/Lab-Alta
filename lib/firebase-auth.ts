import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";

import { getFirebaseAuth } from "@/lib/firebase";

export const observeAuthState = (callback: (user: User | null) => void) =>
  onAuthStateChanged(getFirebaseAuth(), callback);

export const signInWithEmail = (email: string, password: string) =>
  signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);

export const requestPasswordReset = (email: string) =>
  sendPasswordResetEmail(getFirebaseAuth(), email.trim());

export const signOutSession = () => signOut(getFirebaseAuth());
