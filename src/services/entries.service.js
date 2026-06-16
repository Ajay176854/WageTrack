import { supabase } from '../config/supabase'

const UNITS = ['unit1', 'unit2', 'unit3', 'unit4']

function getTableName(unit) {
  if (!unit || !UNITS.includes(unit)) {
    throw new Error(`Invalid unit provided to entriesService: ${unit}`)
  }
  return `${unit}_work_log`
}

export const entriesService = {
  /**
   * Fetch entries with optional filters (unit, date range, worker)
   * If unit is not provided, fetches from all 4 unit_work_log tables.
   */
  async getAll(filters = {}) {
    const unitsToQuery = filters.unit ? [filters.unit] : UNITS

    const fetchForUnit = async (unit) => {
      let query = supabase.from(getTableName(unit)).select('*, unit: \'' + unit + '\'')

      if (filters.workerId) query = query.eq('worker_id', filters.workerId)
      if (filters.date) query = query.eq('date', filters.date)
      if (filters.dateFrom) query = query.gte('date', filters.dateFrom)
      if (filters.dateTo) query = query.lte('date', filters.dateTo)
      if (filters.category) query = query.eq('category', filters.category)

      const { data, error } = await query
      if (error) throw error
      // Inject the unit into each row since the table doesn't have it natively anymore
      return (data || []).map(row => ({ ...row, unit, rate: row.piece_rate }))
    }

    const results = await Promise.all(unitsToQuery.map(fetchForUnit))
    const allData = results.flat()
    
    // Sort descending by date
    return allData.sort((a, b) => new Date(b.date) - new Date(a.date))
  },

  /**
   * Get entries for a specific date (today view)
   */
  async getByDate(date, unit = null) {
    return this.getAll({ date, unit })
  },

  /**
   * Fetch a single entry
   * Requires the unit to know which table to query.
   */
  async getById(id, unit) {
    const { data, error } = await supabase
      .from(getTableName(unit))
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw error
    if (data) {
      data.unit = unit
      data.rate = data.piece_rate
    }
    return data
  },

  /**
   * Create a new entry (upsert)
   * Note: The new schema lacks a UNIQUE constraint across worker_id/date,
   * so we must insert manually or ensure the client handles checking.
   * Actually, the schema doesn't have UNIQUE(worker_id, date) on work_log.
   * So we just do a regular insert or update if ID exists.
   */
  async upsert(entryData) {
    if (!entryData.unit) throw new Error('Unit is required for upsert')
    
    const table = getTableName(entryData.unit)
    const payload = { ...entryData, piece_rate: entryData.rate }
    delete payload.unit
    delete payload.rate

    if (!payload.id) {
      payload.id = crypto.randomUUID()
    }

    const { data, error } = await supabase
      .from(table)
      .upsert(payload, { onConflict: 'id' }) // Only works if we pass ID
      .select()
      .single()
      
    if (error) throw error
    return { ...data, unit: entryData.unit, rate: data.piece_rate }
  },

  /**
   * Create a new entry
   */
  async create(entryData) {
    if (!entryData.unit) throw new Error('Unit is required to create an entry')
    
    const table = getTableName(entryData.unit)
    const payload = { ...entryData, piece_rate: entryData.rate }
    delete payload.unit
    delete payload.rate

    if (!payload.id) {
      payload.id = crypto.randomUUID()
    }

    const { data, error } = await supabase
      .from(table)
      .insert(payload)
      .select()
      .single()
    if (error) throw error
    return { ...data, unit: entryData.unit, rate: data.piece_rate }
  },

  /**
   * Update an existing entry
   */
  async update(id, updates, unit) {
    if (!unit && updates.unit) unit = updates.unit
    if (!unit) throw new Error('Unit is required to update an entry')

    const table = getTableName(unit)
    const payload = { ...updates }
    if (payload.rate !== undefined) {
      payload.piece_rate = payload.rate
      delete payload.rate
    }
    delete payload.unit

    const { data, error } = await supabase
      .from(table)
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return { ...data, unit, rate: data.piece_rate }
  },

  /**
   * Delete an entry
   */
  async delete(id, unit) {
    if (!unit) throw new Error('Unit is required to delete an entry')
    const { error } = await supabase.from(getTableName(unit)).delete().eq('id', id)
    if (error) throw error
  },

  /**
   * Bulk insert entries (for quick-assign)
   */
  async bulkUpsert(entriesArray) {
    if (entriesArray.length === 0) return []
    
    // Group by unit since we have to insert into different tables
    const grouped = entriesArray.reduce((acc, entry) => {
      if (!acc[entry.unit]) acc[entry.unit] = []
      acc[entry.unit].push(entry)
      return acc
    }, {})

    const results = []

    for (const [unit, entries] of Object.entries(grouped)) {
      const table = getTableName(unit)
      const payloads = entries.map(e => {
        const payload = { ...e, piece_rate: e.rate }
        delete payload.unit
        delete payload.rate
        if (!payload.id) payload.id = crypto.randomUUID()
        return payload
      })

      const { data, error } = await supabase
        .from(table)
        .upsert(payloads)
        .select()
      if (error) throw error
      
      const mapped = data.map(d => ({ ...d, unit, rate: d.piece_rate }))
      results.push(...mapped)
    }

    return results
  },

  /**
   * Subscribe to real-time changes
   */
  subscribe(callback) {
    // We must subscribe to all 4 tables
    const channels = UNITS.map(unit => {
      return supabase
        .channel(`${unit}_work_log_changes`)
        .on('postgres_changes', { event: '*', schema: 'public', table: `${unit}_work_log` }, (payload) => {
           // Inject unit back into the payload
           if (payload.new) {
             payload.new.unit = unit
             payload.new.rate = payload.new.piece_rate
           }
           if (payload.old) payload.old.unit = unit
           callback(payload)
        })
        .subscribe()
    })

    return {
      unsubscribe: () => {
        channels.forEach(ch => supabase.removeChannel(ch))
      }
    }
  },
}
