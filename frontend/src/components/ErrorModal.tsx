/**
 * ErrorModal — Modal visual premium para errores críticos del servidor (HTTP 500/503).
 *
 * A diferencia de un toast (que desaparece), este modal requiere una acción
 * explícita del usuario porque el error es del sistema, no de él.
 *
 * Uso:
 *   import { useErrorModal } from './ErrorModal';
 *   const { showError } = useErrorModal();
 *   showError("Mensaje de error", { retryFn: () => refetch() });
 */
import React, { createContext, useContext, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ErrorOptions {
  retryFn?: () => void;
  retryLabel?: string;
}

interface ErrorModalState {
  visible: boolean;
  message: string;
  statusCode?: number;
  options?: ErrorOptions;
}

interface ErrorModalContextType {
  showError: (message: string, options?: ErrorOptions & { statusCode?: number }) => void;
  hideError: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ErrorModalContext = createContext<ErrorModalContextType>({
  showError: () => {},
  hideError: () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ErrorModalProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ErrorModalState>({ visible: false, message: '' });

  const showError = useCallback((
    message: string,
    options?: ErrorOptions & { statusCode?: number }
  ) => {
    setState({ visible: true, message, statusCode: options?.statusCode, options });
  }, []);

  const hideError = useCallback(() => {
    setState({ visible: false, message: '' });
  }, []);

  return (
    <ErrorModalContext.Provider value={{ showError, hideError }}>
      {children}
      {state.visible && (
        <ErrorModalUI
          message={state.message}
          statusCode={state.statusCode}
          options={state.options}
          onClose={hideError}
        />
      )}
    </ErrorModalContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useErrorModal() {
  return useContext(ErrorModalContext);
}

// ─── UI Component ─────────────────────────────────────────────────────────────

function ErrorModalUI({
  message,
  statusCode,
  options,
  onClose,
}: {
  message: string;
  statusCode?: number;
  options?: ErrorOptions;
  onClose: () => void;
}) {
  const isTransient = statusCode === 503;

  const title = isTransient
    ? '⏳ Sistema ocupado'
    : '⚠️  Error del servidor';

  const subtitle = isTransient
    ? 'El sistema estaba procesando otra operación al mismo tiempo.'
    : 'Ocurrió un problema en el servidor. Tu acción NO fue completada.';

  const hint = isTransient
    ? '¿Qué hacer? Esperá 2 segundos y volvé a intentarlo con el botón de abajo.'
    : '¿Qué hacer? Si el problema persiste, tomá una captura de pantalla y contactá al soporte técnico.';

  const handleRetry = () => {
    onClose();
    options?.retryFn?.();
  };

  return (
    // Backdrop
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
        animation: 'fadeIn 0.18s ease',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Card */}
      <div style={{
        background: '#fff',
        borderRadius: '1.25rem',
        boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
        maxWidth: '420px', width: '100%',
        overflow: 'hidden',
        animation: 'slideUp 0.22s ease',
      }}>
        {/* Color header bar */}
        <div style={{
          background: isTransient
            ? 'linear-gradient(135deg, #f59e0b, #f97316)'
            : 'linear-gradient(135deg, #ef4444, #b91c1c)',
          padding: '1.5rem',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '2.8rem', marginBottom: '0.5rem' }}>
            {isTransient ? '⏳' : '🚨'}
          </div>
          <h2 style={{
            color: '#fff', fontWeight: 700, fontSize: '1.2rem', margin: 0,
          }}>
            {title}
          </h2>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem' }}>
          <p style={{
            color: '#374151', fontSize: '0.95rem',
            fontWeight: 500, marginBottom: '0.75rem', textAlign: 'center',
          }}>
            {subtitle}
          </p>

          {/* Error message box */}
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '0.75rem',
            padding: '0.875rem 1rem',
            marginBottom: '1rem',
          }}>
            <p style={{
              color: '#991b1b', fontSize: '0.875rem',
              margin: 0, lineHeight: 1.6, fontFamily: 'inherit',
            }}>
              {message}
            </p>
          </div>

          {/* Hint */}
          <div style={{
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: '0.75rem',
            padding: '0.75rem 1rem',
            marginBottom: '1.25rem',
            display: 'flex', gap: '0.5rem', alignItems: 'flex-start',
          }}>
            <span style={{ fontSize: '1rem', flexShrink: 0 }}>💡</span>
            <p style={{
              color: '#78350f', fontSize: '0.825rem',
              margin: 0, lineHeight: 1.5,
            }}>
              {hint}
            </p>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={onClose}
              style={{
                flex: 1, padding: '0.75rem',
                borderRadius: '0.75rem', border: '1.5px solid #e5e7eb',
                background: '#f9fafb', color: '#374151',
                fontWeight: 600, fontSize: '0.9rem',
                cursor: 'pointer', transition: 'background 0.15s',
              }}
              onMouseOver={e => (e.currentTarget.style.background = '#f3f4f6')}
              onMouseOut={e => (e.currentTarget.style.background = '#f9fafb')}
            >
              Entendido
            </button>

            {options?.retryFn && (
              <button
                onClick={handleRetry}
                style={{
                  flex: 1, padding: '0.75rem',
                  borderRadius: '0.75rem', border: 'none',
                  background: isTransient
                    ? 'linear-gradient(135deg, #f59e0b, #f97316)'
                    : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                  color: '#fff', fontWeight: 700, fontSize: '0.9rem',
                  cursor: 'pointer', transition: 'opacity 0.15s',
                }}
                onMouseOver={e => (e.currentTarget.style.opacity = '0.85')}
                onMouseOut={e => (e.currentTarget.style.opacity = '1')}
              >
                {options.retryLabel ?? '🔄 Reintentar'}
              </button>
            )}
          </div>
        </div>

        {/* Code badge */}
        {statusCode && (
          <div style={{
            textAlign: 'center', paddingBottom: '1rem',
            color: '#9ca3af', fontSize: '0.75rem',
          }}>
            Código de error: {statusCode}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { transform: translateY(24px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `}</style>
    </div>
  );
}
