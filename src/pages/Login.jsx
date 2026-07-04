import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await signIn(email, password)
    if (error) { setError(error.message); setLoading(false) }
    else navigate('/dashboard')
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your account">
      <form onSubmit={handleSubmit} className="space-y-4">
        <input className="input" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
        <input className="input" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
        <div className="text-right">
          <Link to="/forgot-password" className="text-gold hover:underline text-xs">Forgot password?</Link>
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button className="btn-primary w-full" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p className="text-center text-espresso-soft text-sm mt-6">
        No account? <Link to="/signup" className="text-gold hover:underline">Sign up free</Link>
      </p>
    </AuthLayout>
  )
}

export function Signup() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await signUp(email, password, name)
    if (error) { setError(error.message); setLoading(false) }
    else navigate('/dashboard')
  }

  return (
    <AuthLayout title="Create your account" subtitle="Start sharing moments in minutes">
      <form onSubmit={handleSubmit} className="space-y-4">
        <input className="input" type="text" placeholder="Full name" value={name} onChange={e => setName(e.target.value)} required />
        <input className="input" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
        <input className="input" type="password" placeholder="Password (min 6 chars)" value={password} onChange={e => setPassword(e.target.value)} minLength={6} required />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button className="btn-primary w-full" disabled={loading}>{loading ? 'Creating account…' : 'Create account'}</button>
      </form>
      <p className="text-center text-espresso-soft text-sm mt-6">
        Already have an account? <Link to="/login" className="text-gold hover:underline">Sign in</Link>
      </p>
    </AuthLayout>
  )
}

export function ForgotPassword() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await resetPassword(email)
    if (error) { setError(error.message); setLoading(false) }
    else setSent(true)
  }

  return (
    <AuthLayout title="Reset your password" subtitle="We'll email you a link to set a new one">
      {sent ? (
        <p className="text-center text-espresso-soft text-sm">Check your inbox for a reset link.</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <input className="input" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button className="btn-primary w-full" disabled={loading}>{loading ? 'Sending…' : 'Send reset link'}</button>
        </form>
      )}
      <p className="text-center text-espresso-soft text-sm mt-6">
        <Link to="/login" className="text-gold hover:underline">Back to sign in</Link>
      </p>
    </AuthLayout>
  )
}

export function ResetPassword() {
  const { updatePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await updatePassword(password)
    if (error) { setError(error.message); setLoading(false) }
    else { setDone(true); setTimeout(() => navigate('/dashboard'), 1500) }
  }

  return (
    <AuthLayout title="Set a new password" subtitle="Choose a new password for your account">
      {done ? (
        <p className="text-center text-espresso-soft text-sm">Password updated — redirecting…</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <input className="input" type="password" placeholder="New password (min 6 chars)" value={password} onChange={e => setPassword(e.target.value)} minLength={6} required />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button className="btn-primary w-full" disabled={loading}>{loading ? 'Updating…' : 'Update password'}</button>
        </form>
      )}
    </AuthLayout>
  )
}

function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-4">
      <Link to="/" className="serif text-2xl mb-10 tracking-wide">Share <span className="text-gold">2</span> Share</Link>
      <div className="card w-full max-w-md">
        <h1 className="serif text-3xl mb-1">{title}</h1>
        <p className="text-espresso-soft text-sm mb-8">{subtitle}</p>
        {children}
      </div>
    </div>
  )
}

export default Login
