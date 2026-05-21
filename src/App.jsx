import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase, isSupabaseMocked } from './supabaseClient'
import {
  TrendingUp, TrendingDown, Wallet, PlusCircle,
  List, Trash2, ArrowUpCircle, ArrowDownCircle,
  CheckCircle, AlertCircle, Loader, LogOut,
  Edit2, Download, FileText, Calendar, Lock,
  BarChart2, PieChart, X
} from 'lucide-react'

const CATEGORIES = {
  income: ['Salário', 'Freelance', 'Investimentos', 'Presente', 'Reembolso', 'Outros'],
  expense: ['Alimentação', 'Moradia', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Roupas', 'Contas', 'Outros'],
}

const CATEGORY_COLORS = {
  // Income colors
  'Salário': '#10b981',
  'Freelance': '#3b82f6',
  'Investimentos': '#8b5cf6',
  'Presente': '#ec4899',
  'Reembolso': '#f59e0b',
  // Expense colors
  'Alimentação': '#ef4444',
  'Moradia': '#f97316',
  'Transporte': '#eab308',
  'Saúde': '#06b6d4',
  'Educação': '#3b82f6',
  'Lazer': '#a855f7',
  'Roupas': '#ec4899',
  'Contas': '#6366f1',
  'Outros': '#64748b',
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function Toast({ toast }) {
  if (!toast) return null
  return (
    <div className={`toast ${toast.type}`}>
      {toast.type === 'success'
        ? <CheckCircle size={16} color="var(--income-color)" />
        : <AlertCircle size={16} color="var(--expense-color)" />
      }
      {toast.message}
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [filter, setFilter] = useState('all')
  const [toast, setToast] = useState(null)

  // Auth States
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authMode, setAuthMode] = useState('login')
  const [authLoading, setAuthLoading] = useState(false)

  // Month Filter State
  const [selectedMonth, setSelectedMonth] = useState('all')

  // Edit State
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [editDescription, setEditDescription] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editType, setEditType] = useState('income')
  const [editCategory, setEditCategory] = useState('')

  // Form state
  const [type, setType] = useState('income')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState(CATEGORIES.income[0])

  // Chart Tab State
  const [activeChartTab, setActiveChartTab] = useState('donut')

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Auth changes
  useEffect(() => {
    const initAuth = async () => {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user || null)
      setLoading(false)
    }
    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null)
      if (session?.user) {
        fetchTransactions()
      } else {
        setTransactions([])
      }
    })

    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      showToast('Erro ao carregar transações.', 'error')
    } else {
      setTransactions(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (user) {
      fetchTransactions()
    }
  }, [user, fetchTransactions])

  // Change category when type changes in form
  useEffect(() => {
    setCategory(CATEGORIES[type][0])
  }, [type])

  // Change category when type changes in edit form
  useEffect(() => {
    if (editingTransaction && editType) {
      if (!CATEGORIES[editType].includes(editCategory)) {
        setEditCategory(CATEGORIES[editType][0])
      }
    }
  }, [editType, editingTransaction])

  // Calculate unique months available
  const availableMonths = useMemo(() => {
    const months = new Set()
    transactions.forEach(t => {
      const date = new Date(t.created_at)
      const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      months.add(monthYear)
    })
    return Array.from(months).sort().reverse()
  }, [transactions])

  // Format month label (e.g. 2026-05 -> Maio / 2026)
  const formatMonthLabel = (monthStr) => {
    const [year, month] = monthStr.split('-')
    const date = new Date(year, parseInt(month) - 1, 1)
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  }

  // Filter transactions by selected month & type
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesType = filter === 'all' ? true : t.type === filter
      
      let matchesMonth = true
      if (selectedMonth !== 'all') {
        const date = new Date(t.created_at)
        const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        matchesMonth = monthYear === selectedMonth
      }
      
      return matchesType && matchesMonth
    })
  }, [transactions, filter, selectedMonth])

  const totalIncome = useMemo(() => {
    return filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((s, t) => s + Number(t.amount), 0)
  }, [filteredTransactions])

  const totalExpense = useMemo(() => {
    return filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((s, t) => s + Number(t.amount), 0)
  }, [filteredTransactions])

  const balance = totalIncome - totalExpense

  // Category breakdown for Expense Donut Chart
  const categoryBreakdown = useMemo(() => {
    const expenses = filteredTransactions.filter(t => t.type === 'expense')
    const total = expenses.reduce((s, t) => s + Number(t.amount), 0)
    
    const sums = {}
    expenses.forEach(t => {
      sums[t.category] = (sums[t.category] || 0) + Number(t.amount)
    })
    
    return Object.entries(sums).map(([name, value]) => ({
      name,
      value,
      percent: total > 0 ? (value / total) * 100 : 0,
      color: CATEGORY_COLORS[name] || '#64748b'
    })).sort((a, b) => b.value - a.value)
  }, [filteredTransactions])

  // Donut chart calculations
  const donutCircles = useMemo(() => {
    const radius = 35
    const circumference = 2 * Math.PI * radius
    let accumulatedPercent = 0
    
    return categoryBreakdown.map((cat) => {
      const strokeDashoffset = circumference - (cat.percent / 100) * circumference
      const strokeDasharray = `${circumference}`
      const rotation = (accumulatedPercent / 100) * 360 - 90
      accumulatedPercent += cat.percent
      
      return {
        ...cat,
        strokeDashoffset,
        strokeDasharray,
        rotation
      }
    })
  }, [categoryBreakdown])

  // Handle Auth
  const handleAuthSubmit = async (e) => {
    e.preventDefault()
    if (!authEmail.trim() || !authPassword) {
      showToast('Preencha os campos de login.', 'error')
      return
    }
    setAuthLoading(true)
    
    if (authMode === 'login') {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: authEmail.trim(),
        password: authPassword,
      })
      if (error) {
        showToast(error.message, 'error')
      } else {
        showToast('Login realizado com sucesso!', 'success')
      }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: authEmail.trim(),
        password: authPassword,
      })
      if (error) {
        showToast(error.message, 'error')
      } else {
        showToast('Conta criada com sucesso! Você está logado.', 'success')
      }
    }
    setAuthLoading(false)
  }

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      showToast('Erro ao sair.', 'error')
    } else {
      setUser(null)
      setTransactions([])
      showToast('Sessão encerrada.', 'success')
    }
  }

  // Handle new transaction submit
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!description.trim() || !amount || Number(amount) <= 0) {
      showToast('Preencha todos os campos corretamente.', 'error')
      return
    }

    setSubmitting(true)
    const { error } = await supabase.from('transactions').insert([{
      description: description.trim(),
      amount: parseFloat(amount),
      type,
      category,
    }])

    if (error) {
      showToast('Erro ao salvar transação.', 'error')
    } else {
      showToast(
        type === 'income' ? '✅ Entrada registrada!' : '✅ Saída registrada!',
        'success'
      )
      setDescription('')
      setAmount('')
      setCategory(CATEGORIES[type][0])
      fetchTransactions()
    }
    setSubmitting(false)
  }

  // Open Edit Modal
  const startEdit = (transaction) => {
    setEditingTransaction(transaction)
    setEditDescription(transaction.description)
    setEditAmount(transaction.amount)
    setEditType(transaction.type)
    setEditCategory(transaction.category)
  }

  // Submit Edit
  const handleEditSubmit = async (e) => {
    e.preventDefault()
    if (!editDescription.trim() || !editAmount || Number(editAmount) <= 0) {
      showToast('Preencha todos os campos corretamente.', 'error')
      return
    }

    setSubmitting(true)
    const { error } = await supabase
      .from('transactions')
      .update({
        description: editDescription.trim(),
        amount: parseFloat(editAmount),
        type: editType,
        category: editCategory,
      })
      .eq('id', editingTransaction.id)

    if (error) {
      showToast('Erro ao atualizar transação.', 'error')
    } else {
      showToast('Transação atualizada com sucesso!', 'success')
      setEditingTransaction(null)
      fetchTransactions()
    }
    setSubmitting(false)
  }

  // Delete transaction
  const handleDelete = async (id) => {
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) {
      showToast('Erro ao excluir transação.', 'error')
    } else {
      setTransactions(prev => prev.filter(t => t.id !== id))
      showToast('Transação excluída.', 'success')
    }
  }

  // Export to CSV
  const exportToCSV = () => {
    if (filteredTransactions.length === 0) {
      showToast('Nenhuma transação para exportar.', 'error')
      return
    }

    const headers = ['Data', 'Descricao', 'Valor', 'Tipo', 'Categoria']
    const rows = filteredTransactions.map(t => [
      new Date(t.created_at).toLocaleDateString('pt-BR'),
      t.description.replace(/"/g, '""'),
      t.amount,
      t.type === 'income' ? 'Entrada' : 'Saída',
      t.category
    ])

    const csvContent = "data:text/csv;charset=utf-8,\ufeff" 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n')
    
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `relatorio_financeiro_${selectedMonth}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast('CSV exportado!', 'success')
  }

  // Export to PDF (Native print styling)
  const exportToPDF = () => {
    if (filteredTransactions.length === 0) {
      showToast('Nenhuma transação para exportar.', 'error')
      return
    }

    const printWindow = window.open('', '_blank')
    const html = `
      <html>
        <head>
          <title>Relatório Financeiro — FinanceApp</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; padding: 40px; line-height: 1.5; }
            h1 { font-size: 24px; font-weight: 800; color: #0f172a; margin-bottom: 5px; }
            .subtitle { font-size: 14px; color: #64748b; margin-bottom: 30px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border-bottom: 1px solid #e2e8f0; padding: 12px 10px; text-align: left; font-size: 13px; }
            th { background-color: #f8fafc; font-weight: 700; color: #475569; }
            .income { color: #10b981; font-weight: 600; }
            .expense { color: #ef4444; font-weight: 600; }
            .summary-box { display: flex; gap: 20px; margin-bottom: 30px; }
            .card { flex: 1; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; }
            .card-label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 5px; }
            .card-value { font-size: 20px; font-weight: 800; }
            .total-balance { color: ${balance >= 0 ? '#10b981' : '#ef4444'}; }
          </style>
        </head>
        <body>
          <h1>Relatório de Controle Financeiro</h1>
          <div class="subtitle">Período: ${selectedMonth === 'all' ? 'Todos os meses' : formatMonthLabel(selectedMonth)} | Exportado em: ${new Date().toLocaleDateString('pt-BR')}</div>
          
          <div class="summary-box">
            <div class="card">
              <div class="card-label">Total Entradas</div>
              <div class="card-value income">${formatCurrency(totalIncome)}</div>
            </div>
            <div class="card">
              <div class="card-label">Total Saídas</div>
              <div class="card-value expense">${formatCurrency(totalExpense)}</div>
            </div>
            <div class="card">
              <div class="card-label">Saldo Atual</div>
              <div class="card-value total-balance">${formatCurrency(balance)}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Tipo</th>
                <th style="text-align: right;">Valor</th>
              </tr>
            </thead>
            <tbody>
              ${filteredTransactions.map(t => `
                <tr>
                  <td>${new Date(t.created_at).toLocaleDateString('pt-BR')}</td>
                  <td>${t.description}</td>
                  <td>${t.category}</td>
                  <td>${t.type === 'income' ? 'Entrada' : 'Saída'}</td>
                  <td style="text-align: right;" class="${t.type}">${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(() => window.close(), 500);
            }
          </script>
        </body>
      </html>
    `
    printWindow.document.write(html)
    printWindow.document.close()
  }

  const balanceClass = balance > 0 ? 'positive' : balance < 0 ? 'negative' : 'zero'

  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  })

  // If loading and no user yet
  if (loading && !user) {
    return (
      <div className="auth-wrapper">
        <div className="loading-state">
          <Loader className="spinner" size={24} />
          Carregando FinanceApp...
        </div>
      </div>
    )
  }

  // Authentication screen
  if (!user) {
    return (
      <div className="auth-wrapper">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo">
              <div className="logo-icon">💰</div>
            </div>
            <h1 className="auth-title">FinanceApp</h1>
            <p className="auth-subtitle">
              {authMode === 'login' ? 'Entre na sua conta para continuar' : 'Cadastre-se para começar a poupar'}
            </p>
          </div>

          {isSupabaseMocked && (
            <div style={{
              background: 'rgba(59,130,246,0.06)',
              border: '1px solid rgba(59,130,246,0.2)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 14px',
              fontSize: '0.78rem',
              color: 'var(--text-secondary)',
              marginBottom: '20px',
              lineHeight: '1.4'
            }}>
              💡 <strong>Modo Local Ativo:</strong> Nenhuma chave do Supabase configurada. Você pode cadastrar/logar com qualquer email/senha e os dados serão salvos localmente.
            </div>
          )}

          <form onSubmit={handleAuthSubmit}>
            <div className="form-group">
              <label className="form-label">E-mail</label>
              <input
                className="form-input"
                type="email"
                placeholder="seuemail@exemplo.com"
                value={authEmail}
                onChange={e => setAuthEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Senha</label>
              <input
                className="form-input"
                type="password"
                placeholder="Sua senha"
                value={authPassword}
                onChange={e => setAuthPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="submit-btn income-btn"
              style={{ marginTop: '24px' }}
            >
              {authLoading ? (
                <><Loader size={16} className="spinner" /> Carregando...</>
              ) : authMode === 'login' ? (
                <>Entrar</>
              ) : (
                <>Criar Conta</>
              )}
            </button>
          </form>

          <div className="auth-switch">
            {authMode === 'login' ? (
              <>
                Não tem uma conta?
                <button className="auth-switch-btn" onClick={() => setAuthMode('signup')}>
                  Cadastre-se
                </button>
              </>
            ) : (
              <>
                Já possui conta?
                <button className="auth-switch-btn" onClick={() => setAuthMode('login')}>
                  Faça Login
                </button>
              </>
            )}
          </div>
        </div>
        <Toast toast={toast} />
      </div>
    )
  }

  // Dashboard screen
  return (
    <div className="app-wrapper">
      <div className="app-container">
        
        {/* Header */}
        <header className="app-header">
          <div className="app-logo">
            <div className="logo-icon">💰</div>
            <div>
              <div className="app-title">FinanceApp</div>
              <div className="app-subtitle">Controle Financeiro Pessoal</div>
            </div>
          </div>

          <div className="header-user">
            <span className="user-email">{user.email}</span>
            <button className="logout-btn" onClick={handleLogout} title="Sair do aplicativo">
              <LogOut size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Sair
            </button>
          </div>
        </header>

        {/* Month Selector & Exports */}
        <div className="actions-bar">
          <div className="filter-group">
            <Calendar size={16} color="var(--text-muted)" />
            <select
              className="month-select"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
            >
              <option value="all">Todos os Meses</option>
              {availableMonths.map(m => (
                <option key={m} value={m}>{formatMonthLabel(m)}</option>
              ))}
            </select>
          </div>

          <div className="export-group">
            <button className="action-btn" onClick={exportToCSV} title="Exportar para Excel (CSV)">
              <Download size={14} /> CSV
            </button>
            <button className="action-btn" onClick={exportToPDF} title="Imprimir ou Salvar em PDF">
              <FileText size={14} /> PDF
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="summary-grid">
          <div className="summary-card income">
            <div className="card-icon income">
              <TrendingUp size={18} />
            </div>
            <div className="card-label">Total Entradas</div>
            <div className="card-value income">{formatCurrency(totalIncome)}</div>
            <div className="card-count">
              {filteredTransactions.filter(t => t.type === 'income').length} transações
            </div>
          </div>

          <div className="summary-card expense">
            <div className="card-icon expense">
              <TrendingDown size={18} />
            </div>
            <div className="card-label">Total Saídas</div>
            <div className="card-value expense">{formatCurrency(totalExpense)}</div>
            <div className="card-count">
              {filteredTransactions.filter(t => t.type === 'expense').length} transações
            </div>
          </div>

          <div className={`summary-card balance ${balanceClass}`}>
            <div className={`card-icon ${balance >= 0 ? 'balance' : 'expense'}`}>
              <Wallet size={18} />
            </div>
            <div className="card-label">Saldo Atual</div>
            <div className={`card-value ${balanceClass}`}>
              {formatCurrency(balance)}
            </div>
            <div className="card-count">
              {balance >= 0 ? '🟢 Situação positiva' : '🔴 Situação negativa'}
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="charts-card">
          <div className="charts-header">
            <div className="charts-title">
              {activeChartTab === 'donut' ? <PieChart size={18} /> : <BarChart2 size={18} />}
              Análise de Gastos
            </div>
            
            <div className="charts-toggle">
              <button
                className={`charts-toggle-btn ${activeChartTab === 'donut' ? 'active' : ''}`}
                onClick={() => setActiveChartTab('donut')}
              >
                Categorias
              </button>
              <button
                className={`charts-toggle-btn ${activeChartTab === 'bar' ? 'active' : ''}`}
                onClick={() => setActiveChartTab('bar')}
              >
                Balanço
              </button>
            </div>
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px 0' }}>
              <div className="empty-icon">📊</div>
              <div className="empty-title">Sem dados para gráficos</div>
              <div className="empty-subtitle">Adicione transações para ver o relatório gráfico.</div>
            </div>
          ) : activeChartTab === 'donut' ? (
            categoryBreakdown.length === 0 ? (
              <div className="empty-state" style={{ padding: '30px 0' }}>
                <div className="empty-icon">💸</div>
                <div className="empty-title">Nenhuma saída registrada</div>
                <div className="empty-subtitle">O gráfico de categorias exibe a distribuição de saídas.</div>
              </div>
            ) : (
              <div className="chart-content">
                <svg width="120" height="120" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="35" stroke="var(--bg-input)" strokeWidth="8" fill="none" />
                  {donutCircles.map((circle, idx) => (
                    <circle
                      key={idx}
                      className="donut-segment"
                      cx="50"
                      cy="50"
                      r="35"
                      stroke={circle.color}
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={circle.strokeDasharray}
                      strokeDashoffset={circle.strokeDashoffset}
                      transform={`rotate(${circle.rotation} 50 50)`}
                    />
                  ))}
                  <g>
                    <text x="50" y="47" textAnchor="middle" fill="var(--text-muted)" fontSize="8" fontWeight="600">GASTOS</text>
                    <text x="50" y="58" textAnchor="middle" fill="var(--text-primary)" fontSize="9" fontWeight="800">
                      {formatCurrency(totalExpense).split(',')[0]}
                    </text>
                  </g>
                </svg>

                <div className="chart-legends">
                  {categoryBreakdown.map((cat, idx) => (
                    <div key={idx} className="legend-item">
                      <div className="legend-dot" style={{ backgroundColor: cat.color }} />
                      <div className="legend-info">
                        <span className="legend-name">{cat.name}</span>
                        <span className="legend-value">{formatCurrency(cat.value)}</span>
                        <span className="legend-percent">{cat.percent.toFixed(1)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          ) : (
            <div className="bar-chart-container">
              {/* Income Bar */}
              <div className="bar-row">
                <div className="bar-row-header">
                  <span className="bar-row-label">Total Entradas</span>
                  <span className="bar-row-value income">{formatCurrency(totalIncome)}</span>
                </div>
                <div className="bar-track">
                  <div
                    className="bar-fill income"
                    style={{
                      width: `${(totalIncome + totalExpense) > 0 ? (totalIncome / (totalIncome + totalExpense)) * 100 : 0}%`
                    }}
                  />
                </div>
              </div>

              {/* Expense Bar */}
              <div className="bar-row">
                <div className="bar-row-header">
                  <span className="bar-row-label">Total Saídas</span>
                  <span className="bar-row-value expense">{formatCurrency(totalExpense)}</span>
                </div>
                <div className="bar-track">
                  <div
                    className="bar-fill expense"
                    style={{
                      width: `${(totalIncome + totalExpense) > 0 ? (totalExpense / (totalIncome + totalExpense)) * 100 : 0}%`
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Main content: Form + List */}
        <div className="main-content">
          
          {/* Form */}
          <div className="form-card">
            <div className="form-title">
              <PlusCircle size={18} />
              Nova Transação
            </div>

            <form onSubmit={handleSubmit}>
              
              {/* Type toggle */}
              <div className="type-toggle">
                <button
                  type="button"
                  className={`toggle-btn ${type === 'income' ? 'active-income' : ''}`}
                  onClick={() => setType('income')}
                >
                  <ArrowUpCircle size={15} /> Entrada
                </button>
                <button
                  type="button"
                  className={`toggle-btn ${type === 'expense' ? 'active-expense' : ''}`}
                  onClick={() => setType('expense')}
                >
                  <ArrowDownCircle size={15} /> Saída
                </button>
              </div>

              <div className="form-group">
                <label className="form-label">Descrição</label>
                <input
                  id="description"
                  className="form-input"
                  type="text"
                  placeholder="Ex: Salário, Aluguel..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Valor</label>
                <div className="amount-wrapper">
                  <span className="amount-prefix">R$</span>
                  <input
                    id="amount"
                    className="form-input amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="0,00"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Categoria</label>
                <select
                  id="category"
                  className="form-select"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                >
                  {CATEGORIES[type].map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <button
                id="submit-transaction"
                type="submit"
                disabled={submitting}
                className={`submit-btn ${type === 'income' ? 'income-btn' : 'expense-btn'}`}
              >
                {submitting
                  ? <><Loader size={16} className="spinner" /> Salvando...</>
                  : type === 'income'
                    ? <><ArrowUpCircle size={16} /> Registrar Entrada</>
                    : <><ArrowDownCircle size={16} /> Registrar Saída</>
                }
              </button>
            </form>
          </div>

          {/* Transaction list */}
          <div className="list-card">
            <div className="list-header">
              <div className="list-title">
                <List size={18} />
                Histórico
              </div>
              <span className="transaction-count-badge">
                {filteredTransactions.length} registros
              </span>
            </div>

            <div className="filter-bar">
              {[
                { key: 'all', label: 'Todos' },
                { key: 'income', label: '↑ Entradas' },
                { key: 'expense', label: '↓ Saídas' },
              ].map(f => (
                <button
                  key={f.key}
                  className={`filter-btn ${filter === f.key ? 'active' : ''}`}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="transactions-list">
              {loading ? (
                <div className="loading-state">
                  <Loader className="spinner" size={16} />
                  Carregando transações...
                </div>
              ) : filteredTransactions.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📊</div>
                  <div className="empty-title">Nenhuma transação encontrada</div>
                  <div className="empty-subtitle">
                    {filter === 'all'
                      ? 'Adicione sua primeira entrada ou saída.'
                      : `Nenhuma ${filter === 'income' ? 'entrada' : 'saída'} registrada.`}
                  </div>
                </div>
              ) : (
                filteredTransactions.map(t => (
                  <div key={t.id} className="transaction-item">
                    <div className={`transaction-icon ${t.type}`}>
                      {t.type === 'income'
                        ? <ArrowUpCircle size={18} />
                        : <ArrowDownCircle size={18} />
                      }
                    </div>
                    
                    <div className="transaction-info">
                      <div className="transaction-description">{t.description}</div>
                      <div className="transaction-meta">
                        <span className="transaction-category">{t.category}</span>
                        <span className="transaction-date">{formatDate(t.created_at)}</span>
                      </div>
                    </div>
                    
                    <div className={`transaction-amount ${t.type}`}>
                      {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                    </div>
                    
                    <button
                      className="delete-btn"
                      style={{ color: 'var(--text-muted)' }}
                      onClick={() => startEdit(t)}
                      title="Editar transação"
                    >
                      <Edit2 size={14} />
                    </button>
                    
                    <button
                      className="delete-btn"
                      onClick={() => handleDelete(t.id)}
                      title="Excluir transação"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Transaction Modal */}
      {editingTransaction && (
        <div className="modal-overlay">
          <div className="modal-container">
            
            <div className="modal-header">
              <h3 className="modal-title">Editar Transação</h3>
              <button className="modal-close" onClick={() => setEditingTransaction(null)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              
              {/* Type Toggle in modal */}
              <div className="type-toggle">
                <button
                  type="button"
                  className={`toggle-btn ${editType === 'income' ? 'active-income' : ''}`}
                  onClick={() => setEditType('income')}
                >
                  <ArrowUpCircle size={15} /> Entrada
                </button>
                <button
                  type="button"
                  className={`toggle-btn ${editType === 'expense' ? 'active-expense' : ''}`}
                  onClick={() => setEditType('expense')}
                >
                  <ArrowDownCircle size={15} /> Saída
                </button>
              </div>

              <div className="form-group">
                <label className="form-label">Descrição</label>
                <input
                  className="form-input"
                  type="text"
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Valor</label>
                <div className="amount-wrapper">
                  <span className="amount-prefix">R$</span>
                  <input
                    className="form-input amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={editAmount}
                    onChange={e => setEditAmount(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Categoria</label>
                <select
                  className="form-select"
                  value={editCategory}
                  onChange={e => setEditCategory(e.target.value)}
                >
                  {CATEGORIES[editType].map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="modal-btn cancel"
                  onClick={() => setEditingTransaction(null)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="modal-btn save"
                >
                  {submitting ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </div>
  )
}
