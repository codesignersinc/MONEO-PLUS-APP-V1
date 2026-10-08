'use client';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';
import { POPULAR_SERVICES, type ServiceOption } from '@/lib/brands';

export type { ServiceOption };

interface Props {
  value: string;
  onChange: (service: { name: string; category: string; icon: string; color: string }) => void;
}

function ServiceLogo({ service, size = 36 }: { service: ServiceOption; size?: number }) {
  const [imgError, setImgError] = useState(false);

  if (service.logoUrl && !imgError) {
    return (
      <div
        className="flex items-center justify-center rounded-lg overflow-hidden flex-shrink-0"
        style={{ width: size, height: size, background: '#f3f4f6' }}
      >
        {/* Service logos come from arbitrary external domains; next/image would need each host configured. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={service.logoUrl}
          alt={service.name}
          width={size}
          height={size}
          className="object-contain p-1"
          style={{ width: size - 4, height: size - 4 }}
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  // Fallback: colored box with initial
  return (
    <div
      className="flex items-center justify-center rounded-lg flex-shrink-0 font-black text-white"
      style={{ width: size, height: size, background: service.color, fontSize: size * 0.4 }}
    >
      {service.name.charAt(0).toUpperCase()}
    </div>
  );
}

function CustomServiceLogo({ name, size = 36 }: { name: string; size?: number }) {
  const colors = ['#7C3AED', '#DC2626', '#059669', '#D97706', '#2563EB', '#DB2777', '#0891B2'];
  const colorIndex = name.charCodeAt(0) % colors.length;
  return (
    <div
      className="flex items-center justify-center rounded-lg flex-shrink-0 font-black text-white"
      style={{ width: size, height: size, background: colors[colorIndex], fontSize: size * 0.4 }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function SubscriptionServicePicker({ value, onChange }: Props) {
  const [query, setQuery] = useState(value || '');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ServiceOption | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value on edit
  useEffect(() => {
    if (value && value !== query) {
      setQuery(value);
      const found = POPULAR_SERVICES.find((s) => s.name.toLowerCase() === value.toLowerCase());
      if (found) setSelected(found);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        // If user typed something not in list, keep as custom
        if (query && !selected) {
          onChange({ name: query, category: 'Otro', icon: 'repeat', color: '#7C3AED' });
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [query, selected, onChange]);

  const filtered = useMemo(
    () =>
      query.trim().length === 0
        ? POPULAR_SERVICES
        : POPULAR_SERVICES.filter(
            (s) =>
              s.name.toLowerCase().includes(query.toLowerCase()) ||
              s.category.toLowerCase().includes(query.toLowerCase())
          ),
    [query]
  );

  const handleSelect = (service: ServiceOption) => {
    setSelected(service);
    setQuery(service.name);
    setOpen(false);
    onChange({
      name: service.name,
      category: service.category,
      icon: service.icon,
      color: service.color,
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setSelected(null);
    setOpen(true);
    if (!e.target.value) {
      onChange({ name: '', category: 'Entretenimiento', icon: 'film', color: '#7C3AED' });
    }
  };

  const handleClear = () => {
    setQuery('');
    setSelected(null);
    setOpen(false);
    onChange({ name: '', category: 'Entretenimiento', icon: 'film', color: '#7C3AED' });
    inputRef.current?.focus();
  };

  const handleCreateCustom = () => {
    if (!query.trim()) return;
    const colors = ['#7C3AED', '#DC2626', '#059669', '#D97706', '#2563EB', '#DB2777', '#0891B2'];
    const colorIndex = query.charCodeAt(0) % colors.length;
    setSelected({ name: query, category: 'Otro', icon: 'repeat', color: colors[colorIndex] });
    setOpen(false);
    onChange({ name: query, category: 'Otro', icon: 'repeat', color: colors[colorIndex] });
  };

  const showCreateOption = query.trim().length > 0 && filtered.length === 0;
  const showCreateSuggestion =
    query.trim().length > 0 &&
    !selected &&
    !POPULAR_SERVICES.find((s) => s.name.toLowerCase() === query.toLowerCase());

  return (
    <div ref={containerRef} className="relative">
      {/* Selected service preview */}
      {selected && (
        <div className="flex items-center gap-3 p-3 bg-white rounded-xl border-[2.5px] border-black mb-2">
          <ServiceLogo service={selected} size={40} />
          <div className="flex-1 min-w-0">
            <p className="font-black text-black text-sm">{selected.name}</p>
            <p className="text-xs text-gray-500 font-medium">{selected.category}</p>
          </div>
          <button onClick={handleClear} className="p-1 rounded-lg hover:bg-gray-100 transition-all">
            <X className="w-4 h-4 text-gray-500" strokeWidth={2.5} />
          </button>
        </div>
      )}

      {/* Search input */}
      <div
        className={`flex items-center gap-2 px-3 py-3 bg-white rounded-xl border-[2.5px] border-black focus-within:ring-2 focus-within:ring-[#FFD43B] transition-all cursor-text ${selected ? 'hidden' : ''}`}
        onClick={() => {
          setOpen(true);
          inputRef.current?.focus();
        }}
      >
        <Search className="w-4 h-4 text-gray-400 flex-shrink-0" strokeWidth={2} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          placeholder="Buscar Netflix, Spotify, ChatGPT..."
          className="flex-1 min-w-0 bg-transparent text-[16px] font-bold text-[#111] placeholder-gray-400 outline-none"
        />
        <ChevronDown
          className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          strokeWidth={2}
        />
      </div>

      {/* Dropdown */}
      {open && !selected && (
        <div className="absolute z-50 w-full mt-1 bg-white rounded-2xl border-[2.5px] border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] overflow-hidden max-h-64 overflow-y-auto">
          {filtered.length > 0 ? (
            <>
              {filtered.map((service) => (
                <button
                  key={service.name}
                  type="button"
                  onClick={() => handleSelect(service)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#FFF9DB] transition-colors text-left"
                >
                  <ServiceLogo service={service} size={36} />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-black text-sm truncate">{service.name}</p>
                    <p className="text-xs text-gray-500 truncate">{service.category}</p>
                  </div>
                </button>
              ))}
              {showCreateSuggestion && (
                <button
                  type="button"
                  onClick={handleCreateCustom}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#FFF9DB] transition-colors text-left border-t border-gray-100"
                >
                  <CustomServiceLogo name={query} size={36} />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-black text-sm truncate">
                      Crear &ldquo;{query}&rdquo;
                    </p>
                    <p className="text-xs text-gray-500">Servicio personalizado</p>
                  </div>
                </button>
              )}
            </>
          ) : showCreateOption ? (
            <button
              type="button"
              onClick={handleCreateCustom}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#FFF9DB] transition-colors text-left"
            >
              <CustomServiceLogo name={query} size={36} />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-black text-sm truncate">Crear &ldquo;{query}&rdquo;</p>
                <p className="text-xs text-gray-500">
                  No encontrado — se creará con logo personalizado
                </p>
              </div>
            </button>
          ) : (
            <div className="px-4 py-3 text-sm text-gray-400 font-medium">Sin resultados</div>
          )}
        </div>
      )}
    </div>
  );
}
