import { useState, useEffect, useCallback } from 'react';
import { SchoolTournamentConfirmation } from '../types';
import { DataService } from '../lib/dataService';

export function useSchoolConfirmations(targetDirectorateId?: string) {
  const [confirmations, setConfirmations] = useState<SchoolTournamentConfirmation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    DataService.getSchoolConfirmations(targetDirectorateId).then(list => {
      if (isMounted) {
        setConfirmations(list);
        setLoading(false);
      }
    });

    const unsubscribe = DataService.subscribeToSchoolConfirmations((list) => {
      if (isMounted) {
        setConfirmations(list);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [targetDirectorateId]);

  const isSchoolConfirmed = useCallback((sportId: string, schoolIdentifier?: string): boolean => {
    if (!sportId || !schoolIdentifier) return false;
    const cleanId = schoolIdentifier.trim().toLowerCase();
    return confirmations.some(c => 
      c.sportId === sportId &&
      c.status === 'confirmed' &&
      (c.schoolId.toLowerCase() === cleanId || c.schoolName.toLowerCase() === cleanId)
    );
  }, [confirmations]);

  const getConfirmation = useCallback((sportId: string, schoolIdentifier?: string): SchoolTournamentConfirmation | undefined => {
    if (!sportId || !schoolIdentifier) return undefined;
    const cleanId = schoolIdentifier.trim().toLowerCase();
    return confirmations.find(c => 
      c.sportId === sportId &&
      c.status === 'confirmed' &&
      (c.schoolId.toLowerCase() === cleanId || c.schoolName.toLowerCase() === cleanId)
    );
  }, [confirmations]);

  const getConfirmedSchoolsForSport = useCallback((sportId: string): SchoolTournamentConfirmation[] => {
    if (!sportId) return [];
    return confirmations.filter(c => c.sportId === sportId && c.status === 'confirmed');
  }, [confirmations]);

  const refreshConfirmations = useCallback(async () => {
    const list = await DataService.getSchoolConfirmations(targetDirectorateId);
    setConfirmations(list);
  }, [targetDirectorateId]);

  return {
    confirmations,
    loading,
    isSchoolConfirmed,
    getConfirmation,
    getConfirmedSchoolsForSport,
    refreshConfirmations
  };
}
