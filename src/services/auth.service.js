import { supabase } from '../config/supabase'

export const authService = {
  /**
   * Sign up a new user with Supabase Auth + create a profile row
   */
  async signUp({ email, password, username, role = 'supervisor', access = {} }) {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    })
    if (authError) throw authError

    // Create the user profile in our custom users table
    const { error: profileError } = await supabase.from('users').insert({
      auth_id: authData.user?.id,
      username,
      email,
      role,
      access,
    })
    if (profileError) throw profileError

    return authData
  },

  /**
   * Sign in with email + password
   */
  async signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
    return data
  },

  /**
   * Sign out the current user
   */
  async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },

  /**
   * Get the current session
   */
  async getSession() {
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    return data.session
  },

  /**
   * Get the user profile from our custom users table
   */
  async getProfile(authId) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', authId)
      .single()
    if (error) throw error
    return data
  },

  /**
   * Listen for auth state changes
   */
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback)
  },
}
