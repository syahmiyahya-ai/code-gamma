import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { UserRole } from '../utils/permissions';

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
    if (!userId) {
      console.warn('fetchProfile called without userId');
      return;
    }

    try {
      console.log(`[AUTH] Fetching profile for user: ${userId}`);
      const res = await fetch(`/api/users/${userId}`, {
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        console.log('[AUTH] Profile fetched successfully:', data);
        setProfile(data);
      } else {
        const errorText = await res.text().catch(() => 'No error body');
        console.warn(`[AUTH] Profile fetch failed with status: ${res.status}. Body: ${errorText}`);
        // If 404, it might be a new user who hasn't completed setup
        if (res.status === 404) {
          console.log('[AUTH] User profile not found in database (404)');
        }
        setProfile(null);
      }
    } catch (err) {
      console.error('[AUTH] Error fetching profile (Failed to fetch):', err);
      if (err instanceof Error) {
        console.error('[AUTH] Error message:', err.message);
        console.error('[AUTH] Error stack:', err.stack);
      }
      // Check if it's a network error
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        console.error('[AUTH] This is a network error. Check if the server is running and accessible.');
      }
      setProfile(null);
    }
  };

  useEffect(() => {
    // Health check to verify API connectivity
    fetch('/api/health')
      .then(res => res.json())
      .then(data => console.log('API Health Check:', data))
      .catch(err => console.error('API Health Check Failed:', err));

    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    // Listen for changes on auth state (logged in, signed out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const refreshProfile = async () => {
    if (user) {
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
