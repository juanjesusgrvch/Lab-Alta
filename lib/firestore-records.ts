import type { User } from "firebase/auth";
import type { DocumentData } from "firebase/firestore";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";

import {
  firestoreCollections,
  getFirebaseDb,
  type OperationalRecordKey,
} from "@/lib/firebase";

// Tipos
export interface StoredFirestoreRecord<TPayload extends DocumentData> {
  id: string;
  data: TPayload;
}

// Colecciones
const getOperationalCollectionName = (bucket: OperationalRecordKey) =>
  firestoreCollections[bucket];

export const getOperationalCollection = <TPayload extends DocumentData>(
  bucket: OperationalRecordKey,
) => collection(getFirebaseDb(), getOperationalCollectionName(bucket));

// Lectura
export const subscribeToRecords = <TPayload extends DocumentData>(
  bucket: OperationalRecordKey,
  onNext: (records: StoredFirestoreRecord<TPayload>[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe =>
  onSnapshot(
    getOperationalCollection<TPayload>(bucket),
    (snapshot) => {
      onNext(
        snapshot.docs.map((record) => ({
          id: record.id,
          data: record.data() as TPayload,
        })),
      );
    },
    (error) => {
      onError?.(error);
    },
  );

export const listLatestRecords = async <TPayload extends DocumentData>(
  bucket: OperationalRecordKey,
  size = 25,
): Promise<StoredFirestoreRecord<TPayload>[]> => {
  const snapshot = await getDocs(getOperationalCollection<TPayload>(bucket));

  return snapshot.docs.map((record) => ({
    id: record.id,
    data: record.data() as TPayload,
  })).slice(0, size);
};

// Escritura
export const createRecord = async <TPayload extends DocumentData>(
  bucket: OperationalRecordKey,
  recordId: string,
  data: TPayload,
  userId?: string,
) => {
  const recordRef = doc(getOperationalCollection<TPayload>(bucket), recordId);

  await setDoc(recordRef, {
    ...data,
    id: recordId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: userId ?? null,
    updatedBy: userId ?? null,
  });

  return recordRef;
};

export const saveRecord = async <TPayload extends DocumentData>(
  bucket: OperationalRecordKey,
  recordId: string,
  data: Partial<TPayload>,
  userId?: string,
) =>
  setDoc(
    doc(getOperationalCollection<TPayload>(bucket), recordId),
    {
      ...data,
      id: recordId,
      updatedAt: serverTimestamp(),
      updatedBy: userId ?? null,
    },
    { merge: true },
  );

export const deleteRecord = (bucket: OperationalRecordKey, recordId: string) =>
  deleteDoc(doc(getOperationalCollection(bucket), recordId));

// Usuario
export const syncSignedInUser = async (user: User) =>
  setDoc(
    doc(getFirebaseDb(), firestoreCollections.users, user.uid),
    {
      uid: user.uid,
      email: user.email ?? null,
      displayName: user.displayName ?? null,
      photoURL: user.photoURL ?? null,
      lastSeenAt: serverTimestamp(),
    },
    { merge: true },
  );
