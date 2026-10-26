import React, { createContext, useContext, useEffect, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { UserProfile, UserRole } from '../types/database'

export interface SignUpResult {
  error: Error | null
  pendingApproval?: boolean
  message?: string
}

interface AuthContextValue {
  user: User | null
  profile: UserProfile | null
  session: Session | null
  loading: boolean
  isDemoMode: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, fullName: string, role: UserRole) => Promise<SignUpResult>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isDemoMode] = useState(!isSupabaseConfigured)

  // Fetch live user profile from user_profiles table
  const fetchProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        console.warn('Profile fetch notice:', error.message)
        return null
      }
      return data as UserProfile
    } catch (err) {
      console.warn('Failed to fetch profile:', err)
      return null
    }
  }

  const refreshProfile = async () => {
    if (user && isSupabaseConfigured) {
      const p = await fetchProfile(user.id)
      if (p) setProfile(p)
    }
  }

  useEffect(() => {
    let isMounted = true

    // Clean up any old demo user lingering in localStorage
    try {
      localStorage.removeItem('raptee_demo_user')
    } catch {}

    const timer = setTimeout(() => {
      if (isMounted) setLoading(false)
    }, 2000)

    const initAuth = async () => {
      if (!isSupabaseConfigured) {
        if (isMounted) setLoading(false)
        return
      }

      try {
        const { data: { session: s }, error } = await supabase.auth.getSession()
        if (error) throw error

        if (isMounted && s?.user) {
          const p = await fetchProfile(s.user.id)
          // Security gate: If user is not active / unapproved, sign out immediately
          if (p && !p.is_active) {
            await supabase.auth.signOut()
            setUser(null)
            setProfile(null)
            setSession(null)
          } else {
            setSession(s)
            setUser(s.user)
            setProfile(p)
          }
        }
      } catch (err) {
        console.warn('Supabase getSession notice:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    initAuth()

    let subscription: { unsubscribe: () => void } | null = null
    if (isSupabaseConfigured) {
      try {
        const { data } = supabase.auth.onAuthStateChange(async (_event, s) => {
          if (!isMounted) return
          if (s?.user) {
            const p = await fetchProfile(s.user.id)
            if (p && !p.is_active) {
              await supabase.auth.signOut()
              setUser(null)
              setProfile(null)
              setSession(null)
            } else {
              setSession(s)
              setUser(s.user)
              setProfile(p)
            }
          } else {
            setUser(null)
            setProfile(null)
            setSession(null)
          }
          setLoading(false)
        })
        subscription = data.subscription
      } catch (err) {
        console.warn('Auth state change listener notice:', err)
      }
    }

    return () => {
      isMounted = false
      clearTimeout(timer)
      subscription?.unsubscribe()
    }
  }, [])

  // Strict live Supabase sign in
  const signIn = async (email: string, password: string) => {
    const lower = email.trim().toLowerCase()

    if (!isSupabaseConfigured) {
      return { error: new Error('Database is not configured. Please check VITE_SUPABASE_URL.') }
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: lower,
        password,
      })

      if (error) {
        // Friendly message for email-not-confirmed case
        if (
          error.message?.toLowerCase().includes('email not confirmed') ||
          error.message?.toLowerCase().includes('not confirmed')
        ) {
          return {
            error: new Error(
              'EMAIL_NOT_CONFIRMED'
            ),
          }
        }
        return { error }
      }

      if (!data.user) {
        return { error: new Error('User account not found.') }
      }

      // Check profile in user_profiles
      let p = await fetchProfile(data.user.id)

      if (!p) {
        // If profile row doesn't exist yet, insert it
        const isAdmin = lower === 'admin@raptee.com' || data.user.user_metadata?.role === 'admin'
        p = {
          id: data.user.id,
          email: lower,
          full_name: data.user.user_metadata?.full_name || lower.split('@')[0],
          role: (data.user.user_metadata?.role as UserRole) || (isAdmin ? 'admin' : 'cce'),
          is_active: isAdmin, // Only default admin is auto-active; others require admin approval!
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        try {
          await supabase.from('user_profiles').upsert(p)
        } catch (insertErr) {
          console.warn('Profile sync notice:', insertErr)
        }
      }

      // MANDATORY APPROVAL CHECK:
      // If the administrator has not approved this account yet, block login
      if (!p.is_active) {
        await supabase.auth.signOut()
        setUser(null)
        setProfile(null)
        setSession(null)
        return {
          error: new Error(
            'Account Pending Approval: Your account has been registered, but requires Administrator approval before you can access the platform. Please contact your system administrator (admin@raptee.com) to approve your access.'
          ),
        }
      }

      setProfile(p)
      setUser(data.user)
      setSession(data.session)
      return { error: null }
    } catch (err: any) {
      return { error: err as Error }
    }
  }

  // Sign up with Admin Approval requirement
  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    role: UserRole
  ): Promise<SignUpResult> => {
    const lower = email.trim().toLowerCase()

    if (!isSupabaseConfigured) {
      return { error: new Error('Database is not configured. Please check VITE_SUPABASE_URL.') }
    }

    try {
      const isAdmin = lower === 'admin@raptee.com' || role === 'admin'

      const { data, error } = await supabase.auth.signUp({
        email: lower,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            role,
          },
        },
      })

      if (error) {
        return { error }
      }

      if (data.user) {
        const profileRow: UserProfile = {
          id: data.user.id,
          email: lower,
          full_name: fullName.trim(),
          role,
          is_active: isAdmin, // Only admin is auto-approved; all other employees require admin approval
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        // Upsert into user_profiles table
        const { error: profileError } = await supabase
          .from('user_profiles')
          .upsert(profileRow)

        if (profileError) {
          console.warn('user_profiles upsert warning:', profileError.message)
        }

        // If not an admin, enforce approval workflow: sign out immediately
        if (!isAdmin) {
          await supabase.auth.signOut()
          setUser(null)
          setProfile(null)
          setSession(null)
          return {
            error: null,
            pendingApproval: true,
            message:
              'Account registered successfully! An Administrator must approve your account before you can sign in. Please contact your administrator to activate your profile.',
          }
        }

        setProfile(profileRow)
        setUser(data.user)
        setSession(data.session)
      }

      return { error: null, pendingApproval: false }
    } catch (err: any) {
      return { error: err as Error }
    }
  }

  const signOut = async () => {
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut()
      } catch {}
    }
    setUser(null)
    setProfile(null)
    setSession(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        isDemoMode,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
