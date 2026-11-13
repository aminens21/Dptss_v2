import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, query, collection, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { User, Role, SUPER_ADMIN_EMAILS, Directorate } from '../types';
import { DataService } from '../lib/dataService';
import { isFlexibleEmailMatch } from '../lib/utils';

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

const DEMO_PROFILES: Partial<Record<Role, { name: string; email: string; sportId?: string; workLocation?: string; leaseNumber?: string; directorateId?: string; directorateName?: string }>> = {
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
  SUPER_ADMIN: {
    name: 'مدير إداري مركزي فائق الصلاحيات',
    email: 'super.admin@taourirt.ma',
    directorateId: 'taourirt',
    directorateName: 'المديرية الإقليمية بتاوريرت'
  },
  REGIONAL_ADMIN: {
    name: 'مدير إقليمي',
    email: 'regional.admin@taourirt.ma',
    directorateId: 'taourirt',
    directorateName: 'المديرية الإقليمية بتاوريرت'
  },
  PROVINCIAL_ADMIN: {
    name: 'مدير جهوي',
    email: 'provincial.admin@taourirt.ma',
    directorateId: 'taourirt',
    directorateName: 'المديرية الإقليمية بتاوريرت'
  },
  TECH_HEAD: {
    name: 'رئيس لجنة تقنية',
    email: 'tech.head@taourirt.ma',
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
            (d.adminEmails || []).some(ae => isFlexibleEmailMatch(ae, cleanUserEmail))
          );

          let matchedData: any = null;
          let docId = user.uid;

          if (!DataService.isCloudSyncPaused()) {
            try {
              const userDoc = await Promise.race([
                getDoc(doc(db, 'users', user.uid)),
                new Promise<null>((_, reject) => setTimeout(() => reject(new Error('AUTH_TIMEOUT')), 2500))
              ]);
              if (userDoc && userDoc.exists()) {
                matchedData = userDoc.data();
              } else {
                const snap = await Promise.race([
                  getDocs(collection(db, 'users')),
                  new Promise<null>((_, reject) => setTimeout(() => reject(new Error('AUTH_TIMEOUT')), 2500))
                ]);
                if (snap && !snap.empty) {
                  const foundDoc = snap.docs.find(d => {
                    const data = d.data();
                    return data.email && isFlexibleEmailMatch(data.email, cleanUserEmail);
                  });
                  if (foundDoc) {
                    matchedData = foundDoc.data();
                    docId = foundDoc.id;
                  }
                }
              }
            } catch (err) {
              console.warn("Auth cloud user lookup skipped/timed out, using local cache:", err);
            }
          }

          // Also check DataService users & teachers cache if not found directly
          if (!matchedData) {
            try {
              const allUsers = await DataService.getUsers();
              const foundUser = allUsers.find(u => u.email && isFlexibleEmailMatch(u.email, cleanUserEmail));
              if (foundUser) {
                matchedData = foundUser;
                docId = foundUser.id || user.uid;
              }
            } catch (err) {
              console.warn("Error querying DataService users by email:", err);
            }
          }

          if (!matchedData) {
            try {
              const allTeachers = await DataService.getTeachers();
              const foundTeacher = allTeachers.find(t => t.email && isFlexibleEmailMatch(t.email, cleanUserEmail));
              if (foundTeacher) {
                matchedData = foundTeacher;
                docId = foundTeacher.id || user.uid;
              }
            } catch (err) {
              console.warn("Error querying DataService teachers by email:", err);
            }
          }

          if (matchedData) {
            const data = matchedData as User;
            let role: Role = data.role || 'TEACHER';
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
            if (!DataService.isCloudSyncPaused() && (docId !== user.uid || (isSuperAdmin && data.role !== 'CENTRAL_ADMIN'))) {
              try {
                const cleanDoc: Record<string, any> = {};
                Object.entries(profile).forEach(([k, v]) => {
                  if (v !== undefined) cleanDoc[k] = v;
                });
                await Promise.race([
                  setDoc(doc(db, 'users', user.uid), {
                    ...cleanDoc,
                    updatedAt: serverTimestamp()
                  }, { merge: true }),
                  new Promise<void>((resolve) => setTimeout(resolve, 2500))
                ]);
              } catch (saveErr) {
                console.warn("Could not migrate pre-registered user to user.uid:", saveErr);
              }
            }

            setUserProfile(profile);

            // Automatically set the active directorate in localStorage for non-super admins to their assigned directorate
            if (!isSuperAdmin && profile.directorateId) {
              DataService.setActiveDirectorateId(profile.directorateId);
            }
          } else {
            // Check if there is a pre-registered manager account or school coordinator in Firestore
            const managerDocId = `mgr_${cleanUserEmail.replace(/[^a-z0-9]/g, '_')}`;
            let mgrFound = false;
            let detectedRole: Role = isSuperAdmin ? 'CENTRAL_ADMIN' : (managedDirectorate ? 'CENTRAL_ADMIN' : 'TEACHER');
            let detectedName = user.displayName || (isSuperAdmin ? 'المسير المركزي الرئيسي' : user.email?.split('@')[0] || 'مستخدم');
            let detectedSportId: string | undefined = undefined;
            let detectedTournamentId: string | undefined = undefined;
            let detectedWorkLocation: string | undefined = undefined;
            let detectedSchoolId: string | undefined = undefined;

            if (!DataService.isCloudSyncPaused()) {
              try {
                const mgrDoc = await Promise.race([
                  getDoc(doc(db, 'users', managerDocId)),
                  new Promise<null>((_, reject) => setTimeout(() => reject(new Error('AUTH_TIMEOUT')), 2500))
                ]);
                if (mgrDoc && mgrDoc.exists()) {
                  mgrFound = true;
                  const mgrData = mgrDoc.data();
                  detectedRole = 'SPORT_MANAGER';
                  if (mgrData.fullName) detectedName = mgrData.fullName;
                  if (mgrData.sportId) detectedSportId = mgrData.sportId;
                  if (mgrData.assignedTournamentId) detectedTournamentId = mgrData.assignedTournamentId;
                }
              } catch (mgrErr) {
                console.warn("Manager lookup warning:", mgrErr);
              }
            }

            let schoolCoordinatorFound = false;
            let matchedSchoolDirId: string | undefined = undefined;
            if (!isSuperAdmin && !managedDirectorate && !mgrFound) {
              try {
                const allSchools = await DataService.getSchools();
                const matchedSchool = allSchools.find(s =>
                  ((s as any).email && isFlexibleEmailMatch((s as any).email, cleanUserEmail)) ||
                  ((s as any).coordinatorEmail && isFlexibleEmailMatch((s as any).coordinatorEmail, cleanUserEmail))
                );
                if (matchedSchool) {
                  schoolCoordinatorFound = true;
                  detectedWorkLocation = matchedSchool.name;
                  detectedSchoolId = matchedSchool.id;
                  matchedSchoolDirId = matchedSchool.directorateId;
                }
              } catch (sErr) {
                console.warn("School coordinator lookup warning:", sErr);
              }
            }

            // CRITICAL: Only auto-create Firestore user profile if authorized (SuperAdmin, Directorate Admin, Pre-registered Manager, or School Coordinator)
            if (isSuperAdmin || !!managedDirectorate || mgrFound || schoolCoordinatorFound) {
              const initialDirectorateId = managedDirectorate?.id || matchedSchoolDirId || 'taourirt';
              const initialDirectorateName = managedDirectorate?.name || 'المديرية الإقليمية بتاوريرت';

              const newProfile: User = {
                id: user.uid,
                fullName: detectedName,
                email: cleanUserEmail,
                role: detectedRole,
                ...(detectedSportId ? { sportId: detectedSportId } : {}),
                ...(detectedTournamentId ? { assignedTournamentId: detectedTournamentId } : {}),
                ...(detectedWorkLocation ? { workLocation: detectedWorkLocation } : {}),
                ...(detectedSchoolId ? { schoolId: detectedSchoolId } : {}),
                directorateId: initialDirectorateId,
                directorateName: initialDirectorateName,
                isSuperAdmin,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
              };

              if (!DataService.isCloudSyncPaused()) {
                try {
                  const cleanDoc: Record<string, any> = {};
                  Object.entries(newProfile).forEach(([k, v]) => {
                    if (v !== undefined) cleanDoc[k] = v;
                  });
                  await Promise.race([
                    setDoc(doc(db, 'users', user.uid), {
                      ...cleanDoc,
                      createdAt: serverTimestamp(),
                      updatedAt: serverTimestamp()
                    }, { merge: true }),
                    new Promise<void>((resolve) => setTimeout(resolve, 2500))
                  ]);
                } catch (saveErr) {
                  console.warn("Could not save authorized user document to Firestore:", saveErr);
                }
              }

              setUserProfile(newProfile);

              if (!isSuperAdmin && newProfile.directorateId) {
                DataService.setActiveDirectorateId(newProfile.directorateId);
              }
            } else {
              // Unregistered email: do NOT create a Firestore user profile (Login.tsx will sign out and notify)
              setUserProfile(null);
            }
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          const isSuper = isSuperAdminEmail(cleanUserEmail);
          if (isSuper) {
            setUserProfile({
              id: user.uid,
              fullName: 'المسير المركزي الرئيسي',
              email: cleanUserEmail,
              role: 'CENTRAL_ADMIN',
              isSuperAdmin: true,
              directorateId: 'taourirt',
              directorateName: 'المديرية الإقليمية بتاوريرت',
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          } else {
            setUserProfile(null);
          }
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
    if (currentUser?.uid && !isDemo && !DataService.isCloudSyncPaused()) {
      try {
        await Promise.race([
          setDoc(doc(db, 'users', currentUser.uid), {
            ...updated,
            updatedAt: serverTimestamp()
          }, { merge: true }),
          new Promise<void>((resolve) => setTimeout(resolve, 2500))
        ]);
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
