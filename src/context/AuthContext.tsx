import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  User, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase/config';
import { Administrator, AdminRole } from '../types';

interface AuthContextType {
  currentUser: User | null;
  adminProfile: Administrator | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isLoading: boolean;
  isDemoMode: boolean;
  toggleDemoMode: (enabled?: boolean) => void;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  provisionCurrentAsSuperAdmin: () => Promise<void>;
  authError: string | null;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Recognized initial bootstrap administrator from environment
const BOOTSTRAP_SUPER_ADMIN_EMAIL = 'jaraman1215@gmail.com';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [adminProfile, setAdminProfile] = useState<Administrator | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    return localStorage.getItem('hanaro_demo_mode') === 'true';
  });
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          // Check administrator collection
          const adminDocRef = doc(db, 'administrators', user.uid);
          const adminSnap = await getDoc(adminDocRef);

          if (adminSnap.exists()) {
            setAdminProfile(adminSnap.data() as Administrator);
          } else if (user.email === BOOTSTRAP_SUPER_ADMIN_EMAIL) {
            // Authorized bootstrap owner
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
        } catch (err) {
          console.warn('Could not read admin profile from Firestore:', err);
          if (user.email === BOOTSTRAP_SUPER_ADMIN_EMAIL) {
            setAdminProfile({
              uid: user.uid,
              email: user.email || '',
              name: user.displayName || 'Owner Admin',
              role: 'super_admin',
              createdAt: new Date().toISOString(),
            });
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
    setIsDemoMode(prev => {
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
    } catch (err: unknown) {
      console.error('Google Sign-In Error:', err);
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setAuthError(msg);
      throw err;
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
        signOutUser,
        provisionCurrentAsSuperAdmin,
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
