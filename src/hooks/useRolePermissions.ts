import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { RoleKey, RoleSidebarPermissions } from '../types';
import { DataService } from '../lib/dataService';

export const useRolePermissions = () => {
  const { userProfile } = useAuth();
  const [permissions, setPermissions] = useState<RoleSidebarPermissions | null>(null);

  useEffect(() => {
    // 1. Initial load from local storage if available
    try {
      const local = localStorage.getItem('taourirt_role_sidebar_permissions');
      if (local) {
        setPermissions(JSON.parse(local));
      }
    } catch (e) {
      console.warn("Failed to parse local permissions in hook:", e);
    }

    // 2. Fetch fresh permissions
    DataService.getRoleSidebarPermissions().then(perms => {
      if (perms) {
        setPermissions(perms);
      }
    }).catch(err => {
      console.warn("Failed to fetch fresh permissions in hook:", err);
    });

    // 3. Subscribe to real-time updates & window events
    const unsub = DataService.subscribeToRoleSidebarPermissions((perms) => {
      if (perms) {
        setPermissions(perms);
      }
    });

    const handleChanged = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setPermissions(customEvent.detail);
      }
    };

    window.addEventListener('sidebarPermissionsChanged', handleChanged);
    return () => {
      unsub();
      window.removeEventListener('sidebarPermissionsChanged', handleChanged);
    };
  }, []);

  const resolveEffectiveRoleKey = (): RoleKey | null => {
    if (!userProfile?.role && !userProfile?.isTechCommitteeHead && !userProfile?.isSuperAdmin) return null;
    if (
      userProfile?.role === 'CENTRAL_ADMIN' ||
      userProfile?.role === 'SUPER_ADMIN' ||
      userProfile?.isSuperAdmin === true
    ) {
      return 'CENTRAL_ADMIN';
    }
    if (
      userProfile?.isTechCommitteeHead === true ||
      userProfile?.role === 'TECH_HEAD' ||
      (userProfile?.role as string) === 'TECH_COMMITTEE_HEAD'
    ) {
      return 'TECH_COMMITTEE_HEAD';
    }
    return (userProfile?.role as RoleKey) || 'TEACHER';
  };

  const canDo = (actionKey: string): boolean => {
    const userRole = resolveEffectiveRoleKey();
    if (!userRole) return false;

    // Super Admin / Central Admin has absolute bypass for everything
    if (userRole === 'CENTRAL_ADMIN') return true;

    const allowed = permissions?.[userRole];

    // Fallback defaults if permissions aren't loaded yet or role key is not configured
    if (!permissions || !Array.isArray(allowed)) {
      const DEFAULT_ACTIONS: Record<RoleKey, string[]> = {
        CENTRAL_ADMIN: [
          'action:export_data', 'action:import_data', 'action:edit_results', 'action:register_students', 'action:manage_schedule', 'action:delete_records'
        ],
        TECH_COMMITTEE_HEAD: [
          'action:export_data', 'action:edit_results', 'action:register_students', 'action:manage_schedule'
        ],
        SPORT_MANAGER: [
          'action:export_data', 'action:edit_results', 'action:register_students', 'action:manage_schedule'
        ],
        TEACHER: [
          'action:export_data', 'action:register_students'
        ],
        REFEREE: [
          'action:edit_results'
        ]
      };
      return DEFAULT_ACTIONS[userRole]?.includes(actionKey) || false;
    }

    return allowed.includes(actionKey);
  };

  const canAccessRoute = (href: string): boolean => {
    const userRole = resolveEffectiveRoleKey();
    if (!userRole) return false;
    if (userRole === 'CENTRAL_ADMIN') return true;
    const allowed = permissions?.[userRole];
    if (!permissions || !Array.isArray(allowed)) {
      const DEFAULT_ROUTES: Record<RoleKey, string[]> = {
        CENTRAL_ADMIN: ['/dashboard', '/schools', '/tournaments', '/teachers', '/tech-committee', '/referees', '/matches', '/helper-apps', '/posters-certificates', '/statistics', '/sports-config', '/permissions'],
        TECH_COMMITTEE_HEAD: ['/dashboard', '/schools', '/tournaments', '/teachers', '/tech-committee', '/referees', '/matches', '/helper-apps', '/posters-certificates', '/statistics', '/sports-config'],
        SPORT_MANAGER: ['/dashboard', '/schools', '/tournaments', '/teachers', '/referees', '/matches', '/helper-apps', '/posters-certificates', '/statistics'],
        TEACHER: ['/dashboard', '/schools', '/tournaments', '/matches', '/posters-certificates', '/statistics'],
        REFEREE: ['/dashboard', '/matches', '/statistics']
      };
      return DEFAULT_ROUTES[userRole]?.includes(href) || false;
    }
    return allowed.includes(href);
  };

  return { permissions, canDo, canAccessRoute };
};
