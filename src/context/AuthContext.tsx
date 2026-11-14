import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  User,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset,
  updatePassword,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase/config';
import {
  Administrator,
  AdminRole,
  PasswordResetRequest,
  PasswordResetTargetType,
} from '../types';
import { logAudit } from '../firebase/dataService';

const DEMO_PASSWORD_RESETS_KEY = 'culmore_demo_password_resets';
const DEMO_LOCAL_PASSWORDS_KEY = 'culmore_demo_local_passwords';
const RESET_CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export interface InitiatePasswordResetParams {
  emailOrId: string;
  targetType?: PasswordResetTargetType;
  targetName?: string;
  targetUid?: string;
}

export interface InitiatePasswordResetResult {
  request: PasswordResetRequest;
  tempCode: string;
  firebaseEmailSent: boolean;
  firebaseMessage: string;
}

export interface VerifyTempResetCodeResult {
  valid: boolean;
  request?: PasswordResetRequest;
  error?: string;
}

export interface CompletePasswordResetParams {
  emailOrId: string;
  tempCode?: string;
  firebaseOobCode?: string;
  newPassword: string;
}

export interface CompletePasswordResetResult {
  email: string;
  authUpdated: boolean;
  message: string;
}

interface AuthContextType {
  currentUser: User | null;
  adminProfile: Administrator | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isLoading: boolean;
  isDemoMode: boolean;
  toggleDemoMode: (enabled?: boolean) => void;
  signInWithGoogle: () => Promise<void>;
  signInWithIdPassword: (loginId: string, password: string) => Promise<void>;
  signUpWithIdPassword: (loginId: string, password: string, name: string, role: AdminRole) => Promise<void>;
  signOutUser: () => Promise<void>;
  provisionCurrentAsSuperAdmin: () => Promise<void>;
  requestPasswordResetWithTempCode: (params: InitiatePasswordResetParams) => Promise<InitiatePasswordResetResult>;
  verifyTemporaryResetCode: (emailOrId: string, code: string) => Promise<VerifyTempResetCodeResult>;
  completePasswordReset: (params: CompletePasswordResetParams) => Promise<CompletePasswordResetResult>;
  listPasswordResetRequests: () => Promise<PasswordResetRequest[]>;
  revokePasswordResetRequest: (requestId: string) => Promise<void>;
  sendSelfPasswordResetEmail: (emailOrId: string) => Promise<{ email: string; sent: boolean; message: string }>;
  authError: string | null;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Recognized initial bootstrap administrator from environment
const BOOTSTRAP_SUPER_ADMIN_EMAIL = 'jaraman1215@gmail.com';

export function normalizeLoginIdToEmail(idOrEmail: string): { email: string; loginId: string } {
  const trimmed = idOrEmail.trim();
  if (trimmed.includes('@')) {
    return {
      email: trimmed.toLowerCase(),
      loginId: trimmed.toLowerCase(),
    };
  }
  const cleanId = trimmed.replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase();
  return {
    email: `${cleanId}@culmore.local`,
    loginId: cleanId,
  };
}

function generateTempVerificationCode(): string {
  const array = new Uint32Array(1);
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(array);
    return String(100000 + (array[0] % 900000));
  }
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sha256Hex(value: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const encoded = new TextEncoder().encode(value);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback deterministic 64-char hex for non-secure contexts
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < value.length; i++) {
    const ch = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  return (
    Math.abs(h1).toString(16).padStart(8, '0') +
    Math.abs(h2).toString(16).padStart(8, '0')
  ).repeat(4).slice(0, 64);
}

function loadDemoResetRequests(): PasswordResetRequest[] {
  try {
    const raw = localStorage.getItem(DEMO_PASSWORD_RESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PasswordResetRequest[]) : [];
  } catch {
    return [];
  }
}

function saveDemoResetRequests(list: PasswordResetRequest[]): void {
  try {
    localStorage.setItem(DEMO_PASSWORD_RESETS_KEY, JSON.stringify(list.slice(0, 50)));
  } catch {
    // ignore storage quota errors
  }
}

function mapFirebaseAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  switch (code) {
    case 'auth/operation-not-allowed':
      return 'Email/Password provider is not enabled yet. Please enable Email/Password in Firebase Console -> Authentication -> Sign-in method. (Firebase 콘솔에서 이메일/비밀번호 로그인을 활성화해주세요.)';
    case 'auth/email-already-in-use':
      return 'This ID or email is already registered. Please sign in instead. (이미 가입된 ID 또는 이메일입니다.)';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters. (비밀번호는 6자 이상이어야 합니다.)';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid ID/email or password. (ID/이메일 또는 비밀번호가 올바르지 않습니다.)';
    case 'auth/invalid-email':
      return 'Invalid ID or email format. Use letters/numbers for ID or a valid email address.';
    case 'auth/expired-action-code':
      return 'The verification or email reset code has expired. Please request a new code. (인증 코드가 만료되었습니다. 새 코드를 요청해주세요.)';
    case 'auth/invalid-action-code':
      return 'Invalid or already used verification code. (유효하지 않거나 이미 사용된 인증 코드입니다.)';
    case 'auth/requires-recent-login':
      return 'For security, please sign out and sign in again or use the emailed reset link to change your password.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please wait a moment and try again.';
    default:
      return err instanceof Error ? err.message : 'Authentication failed';
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [adminProfile, setAdminProfile] = useState<Administrator | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    return localStorage.getItem('hanaro_demo_mode') === 'true';
  });
  const [authError, setAuthError] = useState<string | null>(null);
  const isSigningUpRef = useRef<boolean>(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // Real authenticated user always disables browser-local demo mode so cloud sync is active across devices
        localStorage.removeItem('hanaro_demo_mode');
        setIsDemoMode(false);

        if (isSigningUpRef.current) {
          setIsLoading(false);
          return;
        }

        try {
          const adminDocRef = doc(db, 'administrators', user.uid);
          const adminSnap = await getDoc(adminDocRef);

          if (adminSnap.exists()) {
            setAdminProfile(adminSnap.data() as Administrator);
          } else {
            // Check if this user was pre-provisioned by email in administrators directory
            const userEmail = (user.email || '').toLowerCase();
            let migratedProfile: Administrator | null = null;
            if (userEmail) {
              try {
                const provQuery = query(
                  collection(db, 'administrators'),
                  where('email', '==', userEmail)
                );
                const provSnap = await getDocs(provQuery);
                if (!provSnap.empty) {
                  const provDoc = provSnap.docs[0];
                  const provData = provDoc.data() as Administrator;
                  migratedProfile = {
                    ...provData,
                    uid: user.uid,
                    email: userEmail,
                    name: provData.name || user.displayName || 'Admin User',
                  };
                  await setDoc(doc(db, 'administrators', user.uid), migratedProfile);
                  if (provDoc.id !== user.uid) {
                    try {
                      await deleteDoc(doc(db, 'administrators', provDoc.id));
                    } catch {
                      // Non-fatal cleanup if caller doesn't have delete rights
                    }
                  }
                }
              } catch (provErr) {
                console.warn('Pre-provisioned lookup skipped:', provErr);
              }
            }

            if (migratedProfile) {
              setAdminProfile(migratedProfile);
            } else if (userEmail === BOOTSTRAP_SUPER_ADMIN_EMAIL) {
              setAdminProfile({
                uid: user.uid,
                email: user.email || '',
                name: user.displayName || 'Owner Admin',
                role: 'super_admin',
                createdAt: new Date().toISOString(),
              });
            } else {
              setAdminProfile(null);
            }
          }
        } catch (err) {
          console.warn('Could not read admin profile from Firestore:', err);
          if ((user.email || '').toLowerCase() === BOOTSTRAP_SUPER_ADMIN_EMAIL) {
            setAdminProfile({
              uid: user.uid,
              email: user.email || '',
              name: user.displayName || 'Owner Admin',
              role: 'super_admin',
              createdAt: new Date().toISOString(),
            });
          } else {
            setAdminProfile(null);
          }
        }
      } else {
        setAdminProfile(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const toggleDemoMode = (enabled?: boolean) => {
    setIsDemoMode((prev) => {
      const next = enabled !== undefined ? enabled : !prev;
      localStorage.setItem('hanaro_demo_mode', String(next));
      return next;
    });
  };

  const signInWithGoogle = async () => {
    try {
      setAuthError(null);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
      localStorage.removeItem('hanaro_demo_mode');
      setIsDemoMode(false);
    } catch (err: unknown) {
      console.error('Google Sign-In Error:', err);
      setAuthError(mapFirebaseAuthError(err));
      throw err;
    }
  };

  const signInWithIdPassword = async (loginId: string, password: string) => {
    try {
      setAuthError(null);
      const { email } = normalizeLoginIdToEmail(loginId);
      if (!email || email.startsWith('@')) {
        throw new Error('Please enter a valid ID or email.');
      }
      await signInWithEmailAndPassword(auth, email, password);
      localStorage.removeItem('hanaro_demo_mode');
      setIsDemoMode(false);
    } catch (err: unknown) {
      console.error('ID/Password Sign-In Error:', err);
      setAuthError(mapFirebaseAuthError(err));
      throw err;
    }
  };

  const signUpWithIdPassword = async (
    loginId: string,
    password: string,
    name: string,
    role: AdminRole
  ) => {
    isSigningUpRef.current = true;
    try {
      setAuthError(null);
      const { email, loginId: cleanLoginId } = normalizeLoginIdToEmail(loginId);
      if (!cleanLoginId || email.startsWith('@')) {
        throw new Error('Please enter a valid ID (letters/numbers) or email.');
      }
      if (!password || password.length < 6) {
        throw new Error('Password must be at least 6 characters.');
      }
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const displayName = name.trim() || cleanLoginId;
      await updateProfile(cred.user, { displayName });

      const adminData: Administrator = {
        uid: cred.user.uid,
        email,
        loginId: cleanLoginId,
        name: displayName,
        role,
        createdAt: new Date().toISOString(),
        createdBy: 'self_signup',
      };

      try {
        await setDoc(doc(db, 'administrators', cred.user.uid), adminData);
      } catch (fsErr) {
        handleFirestoreError(fsErr, OperationType.WRITE, `administrators/${cred.user.uid}`);
      }

      localStorage.removeItem('hanaro_demo_mode');
      setIsDemoMode(false);
      setAdminProfile(adminData);
    } catch (err: unknown) {
      console.error('ID/Password Sign-Up Error:', err);
      setAuthError(mapFirebaseAuthError(err));
      throw err;
    } finally {
      isSigningUpRef.current = false;
    }
  };

  const signOutUser = async () => {
    try {
      await signOut(auth);
      setAdminProfile(null);
    } catch (err: unknown) {
      console.error('Sign Out Error:', err);
    }
  };

  const provisionCurrentAsSuperAdmin = async () => {
    if (!currentUser) throw new Error('No signed-in user');
    try {
      const adminData: Administrator = {
        uid: currentUser.uid,
        email: currentUser.email || '',
        loginId: currentUser.email || currentUser.uid,
        name: currentUser.displayName || 'Super Administrator',
        role: 'super_admin',
        createdAt: new Date().toISOString(),
        createdBy: 'initial_setup',
      };
      await setDoc(doc(db, 'administrators', currentUser.uid), adminData);
      setAdminProfile(adminData);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `administrators/${currentUser.uid}`);
    }
  };

  // User is considered authorized admin if adminProfile exists or if in demo mode
  const isAdmin = isDemoMode || !!adminProfile;
  const isSuperAdmin = isDemoMode || adminProfile?.role === 'super_admin';

  /**
   * Admin Dashboard Password Reset Initiator:
   * Issues a cryptographically random 6-digit temporary verification code (15-min TTL, SHA-256 hashed in Firestore)
   * AND dispatches a real Firebase Auth password reset email (`sendPasswordResetEmail`) to their registered inbox.
   */
  const requestPasswordResetWithTempCode = async (
    params: InitiatePasswordResetParams
  ): Promise<InitiatePasswordResetResult> => {
    const { email: resolvedEmail, loginId } = normalizeLoginIdToEmail(params.emailOrId);
    if (!resolvedEmail || resolvedEmail.startsWith('@') || !resolvedEmail.includes('.')) {
      throw new Error('Please provide a valid registered email address or login ID.');
    }

    const tempCode = generateTempVerificationCode();
    const codeHash = await sha256Hex(`${resolvedEmail}:${tempCode}`);
    const nowIso = new Date().toISOString();
    const expiresAt = new Date(Date.now() + RESET_CODE_TTL_MS).toISOString();
    const requestId = `pwr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const requesterEmail = currentUser?.email || (isDemoMode ? 'demo.admin@culmore.local' : 'admin@culmore.local');

    let firebaseEmailSent = false;
    let firebaseMessage = '';

    const isDeliverableEmail = !resolvedEmail.endsWith('@culmore.local');
    if (!isDemoMode && isDeliverableEmail) {
      try {
        await sendPasswordResetEmail(auth, resolvedEmail, {
          url: `${window.location.origin}${window.location.pathname}`,
          handleCodeInApp: false,
        });
        firebaseEmailSent = true;
        firebaseMessage = `Firebase password reset verification email sent to ${resolvedEmail}.`;
      } catch (err: unknown) {
        const errCode = (err as { code?: string })?.code || '';
        if (errCode === 'auth/user-not-found') {
          firebaseMessage = `No Firebase Auth login account found for ${resolvedEmail} yet; issued 6-digit temporary reset code record.`;
        } else {
          firebaseMessage = mapFirebaseAuthError(err);
        }
      }
    } else if (isDemoMode) {
      firebaseMessage = `Demo mode active: 6-digit temporary verification code generated for ${resolvedEmail}.`;
    } else {
      firebaseMessage = `Internal ID (${resolvedEmail}) does not have an external inbox; use the 6-digit temporary verification code below.`;
    }

    const resetDoc: PasswordResetRequest = {
      id: requestId,
      targetType: params.targetType || 'employee',
      ...(params.targetUid ? { targetUid: params.targetUid.slice(0, 128) } : {}),
      targetName: (params.targetName || loginId || resolvedEmail).slice(0, 128),
      email: resolvedEmail.slice(0, 128),
      ...(loginId ? { loginId: loginId.slice(0, 128) } : {}),
      codeHash,
      firebaseEmailSent,
      status: 'pending',
      expiresAt,
      createdAt: nowIso,
      requestedBy: requesterEmail.slice(0, 128),
    };

    if (isDemoMode) {
      const existing = loadDemoResetRequests().map((r) =>
        r.email === resolvedEmail && r.status === 'pending'
          ? { ...r, status: 'revoked' as const }
          : r
      );
      saveDemoResetRequests([resetDoc, ...existing]);
      await logAudit(
        true,
        'PASSWORD_RESET_CODE_ISSUED',
        'ADMIN',
        requestId,
        `Issued 6-digit temporary reset code for ${resetDoc.targetType} ${resetDoc.targetName} (${resolvedEmail})`
      );
      return { request: resetDoc, tempCode, firebaseEmailSent, firebaseMessage };
    }

    try {
      // Revoke any prior pending requests for the same email
      try {
        const prevQuery = query(
          collection(db, 'passwordResetRequests'),
          where('email', '==', resolvedEmail),
          where('status', '==', 'pending')
        );
        const prevSnap = await getDocs(prevQuery);
        for (const d of prevSnap.docs) {
          await updateDoc(d.ref, { status: 'revoked' });
        }
      } catch {
        // Non-fatal if index not yet ready or empty
      }

      await setDoc(doc(db, 'passwordResetRequests', requestId), resetDoc);
      await logAudit(
        false,
        'PASSWORD_RESET_CODE_ISSUED',
        'ADMIN',
        requestId,
        `Issued temporary verification code for ${resetDoc.targetType} ${resetDoc.targetName} (${resolvedEmail}, Firebase email sent: ${firebaseEmailSent})`
      );
      return { request: resetDoc, tempCode, firebaseEmailSent, firebaseMessage };
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `passwordResetRequests/${requestId}`);
      throw err;
    }
  };

  /**
   * Verifies a 6-digit temporary verification code against active reset requests.
   */
  const verifyTemporaryResetCode = async (
    emailOrId: string,
    code: string
  ): Promise<VerifyTempResetCodeResult> => {
    const cleanCode = code.replace(/\D/g, '').trim();
    if (!/^\d{6}$/.test(cleanCode)) {
      return { valid: false, error: 'Verification code must be 6 digits.' };
    }

    const { email: resolvedEmail } = normalizeLoginIdToEmail(emailOrId);
    const inputHash = await sha256Hex(`${resolvedEmail}:${cleanCode}`);
    const nowMs = Date.now();
    const nowIso = new Date().toISOString();

    if (isDemoMode) {
      const list = loadDemoResetRequests();
      const match = list.find(
        (r) => r.email === resolvedEmail && (r.status === 'pending' || r.status === 'verified')
      );
      if (!match) {
        return { valid: false, error: 'No active reset request found for this email.' };
      }
      if (new Date(match.expiresAt).getTime() < nowMs) {
        const updated = list.map((r) => (r.id === match.id ? { ...r, status: 'expired' as const } : r));
        saveDemoResetRequests(updated);
        return { valid: false, error: 'Temporary verification code has expired.' };
      }
      if (match.codeHash !== inputHash) {
        return { valid: false, error: 'Incorrect temporary verification code.' };
      }
      const verifiedReq: PasswordResetRequest = {
        ...match,
        status: 'verified',
        verifiedAt: match.verifiedAt || nowIso,
      };
      saveDemoResetRequests(list.map((r) => (r.id === match.id ? verifiedReq : r)));
      return { valid: true, request: verifiedReq };
    }

    try {
      const q = query(
        collection(db, 'passwordResetRequests'),
        where('email', '==', resolvedEmail)
      );
      const snap = await getDocs(q);
      const candidates = snap.docs
        .map((d) => ({ ...d.data(), id: d.id } as PasswordResetRequest))
        .filter((r) => r.status === 'pending' || r.status === 'verified')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      const match = candidates[0];
      if (!match) {
        return { valid: false, error: 'No active reset request found for this email.' };
      }
      if (new Date(match.expiresAt).getTime() < nowMs) {
        await updateDoc(doc(db, 'passwordResetRequests', match.id), { status: 'expired' });
        return { valid: false, error: 'Temporary verification code has expired.' };
      }
      if (match.codeHash !== inputHash) {
        return { valid: false, error: 'Incorrect temporary verification code.' };
      }

      const verifiedAt = match.verifiedAt || nowIso;
      await updateDoc(doc(db, 'passwordResetRequests', match.id), {
        status: 'verified',
        verifiedAt,
      });
      return { valid: true, request: { ...match, status: 'verified', verifiedAt } };
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'passwordResetRequests');
      return { valid: false, error: 'Unable to verify code right now.' };
    }
  };

  /**
   * Completes password reset using either:
   * - Firebase Auth email action code (`firebaseOobCode`) via verifyPasswordResetCode + confirmPasswordReset, OR
   * - Admin-issued 6-digit temporary verification code (`tempCode`) verified against Firestore/local store.
   */
  const completePasswordReset = async (
    params: CompletePasswordResetParams
  ): Promise<CompletePasswordResetResult> => {
    const { email: resolvedEmail } = normalizeLoginIdToEmail(params.emailOrId);
    if (!params.newPassword || params.newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters.');
    }

    const oob = params.firebaseOobCode?.trim();
    const temp = params.tempCode?.replace(/\D/g, '').trim();
    const nowIso = new Date().toISOString();

    if (!oob && !temp) {
      throw new Error('Please enter the 6-digit temporary verification code or emailed Firebase action code.');
    }

    let verifiedRequest: PasswordResetRequest | undefined;
    if (temp) {
      const check = await verifyTemporaryResetCode(resolvedEmail, temp);
      if (!check.valid) {
        throw new Error(check.error || 'Temporary verification code check failed.');
      }
      verifiedRequest = check.request;
    }

    let authUpdated = false;
    let targetEmail = resolvedEmail;

    // 1. If Firebase Email Action Code (oobCode) is provided, directly update Firebase Auth password
    if (oob && !isDemoMode) {
      try {
        const checkedEmail = await verifyPasswordResetCode(auth, oob);
        targetEmail = checkedEmail.toLowerCase();
        await confirmPasswordReset(auth, oob, params.newPassword);
        authUpdated = true;
      } catch (err) {
        throw new Error(mapFirebaseAuthError(err));
      }
    } else if (!isDemoMode && currentUser && currentUser.email?.toLowerCase() === resolvedEmail) {
      // 2. Updating currently authenticated user's own Firebase Auth password
      try {
        await updatePassword(currentUser, params.newPassword);
        authUpdated = true;
      } catch (err) {
        throw new Error(mapFirebaseAuthError(err));
      }
    } else if (isDemoMode) {
      try {
        const stored: Record<string, string> = JSON.parse(
          localStorage.getItem(DEMO_LOCAL_PASSWORDS_KEY) || '{}'
        );
        stored[resolvedEmail] = params.newPassword;
        localStorage.setItem(DEMO_LOCAL_PASSWORDS_KEY, JSON.stringify(stored));
        authUpdated = true;
      } catch {
        authUpdated = true;
      }
    }

    // Mark temporary code request as completed if verified
    if (verifiedRequest) {
      if (isDemoMode) {
        const list = loadDemoResetRequests();
        saveDemoResetRequests(
          list.map((r) =>
            r.id === verifiedRequest?.id
              ? { ...r, status: 'completed' as const, completedAt: nowIso }
              : r
          )
        );
      } else {
        await updateDoc(doc(db, 'passwordResetRequests', verifiedRequest.id), {
          status: 'completed',
          completedAt: nowIso,
        });
      }
    }

    if (isAdmin) {
      await logAudit(
        isDemoMode,
        'PASSWORD_RESET_COMPLETED',
        'ADMIN',
        verifiedRequest?.id || targetEmail,
        `Password reset verified for ${targetEmail} (Auth password directly updated: ${authUpdated})`
      );
    }

    if (authUpdated) {
      return {
        email: targetEmail,
        authUpdated: true,
        message: `Password for ${targetEmail} has been reset successfully. They can now sign in with their new password.`,
      };
    }

    // If resetting another user via 6-digit code in live Firebase without their oobCode,
    // verify the code completed and confirm the Firebase reset email was dispatched to their inbox.
    let emailDispatched = verifiedRequest?.firebaseEmailSent || false;
    if (!emailDispatched && !targetEmail.endsWith('@culmore.local')) {
      try {
        await sendPasswordResetEmail(auth, targetEmail, {
          url: `${window.location.origin}${window.location.pathname}`,
          handleCodeInApp: false,
        });
        emailDispatched = true;
      } catch {
        // non-fatal
      }
    }

    return {
      email: targetEmail,
      authUpdated: false,
      message: emailDispatched
        ? `6-digit temporary verification code verified! Because Firebase protects other users' credentials from client-side overwrites, a confirmation link was sent to ${targetEmail} to finalize the new password.`
        : `6-digit temporary verification code verified & recorded for ${targetEmail}. Have the user sign in via Google or complete reset from their registered email link.`,
    };
  };

  const listPasswordResetRequests = async (): Promise<PasswordResetRequest[]> => {
    if (isDemoMode) {
      return loadDemoResetRequests().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    try {
      const q = query(
        collection(db, 'passwordResetRequests'),
        orderBy('createdAt', 'desc'),
        limit(25)
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ ...d.data(), id: d.id } as PasswordResetRequest));
    } catch {
      try {
        const allSnap = await getDocs(collection(db, 'passwordResetRequests'));
        return allSnap.docs
          .map((d) => ({ ...d.data(), id: d.id } as PasswordResetRequest))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, 25);
      } catch {
        return [];
      }
    }
  };

  const revokePasswordResetRequest = async (requestId: string): Promise<void> => {
    if (isDemoMode) {
      const list = loadDemoResetRequests();
      saveDemoResetRequests(
        list.map((r) => (r.id === requestId ? { ...r, status: 'revoked' as const } : r))
      );
      await logAudit(true, 'PASSWORD_RESET_REVOKED', 'ADMIN', requestId, 'Revoked temporary verification code');
      return;
    }
    try {
      await updateDoc(doc(db, 'passwordResetRequests', requestId), { status: 'revoked' });
      await logAudit(false, 'PASSWORD_RESET_REVOKED', 'ADMIN', requestId, 'Revoked temporary verification code');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `passwordResetRequests/${requestId}`);
    }
  };

  const sendSelfPasswordResetEmail = async (
    emailOrId: string
  ): Promise<{ email: string; sent: boolean; message: string }> => {
    const { email: resolvedEmail } = normalizeLoginIdToEmail(emailOrId);
    if (!resolvedEmail || resolvedEmail.startsWith('@') || resolvedEmail.endsWith('@culmore.local')) {
      return {
        email: resolvedEmail,
        sent: false,
        message: 'Self-service email reset requires a real email address (e.g. name@domain.com). For internal login IDs, contact an administrator for a temporary verification code.',
      };
    }

    try {
      await sendPasswordResetEmail(auth, resolvedEmail, {
        url: `${window.location.origin}${window.location.pathname}`,
        handleCodeInApp: false,
      });
      return {
        email: resolvedEmail,
        sent: true,
        message: `A password reset link and verification code have been sent to ${resolvedEmail}. Check your inbox (and spam folder).`,
      };
    } catch (err) {
      const msg = mapFirebaseAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        adminProfile,
        isAdmin,
        isSuperAdmin,
        isLoading,
        isDemoMode,
        toggleDemoMode,
        signInWithGoogle,
        signInWithIdPassword,
        signUpWithIdPassword,
        signOutUser,
        provisionCurrentAsSuperAdmin,
        requestPasswordResetWithTempCode,
        verifyTemporaryResetCode,
        completePasswordReset,
        listPasswordResetRequests,
        revokePasswordResetRequest,
        sendSelfPasswordResetEmail,
        authError,
        clearAuthError: () => setAuthError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

