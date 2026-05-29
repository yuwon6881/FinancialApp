import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

interface SelectOption {
  value: string | number
  label: string
}

interface CustomSelectProps {
  value: string | number
  onChange: (value: any) => void
  options: SelectOption[]
  className?: string
  align?: 'left' | 'right'
}

export const CustomSelect: React.FC<CustomSelectProps> = ({ 
  value, 
  onChange, 
  options, 
  className = '',
  align = 'left'
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find(opt => opt.value === value)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2.5 px-3.5 py-1.5 text-xs bg-background border border-border rounded-xl text-foreground font-semibold shadow-xs hover:bg-muted/30 transition duration-150 cursor-pointer text-left select-none"
      >
        <span className="truncate">{selectedOption?.label || value}</span>
        <ChevronDown className={`size-3.5 text-muted-foreground/80 transition duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-1.5 min-w-[180px] w-max max-w-[280px] bg-card border border-border rounded-xl shadow-lg p-1 z-50 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-100 flex flex-col gap-0.5`}>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value)
                setIsOpen(false)
              }}
              className={`w-full text-left px-3.5 py-1.5 text-xs rounded-lg transition duration-100 cursor-pointer ${
                opt.value === value
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'hover:bg-muted text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
