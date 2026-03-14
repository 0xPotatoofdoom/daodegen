'use client'

import { LoadingSpinner } from './LoadingSpinner'

interface LoadingButtonProps {
  children: React.ReactNode
  isLoading?: boolean
  className?: string
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  loadingText?: string
}

export function LoadingButton({
  children,
  isLoading = false,
  className = '',
  onClick,
  disabled = false,
  type = 'button',
  loadingText = 'Loading...'
}: LoadingButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`
        flex items-center justify-center gap-2 min-h-[44px] px-4 py-2
        transition-all duration-200
        ${isLoading || disabled ? 'opacity-70 cursor-not-allowed' : 'hover:opacity-90'}
        ${className}
      `}
    >
      {isLoading && <LoadingSpinner size="sm" />}
      <span>{isLoading ? loadingText : children}</span>
    </button>
  )
}

interface AsyncButtonProps extends LoadingButtonProps {
  onAsyncClick?: () => Promise<void>
}

export function AsyncButton({ onAsyncClick, ...props }: AsyncButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  
  const handleClick = async () => {
    if (!onAsyncClick || isLoading) return
    
    setIsLoading(true)
    try {
      await onAsyncClick()
    } catch (error) {
      console.error('Async button error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return <LoadingButton {...props} isLoading={isLoading} onClick={handleClick} />
}

// React import for useState
import { useState } from 'react'