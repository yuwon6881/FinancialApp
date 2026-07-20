import React, { useState, useEffect } from 'react'
import { ShieldCheck, ShieldAlert } from 'lucide-react'
import * as api from '../lib/api'
import { CustomSelect } from './ui/CustomSelect'

interface SecurityQuestionSetupProps {
  onComplete: () => void
}

export const SecurityQuestionSetup: React.FC<SecurityQuestionSetupProps> = ({ onComplete }) => {
  const [availableQuestions, setAvailableQuestions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [q1, setQ1] = useState<number>(-1)
  const [q2, setQ2] = useState<number>(-1)
  const [q3, setQ3] = useState<number>(-1)

  const [a1, setA1] = useState('')
  const [a2, setA2] = useState('')
  const [a3, setA3] = useState('')

  useEffect(() => {
    api.getAvailableSecurityQuestions()
      .then(q => setAvailableQuestions(q))
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load questions'))
      .finally(() => setLoading(false))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (q1 === -1 || q2 === -1 || q3 === -1) {
      setError('Please select three questions.')
      return
    }

    if (new Set([q1, q2, q3]).size !== 3) {
      setError('Please select three distinct questions.')
      return
    }

    if (!a1.trim() || !a2.trim() || !a3.trim()) {
      setError('Answers cannot be empty.')
      return
    }

    setSubmitting(true)
    try {
      await api.setupSecurityQuestions([
        { questionId: q1, answer: a1 },
        { questionId: q2, answer: a2 },
        { questionId: q3, answer: a3 },
      ])
      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="app-shell min-h-screen text-foreground flex items-center justify-center select-none">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          <p className="text-xs font-semibold text-muted-foreground">Loading security questions...</p>
        </div>
      </div>
    )
  }

  const rows = [
    { id: 'q1', val: q1, setVal: setQ1, ans: a1, setAns: setA1 },
    { id: 'q2', val: q2, setVal: setQ2, ans: a2, setAns: setA2 },
    { id: 'q3', val: q3, setVal: setQ3, ans: a3, setAns: setA3 },
  ]

  return (
    <div className="app-shell min-h-screen text-foreground flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card/60 backdrop-blur-xl border border-border/60 rounded-3xl p-8 shadow-2xl relative z-10 space-y-6">

        {/* Header */}
        <div className="text-center space-y-2 select-none">
          <div className="mx-auto size-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
            <ShieldCheck className="size-6 text-blue-500" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Secure your account</h1>
          <p className="text-xs text-muted-foreground">
            Pick three questions only you can answer. We use these to verify it's really you if you ever
            need to recover your password.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-xl flex items-center gap-2.5 animate-in slide-in-from-top-2 duration-200">
            <ShieldAlert className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form noValidate onSubmit={handleSubmit} className="space-y-5">
          {rows.map((item, idx) => {
            const chosenElsewhere = rows.filter(r => r.id !== item.id).map(r => r.val)
            const options = [
              { value: -1, label: 'Select a question…' },
              ...availableQuestions
                .map((q, i) => ({ value: i, label: q }))
                .filter(opt => !chosenElsewhere.includes(opt.value)),
            ]
            return (
              <div key={item.id} className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <span className="flex items-center justify-center size-5 rounded-md bg-blue-500/10 text-blue-500 text-[10px] font-black">
                    {idx + 1}
                  </span>
                  Question {idx + 1}
                </label>
                <CustomSelect<number>
                  ariaLabel={`Security question ${idx + 1}`}
                  value={item.val}
                  onChange={item.setVal}
                  options={options}
                  className="w-full"
                />
                <input
                  type="text"
                  value={item.ans}
                  onChange={e => item.setAns(e.target.value)}
                  placeholder="Your answer"
                  autoComplete="off"
                  className="w-full px-3.5 py-2.5 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 transition duration-200"
                />
              </div>
            )
          })}

          <button
            type="submit"
            disabled={submitting}
            className="press-scale w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-muted disabled:text-muted-foreground text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-600/15 hover:shadow-blue-600/25 transition duration-200 flex items-center justify-center gap-2 cursor-pointer"
          >
            {submitting ? (
              <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : (
              'Save & Continue'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
