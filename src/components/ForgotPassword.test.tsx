import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ForgotPassword } from './ForgotPassword'
import * as api from '../lib/api'

vi.mock('../lib/api', () => ({
  startSecurityQuestionsRecovery: vi.fn(),
  resetPasswordViaSecurityQuestions: vi.fn(),
}))

describe('ForgotPassword', () => {
  it('lets the user go back from the new-password step to correct a rejected answer', async () => {
    vi.mocked(api.startSecurityQuestionsRecovery).mockResolvedValue({
      questions: [
        { questionId: 1, question: 'First pet?' },
        { questionId: 2, question: 'Birth city?' },
        { questionId: 3, question: 'First school?' },
      ],
    } as Awaited<ReturnType<typeof api.startSecurityQuestionsRecovery>>)
    vi.mocked(api.resetPasswordViaSecurityQuestions).mockRejectedValue(new Error('Incorrect answers.'))

    render(<ForgotPassword onBackToLogin={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('Enter your username'), { target: { value: 'sam' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    const answers = await screen.findAllByPlaceholderText('Your answer')
    answers.forEach((input, index) => fireEvent.change(input, { target: { value: `answer-${index}` } }))
    fireEvent.click(screen.getByRole('button', { name: 'Verify answers' }))

    const [password, confirm] = screen.getAllByPlaceholderText('••••••••')
    fireEvent.change(password, { target: { value: 'Correct-Horse-9' } })
    fireEvent.change(confirm, { target: { value: 'Correct-Horse-9' } })
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }))
    await screen.findByText('Incorrect answers.')

    fireEvent.click(screen.getByRole('button', { name: 'Change answers' }))

    await waitFor(() =>
      expect((screen.getAllByPlaceholderText('Your answer')[0] as HTMLInputElement).value).toBe('answer-0'))
    expect(screen.queryByText('Incorrect answers.')).toBeNull()
  })
})
