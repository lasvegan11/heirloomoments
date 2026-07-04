import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import './index.css'

import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import NewEvent from './pages/NewEvent'
import EventManage from './pages/EventManage'
import GuestUpload from './pages/GuestUpload'
import PhotoWall from './pages/PhotoWall'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen bg-cream flex items-center justify-center"><div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" /></div>
  return user ? children : <Navigate to="/login" replace />
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/dashboard/events/new" element={<ProtectedRoute><NewEvent /></ProtectedRoute>} />
          <Route path="/dashboard/events/:slug" element={<ProtectedRoute><EventManage /></ProtectedRoute>} />
          <Route path="/e/:slug" element={<GuestUpload />} />
          <Route path="/e/:slug/wall" element={<PhotoWall />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
