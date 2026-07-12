import { setupServer } from 'msw/node'
import { handlers } from './backend'

export const server = setupServer(...handlers)
