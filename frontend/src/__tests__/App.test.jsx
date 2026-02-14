import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import App from '../App'

// Mock Supabase
vi.mock('../lib/supabase', () => ({
    supabase: {
        auth: {
            getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
            onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
        },
        from: vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
                }))
            }))
        }))
    }
}))

// Mock lazy components to avoid import issues during test
vi.mock('../pages/Auth', () => ({ default: () => <div>Auth Page</div> }))
vi.mock('../pages/Dashboard', () => ({ default: () => <div>Dashboard Page</div> }))
// ... mock others if needed

describe('App Component', () => {
    it('renders without crashing', () => {
        render(<App />)
        // Initially access control might redirect or show loading
        expect(document.body).toBeTruthy()
    })
})
