import { supabase } from '../config/supabase'

export const workersService = {
  /**
   * Fetch all active workers, optionally filtered by unit
   */
  async getAll(filters = {}) {
    let query = supabase.from('workers').select('*')

    if (filters.unit) {
      query = query.eq('unit', filters.unit)
    }
    if (filters.category) {
      query = query.eq('category', filters.category)
    }

    query = query.order('name', { ascending: true })

    const { data, error } = await query
    if (error) throw error
    return data || []
  },

  /**
   * Fetch a single worker by ID
   */
  async getById(id) {
    const { data, error } = await supabase
      .from('workers')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw error
    return data
  },

  /**
   * Create a new worker
   */
  async create(workerData) {
    if (!workerData.id) {
      workerData.id = crypto.randomUUID()
    }
    const { data, error } = await supabase
      .from('workers')
      .insert(workerData)
      .select()
      .single()
    if (error) throw error
    return data
  },

  /**
   * Update an existing worker
   */
  async update(id, updates) {
    const { data, error } = await supabase
      .from('workers')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  /**
   * Soft delete — uses hard delete since is_active column is not in the schema
   */
  async softDelete(id) {
    const { error } = await supabase
      .from('workers')
      .delete()
      .eq('id', id)
    if (error) throw error
  },

  /**
   * Hard delete (use with caution — cascades to entries/attendance)
   */
  async hardDelete(id) {
    const { error } = await supabase
      .from('workers')
      .delete()
      .eq('id', id)
    if (error) throw error
  },

  /**
   * Check if an emp_id already exists
   */
  async empIdExists(empId, excludeId = null) {
    let query = supabase
      .from('workers')
      .select('id')
      .eq('emp_id', empId)

    if (excludeId) {
      query = query.neq('id', excludeId)
    }

    const { data, error } = await query
    if (error) throw error
    return data && data.length > 0
  },

  /**
   * Subscribe to real-time changes on workers table
   */
  subscribe(callback) {
    return supabase
      .channel('workers-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workers' }, callback)
      .subscribe()
  },
}
