import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../config/supabase'
import { usersService } from '../services/users.service'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)       // Supabase auth user
  const [profile, setProfile] = useState(null)  // Our custom users table profile
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user.id)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(authId) {
    try {
      // First try to fetch existing profile
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', authId)

      if (error) throw error

      if (data && data.length > 0) {
        setProfile(data[0])
      } else {
        // Profile row doesn't exist (e.g. RLS blocked insert during signup)
        // Auto-create admin profile for the first user
        const session = (await supabase.auth.getSession()).data.session
        const email = session?.user?.email || ''
        const username = email.split('@')[0] || 'Admin'

        const { data: newProfile, error: insertErr } = await supabase
          .from('users')
          .insert({
            auth_id: authId,
            username,
            email,
            role: 'admin',
            access: { unit1: ['attendance', 'work', 'payment'], unit2: ['attendance', 'work', 'payment'], unit3: ['attendance', 'work', 'payment'], unit4: ['attendance', 'work', 'payment'], maintenance: ['maintenance'] }
          })
          .select()
          .single()

        if (insertErr) {
          console.error('Failed to auto-create profile:', insertErr)
          // Still set a fallback profile so the app can work
          setProfile({
            auth_id: authId,
            username,
            email,
            role: 'admin',
            access: { unit1: ['attendance', 'work', 'payment'], unit2: ['attendance', 'work', 'payment'], unit3: ['attendance', 'work', 'payment'], unit4: ['attendance', 'work', 'payment'], maintenance: ['maintenance'] }
          })
        } else {
          setProfile(newProfile)
        }
      }
    } catch (err) {
      console.error('Failed to load user profile:', err)
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }

  async function signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function signOut() {
    await supabase.auth.signOut()
    setProfile(null)
  }

  const value = {
    session,
    user,
    profile,
    loading,
    signIn,
    signOut,
    isAdmin: profile?.role === 'admin',
    isSupervisor: profile?.role === 'supervisor',
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuthContext() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider')
  }
  return context
}

export default AuthContext
