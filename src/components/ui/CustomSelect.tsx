import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption<T = string> {
  value: T;
  label: string;
  badge?: string;
  icon?: React.ReactNode;
}

export interface CustomSelectProps<T = string> {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

export function CustomSelect<T = string>({
  value,
  onChange,
  options,
  label,
  placeholder = 'اختر...',
  disabled = false,
  className = '',
  size = 'md'
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);
  const sizeClasses = size === 'sm' ? 'py-1.5 px-3 text-xs' : 'py-2.5 px-3.5 text-xs sm:text-sm';

  // Calculate dropdown position based on trigger rect
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const dropdownHeight = 240; // max-h-60 = 240px
    const spaceBelow = viewportHeight - rect.bottom;
    const openUpward = spaceBelow < dropdownHeight && rect.top > dropdownHeight;

    setDropdownStyle({
      position: 'fixed',
      left: rect.left,
      width: Math.max(rect.width, 180),
      zIndex: 9999,
      ...(openUpward
        ? { bottom: viewportHeight - rect.top + 6 }
        : { top: rect.bottom + 6 }),
    });
  }, []);

  const handleOpen = () => {
    if (disabled) return;
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen(prev => !prev);
  };

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        dropdownRef.current?.contains(e.target as Node)
      ) return;
      setIsOpen(false);
    };
    const handleScroll = () => { updatePosition(); };
    const handleResize = () => { updatePosition(); };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen, updatePosition]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  const dropdown = isOpen ? (
    <div
      ref={dropdownRef}
      style={dropdownStyle}
      className="p-1.5 rounded-2xl bg-white dark:bg-[#0c101d] border border-slate-200 dark:border-white/10 shadow-2xl shadow-black/20 dark:shadow-black/50 space-y-0.5 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-150"
    >
      {options.map(option => {
        const isSelected = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault(); // prevent blur before click
              onChange(option.value);
              setIsOpen(false);
            }}
            className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-medium transition-colors text-start ${
              isSelected
                ? 'bg-brand-500 text-white font-bold shadow-xs'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              {option.icon}
              <span>{option.label}</span>
              {option.badge && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-white/10 text-slate-500'}`}>
                  {option.badge}
                </span>
              )}
            </div>
            {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
          </button>
        );
      })}
    </div>
  ) : null;

  return (
    <div className={`space-y-1.5 text-start ${className}`}>
      {label && (
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={handleOpen}
        className={`w-full rounded-xl border border-slate-200 dark:border-white/10
                   bg-white dark:bg-[#0c101d] text-slate-900 dark:text-white
                   hover:border-brand-500/50 focus:outline-none focus:ring-2 focus:ring-brand-500/20
                   flex items-center justify-between gap-2 transition-all cursor-pointer shadow-xs
                   disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses}`}
      >
        <span className="flex items-center gap-2 truncate">
          {selectedOption?.icon}
          <span className={selectedOption ? 'font-medium' : 'text-slate-400'}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold">
              {selectedOption.badge}
            </span>
          )}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180 text-brand-500' : ''}`} />
      </button>

      {/* Render dropdown via Portal so it floats above everything */}
      {typeof document !== 'undefined' && createPortal(dropdown, document.body)}
    </div>
  );
}
