import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import {
  createStaff,
  deleteStaff,
  listStaff,
  setStaffActive,
  updateStaff,
  type CreateStaffPayload,
  type StaffMember,
  type UpdateStaffPayload,
} from '../services/staff';

type StaffManagementValue = {
  staff: StaffMember[];
  isLoading: boolean;
  error: string | null;
  addStaff: (payload: CreateStaffPayload) => Promise<StaffMember>;
  editStaff: (id: string, payload: UpdateStaffPayload) => Promise<StaffMember>;
  removeStaff: (id: string) => Promise<void>;
  toggleStaffActive: (id: string, is_active: boolean) => Promise<StaffMember>;
};

const StaffManagementContext = createContext<StaffManagementValue | undefined>(undefined);

export function StaffManagementProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    listStaff()
      .then((data) => {
        if (!cancelled) setStaff(data);
      })
      .catch(() => {
        if (!cancelled) setError('Impossibile caricare l\'elenco dello staff.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const addStaff = async (payload: CreateStaffPayload): Promise<StaffMember> => {
    const created = await createStaff(payload);
    setStaff((prev) => [...prev, created]);
    return created;
  };

  const editStaff = async (id: string, payload: UpdateStaffPayload): Promise<StaffMember> => {
    const updated = await updateStaff(id, payload);
    setStaff((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    return updated;
  };

  const removeStaff = async (id: string): Promise<void> => {
    await deleteStaff(id);
    setStaff((prev) => prev.filter((s) => s.id !== id));
  };

  const toggleStaffActive = async (id: string, is_active: boolean): Promise<StaffMember> => {
    const updated = await setStaffActive(id, is_active);
    setStaff((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    return updated;
  };

  const value: StaffManagementValue = {
    staff,
    isLoading,
    error,
    addStaff,
    editStaff,
    removeStaff,
    toggleStaffActive,
  };

  return <StaffManagementContext.Provider value={value}>{children}</StaffManagementContext.Provider>;
}

export function useStaffManagement(): StaffManagementValue {
  const context = useContext(StaffManagementContext);
  if (!context) {
    throw new Error(
      'useStaffManagement deve essere usato all\'interno di un StaffManagementProvider.'
    );
  }
  return context;
}
