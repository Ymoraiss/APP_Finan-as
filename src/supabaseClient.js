import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const isMock = !supabaseUrl || !supabaseAnonKey || supabaseAnonKey.includes('YOUR_ANON_KEY')

class MockSupabase {
  constructor() {
    this.storageKey = 'finance_tracker_transactions'
    this.authKey = 'finance_tracker_auth_user'
    this.usersKey = 'finance_tracker_users'
    
    if (!localStorage.getItem(this.storageKey)) {
      localStorage.setItem(this.storageKey, JSON.stringify([]))
    }
    if (!localStorage.getItem(this.usersKey)) {
      localStorage.setItem(this.usersKey, JSON.stringify([]))
    }
  }

  get auth() {
    return {
      signUp: async ({ email, password }) => {
        const users = JSON.parse(localStorage.getItem(this.usersKey) || '[]')
        if (users.find(u => u.email === email)) {
          return { data: null, error: { message: 'Usuário já cadastrado.' } }
        }
        const newUser = { id: Math.random().toString(36).substring(2), email, password }
        users.push(newUser)
        localStorage.setItem(this.usersKey, JSON.stringify(users))
        localStorage.setItem(this.authKey, JSON.stringify(newUser))
        return { data: { user: { id: newUser.id, email } }, error: null }
      },
      signInWithPassword: async ({ email, password }) => {
        const users = JSON.parse(localStorage.getItem(this.usersKey) || '[]')
        const user = users.find(u => u.email === email && u.password === password)
        if (!user) {
          return { data: null, error: { message: 'E-mail ou senha incorretos.' } }
        }
        localStorage.setItem(this.authKey, JSON.stringify(user))
        return { data: { user: { id: user.id, email } }, error: null }
      },
      signOut: async () => {
        localStorage.removeItem(this.authKey)
        return { error: null }
      },
      getSession: async () => {
        const sessionUser = localStorage.getItem(this.authKey)
        if (sessionUser) {
          const user = JSON.parse(sessionUser)
          return { data: { session: { user } }, error: null }
        }
        return { data: { session: null }, error: null }
      },
      getUser: async () => {
        const sessionUser = localStorage.getItem(this.authKey)
        if (sessionUser) {
          return { data: { user: JSON.parse(sessionUser) }, error: null }
        }
        return { data: { user: null }, error: null }
      },
      onAuthStateChange: (callback) => {
        const handleStorage = () => {
          const sessionUser = localStorage.getItem(this.authKey)
          const session = sessionUser ? { user: JSON.parse(sessionUser) } : null
          callback(sessionUser ? 'SIGNED_IN' : 'SIGNED_OUT', session)
        }
        window.addEventListener('storage', handleStorage)
        
        const sessionUser = localStorage.getItem(this.authKey)
        const session = sessionUser ? { user: JSON.parse(sessionUser) } : null
        callback(session ? 'SIGNED_IN' : 'SIGNED_OUT', session)
        
        return {
          data: {
            subscription: {
              unsubscribe: () => window.removeEventListener('storage', handleStorage)
            }
          }
        }
      }
    }
  }

  from(table) {
    if (table !== 'transactions') {
      return {
        select: () => ({ order: () => ({ data: [], error: null }) }),
        insert: () => ({ error: null }),
        delete: () => ({ eq: () => ({ error: null }) }),
        update: () => ({ eq: () => ({ error: null }) })
      }
    }

    const getTransactions = () => {
      const all = JSON.parse(localStorage.getItem(this.storageKey) || '[]')
      const userStr = localStorage.getItem(this.authKey)
      if (userStr) {
        const user = JSON.parse(userStr)
        return all.filter(t => t.user_id === user.id)
      }
      return all
    }

    const saveTransactions = (txs) => {
      const all = JSON.parse(localStorage.getItem(this.storageKey) || '[]')
      const userStr = localStorage.getItem(this.authKey)
      let userId = null
      if (userStr) {
        userId = JSON.parse(userStr).id
      }
      const otherUsersTxs = all.filter(t => t.user_id !== userId)
      const newAll = [...otherUsersTxs, ...txs]
      localStorage.setItem(this.storageKey, JSON.stringify(newAll))
    }

    return {
      select: (fields) => {
        const data = getTransactions()
        return {
          order: (column, { ascending = true } = {}) => {
            data.sort((a, b) => {
              const valA = a[column]
              const valB = b[column]
              if (valA < valB) return ascending ? -1 : 1
              if (valA > valB) return ascending ? 1 : -1
              return 0
            })
            return { data, error: null }
          },
          eq: (col, val) => {
            const filtered = data.filter(t => t[col] === val)
            return { data: filtered, error: null }
          }
        }
      },
      insert: async (rows) => {
        const txs = getTransactions()
        const userStr = localStorage.getItem(this.authKey)
        const userId = userStr ? JSON.parse(userStr).id : null
        
        const newRows = rows.map(r => ({
          id: Math.random().toString(36).substring(2),
          created_at: new Date().toISOString(),
          user_id: userId,
          ...r
        }))
        
        txs.push(...newRows)
        saveTransactions(txs)
        return { data: newRows, error: null }
      },
      update: (updates) => {
        return {
          eq: async (col, val) => {
            const txs = getTransactions()
            const index = txs.findIndex(t => t[col] === val)
            if (index !== -1) {
              txs[index] = { ...txs[index], ...updates }
              saveTransactions(txs)
              return { data: [txs[index]], error: null }
            }
            return { data: [], error: { message: 'Not found' } }
          }
        }
      },
      delete: () => {
        return {
          eq: async (col, val) => {
            const txs = getTransactions()
            const filtered = txs.filter(t => t[col] !== val)
            saveTransactions(filtered)
            return { error: null }
          }
        }
      }
    }
  }
}

let supabaseInstance
if (isMock) {
  console.warn("Supabase credentials not fully configured. Running in Local Storage Mock Mode.")
  supabaseInstance = new MockSupabase()
} else {
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey)
}

export const supabase = supabaseInstance
export const isSupabaseMocked = isMock
