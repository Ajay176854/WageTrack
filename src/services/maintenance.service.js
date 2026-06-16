import { supabase } from '../config/supabase'

export const maintenanceService = {
  async getAll(filters = {}) {
    let query = supabase.from('maintenance').select('*')

    if (filters.workerId) query = query.eq('worker_id', filters.workerId)
    if (filters.date) query = query.eq('date', filters.date)
    if (filters.dateFrom) query = query.gte('date', filters.dateFrom)
    if (filters.dateTo) query = query.lte('date', filters.dateTo)

    query = query.order('date', { ascending: false })

    const { data, error } = await query
    if (error) throw error
    return data || []
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('maintenance')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw error
    return data
  },

  async create(record) {
    if (!record.id) {
      record.id = crypto.randomUUID()
    }
    const { data, error } = await supabase
      .from('maintenance')
      .insert(record)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('maintenance')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async delete(id) {
    const { error } = await supabase.from('maintenance').delete().eq('id', id)
    if (error) throw error
  },

  subscribe(callback) {
    return supabase
      .channel('maintenance-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance' }, callback)
      .subscribe()
  },
}
