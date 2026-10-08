'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { AuthResponse, AuthTokenResponsePassword, Session, User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { assertSignupEmail } from '@/lib/emailCheck';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    metadata?: { fullName?: string; avatarUrl?: string }
  ) => Promise<AuthResponse['data']>;
  signIn: (email: string, password: string) => Promise<AuthTokenResponsePassword['data']>;
  signInWithProvider: (provider: 'google' | 'apple', next?: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  getCurrentUser: () => Promise<User | null>;
  isEmailVerified: () => boolean;
  getUserProfile: () => Promise<Record<string, unknown> | null>;
}

// Empty default (as before): consumers are always rendered inside AuthProvider.
const AuthContext = createContext<AuthContextValue>({} as AuthContextValue);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // Stable client instance for the provider's lifetime.
  const [supabase] = useState(() => createClient());

  useEffect(() => {
    // Get initial session
    // If reading the session fails, treat the user as signed out instead of
    // leaving the app stuck on "Cargando..." forever.
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
      })
      .catch((err) => {
        console.error('getSession error:', err);
        setSession(null);
        setUser(null);
      })
      .finally(() => setLoading(false));

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // Email/Password Sign Up
  const signUp = async (
    email: string,
    password: string,
    metadata: { fullName?: string; avatarUrl?: string } = {}
  ) => {
    await assertSignupEmail(email);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: metadata?.fullName || '',
          avatar_url: metadata?.avatarUrl || '',
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
    return data;
  };

  // Email/Password Sign In
  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  };

  // OAuth (Google / Apple). Redirects away; the session is created in /auth/callback.
  // `next`: same-site path to return to after signing in (e.g. the onboarding step).
  const signInWithProvider = async (provider: 'google' | 'apple', next?: string) => {
    const back = next && /^\/(?!\/)/.test(next) ? `?next=${encodeURIComponent(next)}` : '';
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback${back}` },
    });
    if (error) throw error;
  };

  // Sends the password-recovery email; its link opens /restablecer with a session.
  const sendPasswordReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/restablecer`,
    });
    if (error) throw error;
  };

  // Sets a new password for the signed-in user (recovery session included).
  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  };

  // Sign Out
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  // Get Current User
  const getCurrentUser = async () => {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  };

  // Check if Email is Verified
  const isEmailVerified = () => {
    return user?.email_confirmed_at !== null;
  };

  // Get User Profile from Database
  const getUserProfile = async () => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (error) throw error;
    return data;
  };

  const value: AuthContextValue = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signInWithProvider,
    sendPasswordReset,
    updatePassword,
    signOut,
    getCurrentUser,
    isEmailVerified,
    getUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
