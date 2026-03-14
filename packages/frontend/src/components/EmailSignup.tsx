'use client'

import { useState } from 'react'

export function EmailSignup() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    try {
      const res = await fetch('/api/notify/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (res.ok) {
        setStatus('done')
        setMessage('Noted. We will let you know.')
        setEmail('')
      } else {
        setStatus('error')
        setMessage(data.error || 'Something went wrong.')
      }
    } catch {
      setStatus('error')
      setMessage('Network error. Try again.')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 items-center justify-center mt-4">
      {status === 'done' ? (
        <p className="text-sm text-dao-gold">{message}</p>
      ) : (
        <>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:border-dao-purple focus:outline-none w-full sm:w-64"
          />
          <button
            type="submit"
            disabled={status === 'sending'}
            className="bg-dao-purple hover:bg-purple-700 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {status === 'sending' ? 'Sending...' : 'Notify me'}
          </button>
          {status === 'error' && (
            <p className="text-sm text-red-400">{message}</p>
          )}
        </>
      )}
    </form>
  )
}
