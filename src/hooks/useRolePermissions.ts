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

    // 3. Listen to sidebarPermissionsChanged events
    const handleChanged = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setPermissions(customEvent.detail);
      }
    };

    window.addEventListener('sidebarPermissionsChanged', handleChanged);
    return () => {
      window.removeEventListener('sidebarPermissionsChanged', handleChanged);
    };
  }, []);

  const canDo = (actionKey: string): boolean => {
    // If no user, no permissions allowed
    if (!userProfile?.role) return false;

    // Super Admin / Central Admin has absolute bypass for everything
    if (userProfile.role === 'CENTRAL_ADMIN') return true;

    const userRole = userProfile.role as RoleKey;
    const allowed = permissions?.[userRole] || [];

    // Fallback defaults if the array is empty or permissions aren't loaded yet
    if (!permissions || !permissions[userRole] || permissions[userRole].length === 0) {
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

  return { permissions, canDo };
};
