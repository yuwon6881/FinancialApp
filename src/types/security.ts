export interface QuestionAnswerDto {
  questionId: number
  answer: string
}

export interface SecurityQuestion {
  questionId: number
  question: string
}

export interface SecurityQuestionsRecoveryStartResponse {
  username: string
  questions: SecurityQuestion[]
}
