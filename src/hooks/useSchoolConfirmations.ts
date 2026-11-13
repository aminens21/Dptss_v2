import { useState, useEffect, useCallback } from 'react';
import { SchoolTournamentConfirmation } from '../types';
import { DataService } from '../lib/dataService';
import { normalizeArabicName } from '../lib/utils';

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

  const matchesSchoolIdentifier = useCallback((c: SchoolTournamentConfirmation, schoolIdentifier: string): boolean => {
    const cleanId = schoolIdentifier.trim().toLowerCase();
    const normId = normalizeArabicName(schoolIdentifier);
    if ((c.schoolId || '').trim().toLowerCase() === cleanId) return true;
    if ((c.schoolName || '').trim().toLowerCase() === cleanId) return true;
    if (normId && c.schoolName && normalizeArabicName(c.schoolName) === normId) return true;
    return false;
  }, []);

  const isSchoolConfirmed = useCallback((sportId: string, schoolIdentifier?: string): boolean => {
    if (!sportId || !schoolIdentifier) return false;
    return confirmations.some(c =>
      c.sportId === sportId &&
      c.status === 'confirmed' &&
      matchesSchoolIdentifier(c, schoolIdentifier)
    );
  }, [confirmations, matchesSchoolIdentifier]);

  const getConfirmation = useCallback((sportId: string, schoolIdentifier?: string): SchoolTournamentConfirmation | undefined => {
    if (!sportId || !schoolIdentifier) return undefined;
    return confirmations.find(c =>
      c.sportId === sportId &&
      c.status === 'confirmed' &&
      matchesSchoolIdentifier(c, schoolIdentifier)
    );
  }, [confirmations, matchesSchoolIdentifier]);

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
