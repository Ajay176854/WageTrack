import { supabase } from '../config/supabase'

export const usersService = {
  async getAll() {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('username', { ascending: true })
    if (error) throw error
    return data || []
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw error
    return data
  },

  async getByAuthId(authId) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', authId)
      .single()
    if (error) throw error
    return data
  },

  async create(userData) {
    const { data, error } = await supabase
      .from('users')
      .insert(userData)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async delete(id) {
    const { error } = await supabase.from('users').delete().eq('id', id)
    if (error) throw error
  },
}
