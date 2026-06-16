import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://vudtmbvkvkrzmpagcrue.supabase.co'
const supabaseAnonKey = 'sb_publishable_9WrW_dKsix2qZs5PMo7A0Q_0iGgxQWc'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function createFirstAdmin() {
  const email = 'admin2@wagetrack.com' // Changed to bypass rate limit
  const password = 'Password123!' // Change this if you want
  const username = 'Admin'

  console.log(`Creating admin user: ${email}...`)

  // 1. Sign up with Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  })

  if (authError) {
    console.error('Auth Error:', authError.message)
    return
  }

  // 2. Insert into our custom users table as an 'admin'
  const { error: profileError } = await supabase.from('users').insert({
    auth_id: authData.user.id,
    username,
    email,
    role: 'admin',
    access: { unit1: [], unit2: [], unit3: [], unit4: [], maintenance: [] }
  })

  if (profileError) {
    console.error('Profile Error:', profileError.message)
    return
  }

  console.log('\n✅ Success! First Admin created.')
  console.log(`Email: ${email}`)
  console.log(`Password: ${password}`)
  console.log('\nYou can now log in to the app, change this password later, and use the "Users" page to create other supervisors.')
}

createFirstAdmin()
