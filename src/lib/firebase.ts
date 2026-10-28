import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  Project,
  Building,
  Floor,
  Apartment,
  TourManifest,
  Inquiry,
  InquiryStatus,
} from '../types/property';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

let connectionTested = false;
export async function testFirestoreConnection(): Promise<void> {
  if (connectionTested) return;
  connectionTested = true;
  try {
    await getDocFromServer(doc(db, 'projects', 'connection-probe'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

export async function signInAdminWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  const credential = await signInWithPopup(auth, provider);
  return credential.user;
}

export async function signOutAdmin(): Promise<void> {
  await signOut(auth);
}

export { onAuthStateChanged };
export type { User };

/**
 * Saves a validated public inquiry or site visit request to Firestore `/inquiries/{id}`.
 * Strictly adheres to `firebase-blueprint.json` keys and `firestore.rules` constraints.
 */
export async function createInquiryInFirestore(inquiry: Inquiry): Promise<void> {
  const path = `inquiries/${inquiry.id}`;
  try {
    const payload = {
      id: inquiry.id.slice(0, 128),
      customerName: inquiry.customerName.trim().slice(0, 120),
      customerEmail: inquiry.customerEmail.trim().slice(0, 254),
      customerPhone: inquiry.customerPhone.trim().slice(0, 40),
      preferredContactMethod: inquiry.preferredContactMethod,
      inquiryType: inquiry.inquiryType,
      projectId: (inquiry.projectId || '').slice(0, 128),
      apartmentId: (inquiry.apartmentId || '').slice(0, 128),
      preferredDate: (inquiry.preferredDate || '').slice(0, 40),
      preferredTimeWindow: (inquiry.preferredTimeWindow || '').slice(0, 64),
      message: inquiry.message.trim().slice(0, 2000),
      status: inquiry.inquiryType === 'site_visit_request' ? 'site_visit_requested' : 'new',
      internalNotes: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'inquiries', inquiry.id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * Updates an inquiry status and internal notes in Firestore (requires verified Admin).
 */
export async function updateInquiryStatusInFirestore(
  inquiryId: string,
  status: InquiryStatus,
  internalNotes: string,
  preferredDate: string,
  preferredTimeWindow: string
): Promise<void> {
  const path = `inquiries/${inquiryId}`;
  try {
    await updateDoc(doc(db, 'inquiries', inquiryId), {
      status,
      internalNotes: internalNotes.slice(0, 2000),
      preferredDate: preferredDate.slice(0, 40),
      preferredTimeWindow: preferredTimeWindow.slice(0, 64),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Saves or updates a Project document in Firestore (requires verified Content Admin).
 */
export async function saveProjectToFirestore(project: Project, isCreate: boolean): Promise<void> {
  const path = `projects/${project.id}`;
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    if (isCreate) {
      await setDoc(doc(db, 'projects', project.id), {
        id: project.id.slice(0, 128),
        slug: project.slug.slice(0, 128),
        name: project.name.slice(0, 160),
        location: project.location.slice(0, 200),
        category: project.category.slice(0, 80),
        shortDescription: project.shortDescription.slice(0, 500),
        fullDescription: (project.fullDescription || '').slice(0, 3000),
        completionStatus: project.completionStatus,
        publicationStatus: project.publicationStatus,
        isDemonstration: Boolean(project.isDemonstration),
        ownerId: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'projects', project.id), {
        slug: project.slug.slice(0, 128),
        name: project.name.slice(0, 160),
        location: project.location.slice(0, 200),
        category: project.category.slice(0, 80),
        shortDescription: project.shortDescription.slice(0, 500),
        fullDescription: (project.fullDescription || '').slice(0, 3000),
        completionStatus: project.completionStatus,
        publicationStatus: project.publicationStatus,
        isDemonstration: Boolean(project.isDemonstration),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, isCreate ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function fetchPublishedProjectsFromFirestore(): Promise<Partial<Project>[]> {
  const path = 'projects';
  try {
    const q = query(collection(db, 'projects'), where('publicationStatus', '==', 'published'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as Partial<Project>);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchAdminInquiriesFromFirestore(): Promise<Inquiry[]> {
  const path = 'inquiries';
  try {
    const snap = await getDocs(collection(db, 'inquiries'));
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: data.id,
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        preferredContactMethod: data.preferredContactMethod,
        inquiryType: data.inquiryType,
        projectId: data.projectId || '',
        apartmentId: data.apartmentId || '',
        preferredDate: data.preferredDate || '',
        preferredTimeWindow: data.preferredTimeWindow || '',
        message: data.message,
        status: data.status,
        internalNotes: data.internalNotes || '',
        createdAt:
          data.createdAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
        updatedAt:
          data.updatedAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
      } satisfies Inquiry;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}
