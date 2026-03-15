import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../db/supabase';
import { UserRole } from './permissions';
import { fetchWithRetry } from '../utils/api';

interface Profile {
  id: string;
  name: string;
  role: UserRole;
  avatar_url?: string;
  email?: string;
  phone_number?: string;
  google_access_token?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any | null>(null);

  const fetchProfile = async (userId: string) => {
    if (!userId) return;

    try {
      const url = `/api/users/${encodeURIComponent(userId)}`;
      console.log(`[AUTH] Fetching profile for user: ${userId}`);
      
      const res = await fetchWithRetry(url, {
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        },
        retries: 5
      });
      
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      } else {
        setProfile(null);
      }
    } catch (err: any) {
      console.error('[AUTH] Profile fetch failed:', err.message || err);
      setProfile(null);
    }
  };

  useEffect(() => {
    // Health check to verify API connectivity
    const checkHealth = async () => {
      try {
        const res = await fetchWithRetry(`/api/health?t=${Date.now()}`, {
          headers: { 'Accept': 'application/json' },
          cache: 'no-cache',
          retries: 10,
          retryDelay: 3000
        });
        const data = await res.json();
        console.log('[AUTH] API Health Check Success:', data);
      } catch (err: any) {
        console.error('[AUTH] API Health Check Failed:', err.message || err);
      }
    };

    checkHealth();

    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        syncUserToBackend(currentUser);
      }
      setLoading(false);
    });

    // Listen for changes on auth state (logged in, signed out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        syncUserToBackend(currentUser);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const syncUserToBackend = async (user: User) => {
    if (!user) return;

    try {
      // First try to fetch the profile
      const url = `/api/users/${encodeURIComponent(user.id)}`;
      console.log(`[AUTH] Syncing user to backend: ${user.id}`);
      
      const res = await fetchWithRetry(url, {
        headers: { 'Accept': 'application/json' },
        retries: 5
      });

      if (res.status === 404) {
        // User doesn't exist in backend, create them
        console.log('[AUTH] User not found in backend, creating profile...');
        const createRes = await fetchWithRetry(`/api/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': user.id
          },
          body: JSON.stringify({
            id: user.id,
            name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'New User',
            email: user.email,
            role: 'Staff', // Default role
            avatar_url: user.user_metadata?.avatar_url
          }),
          retries: 5
        });

        if (createRes.ok) {
          console.log('[AUTH] Backend profile created successfully');
          fetchProfile(user.id);
        } else {
          const errorData = await createRes.json().catch(() => ({ error: 'Unknown error' }));
          console.error('[AUTH] Failed to create backend profile:', createRes.status, errorData);
        }
      } else if (res.ok) {
        // User exists, just fetch the profile
        fetchProfile(user.id);
      }
    } catch (err) {
      console.error('[AUTH] Error syncing user to backend:', err);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      console.log('[AUTH] Refreshing profile for user:', user.id);
      await fetchProfile(user.id);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, profile, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
