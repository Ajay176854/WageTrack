import { createClient } from '@supabase/supabase-js'

// Try to use the user's .env file by constructing the URL properly
const rawUrl = 'vudtmbvkvkrzmpagcrue'
// Ensure it's a full URL
const supabaseUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}.supabase.co`

const supabaseAnonKey = 'sb_publishable_9WrW_dKsix2qZs5PMo7A0Q_0iGgxQWc'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testConnection() {
  console.log(`Testing connection to: ${supabaseUrl}`)
  
  // Try to fetch users to test the connection and the anon key
  // We'll just fetch a single row from the custom users table we made
  const { data, error } = await supabase.from('users').select('id').limit(1)

  if (error) {
    console.error('❌ Connection Failed! Error details:')
    console.error(error.message)
    console.log('\nPlease double check that your Anon Key is correct and that you ran the SQL schema.')
  } else {
    console.log('✅ Connection Successful! The app can talk to the database.')
  }
}

testConnection()
