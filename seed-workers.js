import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseUrl = 'https://vudtmbvkvkrzmpagcrue.supabase.co'
const supabaseAnonKey = 'sb_publishable_9WrW_dKsix2qZs5PMo7A0Q_0iGgxQWc'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

const dummyWorkers = [
  // ── Unit 1 (Piece Work & Daily Wages) ──
  { emp_id: 'WT-101', name: 'Rajesh Kumar', unit: 'unit1', category: 'piece_work', emoji: '👷', daily_wage: 0, salary: 0, rate_per_piece: 0, ot_rate: 50 },
  { emp_id: 'WT-102', name: 'Suresh Yadav', unit: 'unit1', category: 'piece_work', emoji: '🧑‍🏭', daily_wage: 0, salary: 0, rate_per_piece: 0, ot_rate: 50 },
  { emp_id: 'WT-103', name: 'Anita Sharma', unit: 'unit1', category: 'daily_wages', emoji: '👩‍🏭', daily_wage: 600, salary: 0, rate_per_piece: 0, ot_rate: 40 },
  { emp_id: 'WT-104', name: 'Vikram Singh', unit: 'unit1', category: 'piece_work', emoji: '🧑‍🌾', daily_wage: 0, salary: 0, rate_per_piece: 0, ot_rate: 55 },
  { emp_id: 'WT-105', name: 'Priya Devi', unit: 'unit1', category: 'daily_wages', emoji: '👩‍🌾', daily_wage: 550, salary: 0, rate_per_piece: 0, ot_rate: 40 },

  // ── Unit 2 (Monthly Salary & Piece Work) ──
  { emp_id: 'WT-201', name: 'Mohammed Irfan', unit: 'unit2', category: 'monthly_salary', emoji: '🧑‍💼', daily_wage: 0, salary: 18000, rate_per_piece: 0, ot_rate: 80 },
  { emp_id: 'WT-202', name: 'Lakshmi Bai', unit: 'unit2', category: 'monthly_salary', emoji: '👩', daily_wage: 0, salary: 15000, rate_per_piece: 0, ot_rate: 70 },
  { emp_id: 'WT-203', name: 'Arun Patil', unit: 'unit2', category: 'piece_work', emoji: '👷', daily_wage: 0, salary: 0, rate_per_piece: 0, ot_rate: 60 },
  { emp_id: 'WT-204', name: 'Deepa Nair', unit: 'unit2', category: 'monthly_salary', emoji: '🧑', daily_wage: 0, salary: 16500, rate_per_piece: 0, ot_rate: 75 },
  { emp_id: 'WT-205', name: 'Karthik Rajan', unit: 'unit2', category: 'piece_work', emoji: '🧑‍🏭', daily_wage: 0, salary: 0, rate_per_piece: 0, ot_rate: 55 },

  // ── Unit 3 (Bundle Packing & Cover Packing) ──
  { emp_id: 'WT-301', name: 'Sunita Kumari', unit: 'unit3', category: 'bundle_packing', emoji: '👩‍🏭', daily_wage: 0, salary: 0, rate_per_piece: 12, ot_rate: 45 },
  { emp_id: 'WT-302', name: 'Manoj Thakur', unit: 'unit3', category: 'bundle_packing', emoji: '👷', daily_wage: 0, salary: 0, rate_per_piece: 12, ot_rate: 45 },
  { emp_id: 'WT-303', name: 'Kavitha Reddy', unit: 'unit3', category: 'cover_packing', emoji: '👩', daily_wage: 0, salary: 0, rate_per_piece: 8, ot_rate: 40 },
  { emp_id: 'WT-304', name: 'Ravi Shankar', unit: 'unit3', category: 'cover_packing', emoji: '🧑', daily_wage: 0, salary: 0, rate_per_piece: 8, ot_rate: 40 },
  { emp_id: 'WT-305', name: 'Parvathi Amma', unit: 'unit3', category: 'bundle_packing', emoji: '👩‍🌾', daily_wage: 0, salary: 0, rate_per_piece: 12, ot_rate: 45 },

  // ── Unit 4 (Daily Wages & Piece Work) ──
  { emp_id: 'WT-401', name: 'Ganesh Babu', unit: 'unit4', category: 'daily_wages', emoji: '🧑‍🏭', daily_wage: 700, salary: 0, rate_per_piece: 0, ot_rate: 50 },
  { emp_id: 'WT-402', name: 'Fatima Begum', unit: 'unit4', category: 'daily_wages', emoji: '👩‍🏭', daily_wage: 650, salary: 0, rate_per_piece: 0, ot_rate: 45 },
  { emp_id: 'WT-403', name: 'Venkat Ramana', unit: 'unit4', category: 'piece_work', emoji: '👷', daily_wage: 0, salary: 0, rate_per_piece: 0, ot_rate: 55 },
  { emp_id: 'WT-404', name: 'Meena Kumari', unit: 'unit4', category: 'daily_wages', emoji: '👩', daily_wage: 600, salary: 0, rate_per_piece: 0, ot_rate: 40 },
  { emp_id: 'WT-405', name: 'Srinivas Rao', unit: 'unit4', category: 'piece_work', emoji: '🧑‍💼', daily_wage: 0, salary: 0, rate_per_piece: 0, ot_rate: 60 },
]

async function seedWorkers() {
  console.log('🔐 Signing in as admin...')

  // Sign in first to satisfy RLS policies
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'admin@wagetrack.com',
    password: 'Password123!',
  })

  if (authError) {
    console.error('❌ Auth failed:', authError.message)
    console.log('\nMake sure the admin account exists. Run: node create-admin.js')
    process.exit(1)
  }

  console.log(`✅ Signed in as: ${authData.user.email}\n`)

  // Add UUID ids to each worker
  const workersWithIds = dummyWorkers.map(w => ({
    ...w,
    id: crypto.randomUUID(),
  }))

  console.log(`📦 Inserting ${workersWithIds.length} workers...\n`)

  const { data, error } = await supabase
    .from('workers')
    .insert(workersWithIds)
    .select()

  if (error) {
    console.error('❌ Insert failed:', error.message)
    process.exit(1)
  }

  console.log(`✅ Successfully seeded ${data.length} workers!\n`)

  // Print summary
  const units = {}
  data.forEach(w => {
    if (!units[w.unit]) units[w.unit] = []
    units[w.unit].push(w)
  })

  Object.keys(units).sort().forEach(unit => {
    console.log(`  ${unit.toUpperCase()} (${units[unit].length} workers):`)
    units[unit].forEach(w => {
      console.log(`    ${w.emoji} ${w.name} — ${w.category} [${w.emp_id}]`)
    })
    console.log()
  })

  await supabase.auth.signOut()
  console.log('🎉 Done! Workers are now visible in the app.')
}

seedWorkers()
