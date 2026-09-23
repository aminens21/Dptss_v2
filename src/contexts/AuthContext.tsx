import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, query, collection, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { User, Role, SUPER_ADMIN_EMAILS, Directorate } from '../types';
import { DataService } from '../lib/dataService';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: User | null;
  loading: boolean;
  isDemo: boolean;
  isProfileModalOpen: boolean;
  isDirectoratePromptOpen: boolean;
  setIsProfileModalOpen: (open: boolean) => void;
  setIsDirectoratePromptOpen: (open: boolean) => void;
  openProfileModal: () => void;
  closeProfileModal: () => void;
  loginAsDemo: (role: Role, name?: string, email?: string, sportId?: string, assignedTournamentId?: string, extraFields?: Partial<User>) => void;
  logout: () => Promise<void>;
  updateProfileState: (updatedFields: Partial<User>) => void;
  assignUserDirectorate: (directorateId: string, directorateName: string) => Promise<void>;
}

export const CENTRAL_ADMIN_EMAIL = 'aminens21@gmail.com';

export const isSuperAdminEmail = (email?: string): boolean => {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email.trim().toLowerCase());
};

const DEMO_PROFILES: Record<Role, { name: string; email: string; sportId?: string; workLocation?: string; leaseNumber?: string; directorateId?: string; directorateName?: string }> = {
  CENTRAL_ADMIN: {
    name: 'المسؤول المركزي (المشرف العام)',
    email: 'aminens21@gmail.com',
    directorateId: 'taourirt',
    directorateName: 'المديرية الإقليمية بتاوريرت'
  },
  SPORT_MANAGER: {
    name: 'ذ. مصطفى الغازي (مسؤول كرة السلة)',
    email: 'ghazi.basket@taourirt.ma',
    sportId: 'basketball',
    directorateId: 'taourirt',
    directorateName: 'المديرية الإقليمية بتاوريرت'
  },
  TEACHER: {
    name: 'أستاذ التربية البدنية (ثانوية الفتح)',
    email: 'prof.eps@taourirt-sports.ma',
    workLocation: 'ثانوية الفتح التأهيلية',
    leaseNumber: '1234567',
    directorateId: 'taourirt',
    directorateName: 'المديرية الإقليمية بتاوريرت'
  },
  REFEREE: {
    name: 'الحكم المعتمد (محمد العلوي)',
    email: 'referee@taourirt-sports.ma',
    directorateId: 'taourirt',
    directorateName: 'المديرية الإقليمية بتاوريرت'
  },
};

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  userProfile: null,
  loading: true,
  isDemo: false,
  isProfileModalOpen: false,
  isDirectoratePromptOpen: false,
  setIsProfileModalOpen: () => {},
  setIsDirectoratePromptOpen: () => {},
  openProfileModal: () => {},
  closeProfileModal: () => {},
  loginAsDemo: () => {},
  logout: async () => {},
  updateProfileState: () => {},
  assignUserDirectorate: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isDirectoratePromptOpen, setIsDirectoratePromptOpen] = useState(false);

  const openProfileModal = () => setIsProfileModalOpen(true);
  const closeProfileModal = () => setIsProfileModalOpen(false);

  // Check demo session on load
  useEffect(() => {
    const savedDemo = localStorage.getItem('demo_user_profile');
    if (savedDemo) {
      try {
        const parsed = JSON.parse(savedDemo) as User;
        const isSuper = isSuperAdminEmail(parsed.email);
        const resolvedProfile = {
          ...parsed,
          isSuperAdmin: isSuper || parsed.isSuperAdmin,
          role: isSuper ? 'CENTRAL_ADMIN' : parsed.role
        };
        setUserProfile(resolvedProfile);
        setIsDemo(true);
        // We don't set loading to false yet, we let onAuthStateChanged decide
      } catch (e) {
        localStorage.removeItem('demo_user_profile');
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        setIsDemo(false);
        localStorage.removeItem('demo_user_profile');
        const cleanUserEmail = (user.email || '').toLowerCase().trim();
        const isSuperAdmin = isSuperAdminEmail(cleanUserEmail);

        try {
          // Check directorates to see if this user is a directorate admin
          const directorates = await DataService.getDirectorates();
          const managedDirectorate = directorates.find(d => 
            (d.adminEmails || []).some(ae => ae.trim().toLowerCase() === cleanUserEmail)
          );

          let userDoc = await getDoc(doc(db, 'users', user.uid));
          let matchedData: any = null;
          let docId = user.uid;

          if (userDoc.exists()) {
            matchedData = userDoc.data();
          } else {
            // Check if there is another user document with the same email in Firestore (pre-registered by admin)
            try {
              const q = query(collection(db, 'users'), where('email', '==', cleanUserEmail));
              const querySnap = await getDocs(q);
              if (!querySnap.empty) {
                const foundDoc = querySnap.docs[0];
                matchedData = foundDoc.data();
                docId = foundDoc.id;
              }
            } catch (err) {
              console.warn("Error querying users by email:", err);
            }
          }

          if (matchedData) {
            const data = matchedData as User;
            let role: Role = data.role;
            if (isSuperAdmin) {
              role = 'CENTRAL_ADMIN';
            } else if (managedDirectorate) {
              role = 'CENTRAL_ADMIN';
            }

            const profile: User = {
              id: user.uid, // Migrate/link to the user's Auth uid
              ...data,
              role,
              isSuperAdmin,
              directorateId: data.directorateId || managedDirectorate?.id || 'taourirt',
              directorateName: data.directorateName || managedDirectorate?.name || 'المديرية الإقليمية بتاوريرت'
            };

            // Migrate/Save under the new auth uid in Firestore so it's linked to their Auth account
            if (docId !== user.uid) {
              try {
                await setDoc(doc(db, 'users', user.uid), {
                  ...profile,
                  updatedAt: serverTimestamp()
                }, { merge: true });
              } catch (saveErr) {
                console.warn("Could not migrate pre-registered user to user.uid:", saveErr);
              }
            }

            setUserProfile(profile);

            // Automatically set the active directorate in localStorage for non-super admins to their assigned directorate
            if (!isSuperAdmin && profile.directorateId) {
              DataService.setActiveDirectorateId(profile.directorateId);
            }

            // If user is a teacher and has no directorate selected yet, prompt for directorate
            if (!isSuperAdmin && !managedDirectorate && !data.directorateId) {
              setIsDirectoratePromptOpen(true);
            }
          } else {
            // Check if there is a pre-registered manager account in Firestore
            const managerDocId = `mgr_${cleanUserEmail.replace(/[^a-z0-9]/g, '_')}`;
            let detectedRole: Role = isSuperAdmin ? 'CENTRAL_ADMIN' : (managedDirectorate ? 'CENTRAL_ADMIN' : 'TEACHER');
            let detectedName = user.displayName || (isSuperAdmin ? 'المسير المركزي الرئيسي' : user.email?.split('@')[0] || 'مستخدم');
            let detectedSportId: string | undefined = undefined;
            let detectedTournamentId: string | undefined = undefined;

            try {
              const mgrDoc = await getDoc(doc(db, 'users', managerDocId));
              if (mgrDoc.exists()) {
                const mgrData = mgrDoc.data();
                detectedRole = 'SPORT_MANAGER';
                if (mgrData.fullName) detectedName = mgrData.fullName;
                if (mgrData.sportId) detectedSportId = mgrData.sportId;
                if (mgrData.assignedTournamentId) detectedTournamentId = mgrData.assignedTournamentId;
              }
            } catch (mgrErr) {
              console.warn("Manager lookup warning:", mgrErr);
            }

            const initialDirectorateId = managedDirectorate?.id || (isSuperAdmin ? 'taourirt' : undefined);
            const initialDirectorateName = managedDirectorate?.name || (isSuperAdmin ? 'المديرية الإقليمية بتاوريرت' : undefined);

            const newProfile: User = {
              id: user.uid,
              fullName: detectedName,
              email: cleanUserEmail,
              role: detectedRole,
              sportId: detectedSportId,
              assignedTournamentId: detectedTournamentId,
              directorateId: initialDirectorateId,
              directorateName: initialDirectorateName,
              isSuperAdmin,
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            // Save to Firestore
            try {
              await setDoc(doc(db, 'users', user.uid), {
                ...newProfile,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
              });
            } catch (saveErr) {
              console.warn("Could not save new user document to Firestore:", saveErr);
            }

            setUserProfile(newProfile);

            // Automatically set the active directorate in localStorage for non-super admins to their assigned directorate
            if (!isSuperAdmin && newProfile.directorateId) {
              DataService.setActiveDirectorateId(newProfile.directorateId);
            }

            if (!isSuperAdmin && !managedDirectorate && !initialDirectorateId) {
              setIsDirectoratePromptOpen(true);
            }
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          const isSuper = isSuperAdminEmail(cleanUserEmail);
          setUserProfile({
            id: user.uid,
            fullName: isSuper ? 'المسير المركزي الرئيسي' : (user.displayName || user.email || 'مستخدم'),
            email: cleanUserEmail,
            role: isSuper ? 'CENTRAL_ADMIN' : 'TEACHER',
            isSuperAdmin: isSuper,
            directorateId: 'taourirt',
            directorateName: 'المديرية الإقليمية بتاوريرت',
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      } else {
        if (!localStorage.getItem('demo_user_profile')) {
          setUserProfile(null);
        }
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const loginAsDemo = (role: Role, customName?: string, customEmail?: string, sportId?: string, assignedTournamentId?: string, extraFields?: Partial<User>) => {
    const defaultInfo = DEMO_PROFILES[role] || DEMO_PROFILES.CENTRAL_ADMIN;
    const targetEmail = (customEmail || defaultInfo.email).trim().toLowerCase();
    const isSuper = isSuperAdminEmail(targetEmail) || (role === 'CENTRAL_ADMIN' && (targetEmail === 'aminens21@gmail.com' || targetEmail === 'omrhaman.figuig@gmail.com'));

    const demoProfile: User = {
      id: `demo-${role.toLowerCase()}`,
      fullName: customName || defaultInfo.name,
      email: targetEmail,
      role: isSuper ? 'CENTRAL_ADMIN' : role,
      isSuperAdmin: isSuper,
      sportId: sportId || defaultInfo.sportId,
      assignedTournamentId: assignedTournamentId,
      directorateId: extraFields?.directorateId || defaultInfo.directorateId || 'taourirt',
      directorateName: extraFields?.directorateName || defaultInfo.directorateName || 'المديرية الإقليمية بتاوريرت',
      workLocation: defaultInfo.workLocation,
      leaseNumber: defaultInfo.leaseNumber,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...extraFields
    };

    localStorage.setItem('demo_user_profile', JSON.stringify(demoProfile));
    setUserProfile(demoProfile);
    
    // Automatically set the active directorate in localStorage for non-super admins to their assigned directorate
    if (!isSuper && demoProfile.directorateId) {
      DataService.setActiveDirectorateId(demoProfile.directorateId);
    }
    setIsDemo(true);
    setCurrentUser({
      uid: demoProfile.id,
      email: demoProfile.email,
      displayName: demoProfile.fullName,
      emailVerified: true,
      isAnonymous: false,
    } as any);
  };

  const logout = async () => {
    localStorage.removeItem('demo_user_profile');
    setUserProfile(null);
    setIsDemo(false);
    setCurrentUser(null);
    try {
      await auth.signOut();
    } catch (e) {
      console.warn("Auth signout:", e);
    }
  };

  const updateProfileState = (updatedFields: Partial<User>) => {
    setUserProfile(prev => {
      if (!prev) return null;
      const updated = { ...prev, ...updatedFields };
      if (isDemo) {
        localStorage.setItem('demo_user_profile', JSON.stringify(updated));
      }
      return updated;
    });
  };

  const assignUserDirectorate = async (directorateId: string, directorateName: string) => {
    if (!userProfile) return;
    const updated: Partial<User> = { directorateId, directorateName };
    updateProfileState(updated);
    setIsDirectoratePromptOpen(false);

    // Save to Firestore if real user
    if (currentUser?.uid && !isDemo) {
      try {
        await setDoc(doc(db, 'users', currentUser.uid), {
          ...updated,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (err) {
        console.warn("Error updating user directorate in Firestore:", err);
      }
    }

    // Set active directorate
    DataService.setActiveDirectorateId(directorateId);
  };

  return (
    <AuthContext.Provider value={{ 
      currentUser: isDemo ? ({ uid: userProfile?.id, email: userProfile?.email } as any) : currentUser, 
      userProfile, 
      loading, 
      isDemo, 
      isProfileModalOpen,
      isDirectoratePromptOpen,
      setIsProfileModalOpen,
      setIsDirectoratePromptOpen,
      openProfileModal,
      closeProfileModal,
      loginAsDemo, 
      logout, 
      updateProfileState,
      assignUserDirectorate
    }}>
      {children}
    </AuthContext.Provider>
  );
};
