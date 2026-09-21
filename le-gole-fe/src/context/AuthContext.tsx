import React, { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import api, { setSessionExpiredHandler } from '../services/api';
import { registraDispositivoPush, rimuoviDispositivoPush } from '../utils/push';
import { clearTokens, getAccessToken, saveTokens } from '../utils/storage';

export type StaffUser = {
  id: string;
  username: string;
  email: string;
  is_superuser: boolean;
  is_active: boolean;
};

type AuthContextValue = {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: StaffUser | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function fetchStaffProfile(): Promise<StaffUser> {
  return api.get<StaffUser>('/v1/users/staff/me/').then((response) => response.data);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setSessionExpiredHandler(() => setUser(null));

    (async () => {
      const token = await getAccessToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        setUser(await fetchStaffProfile());
        // Anche al ripristino della sessione, non solo al login: uno staff che non si disconnette
        // mai altrimenti non registrerebbe il dispositivo dopo un aggiornamento dell'app.
        void registraDispositivoPush();
      } catch {
        await clearTokens();
      } finally {
        setIsLoading(false);
      }
    })();

    return () => setSessionExpiredHandler(null);
  }, []);

  const login = async (username: string, password: string) => {
    const response = await api.post<{ access: string; refresh: string }>('/v1/users/login/', {
      username,
      password,
    });
    const { access, refresh } = response.data;
    await saveTokens(access, refresh);

    setUser(await fetchStaffProfile());
    // `void`: una registrazione lenta o fallita non deve tenere il login in sospeso.
    void registraDispositivoPush();
  };

  const logout = async () => {
    // Prima di scartare i token JWT: senza autenticazione il backend rifiuterebbe la richiesta e
    // il dispositivo continuerebbe a ricevere notifiche di un account non più connesso.
    await rimuoviDispositivoPush();
    await clearTokens();
    setUser(null);
  };

  const value = useMemo<AuthContextValue>(
    () => ({ isAuthenticated: user !== null, isLoading, user, login, logout }),
    [user, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve essere usato all\'interno di un AuthProvider.');
  }
  return context;
}
