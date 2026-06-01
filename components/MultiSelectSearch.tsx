'use client';

import { useState, useRef, useEffect } from 'react';

interface Option {
  id?: string;
  label: string;
}

interface MultiSelectSearchProps {
  options: Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  allowCustom?: boolean;
  label?: string;
  required?: boolean;
}

export default function MultiSelectSearch({
  options,
  selected,
  onChange,
  placeholder = 'Search and select...',
  allowCustom = false,
  label,
  required = false,
}: MultiSelectSearchProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (optionId: string) => {
    if (selected.includes(optionId)) {
      onChange(selected.filter(id => id !== optionId));
    } else {
      onChange([...selected, optionId]);
    }
  };

  const handleAddCustom = () => {
    if (customInput.trim()) {
      onChange([...selected, customInput.trim()]);
      setCustomInput('');
      setSearch('');
    }
  };

  const handleRemove = (item: string) => {
    onChange(selected.filter(id => id !== item));
  };

  const getDisplayLabel = (id: string): string => {
    const option = options.find(opt => opt.id === id);
    return option ? option.label : id;
  };

  return (
    <div ref={containerRef} className="w-full">
      {label && (
        <label className="block text-sm font-medium mb-1">
          {label}
          {required && <span className="text-red-500">*</span>}
        </label>
      )}

      {/* Selected items as chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selected.map(item => (
            <div
              key={item}
              className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
            >
              <span>{getDisplayLabel(item)}</span>
              <button
                type="button"
                onClick={() => handleRemove(item)}
                className="text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search input and dropdown */}
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
        />

        {/* Dropdown menu */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(option => (
                <label
                  key={option.id}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(option.id || option.label)}
                    onChange={() => handleSelect(option.id || option.label)}
                    className="rounded"
                  />
                  <span className="text-sm">{option.label}</span>
                </label>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-gray-500">No results found</div>
            )}

            {/* Add custom option */}
            {allowCustom && (
              <div className="border-t border-gray-100 p-2 space-y-2">
                <input
                  type="text"
                  value={customInput}
                  onChange={e => setCustomInput(e.target.value)}
                  placeholder="Add new..."
                  className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                  onKeyPress={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustom();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddCustom}
                  disabled={!customInput.trim()}
                  className="w-full px-2 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
