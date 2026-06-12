import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HelpCircle, AlertCircle, Info } from 'lucide-react';

export interface ConfirmOptions {
  title: string;
  message: string;
  type?: 'danger' | 'warning' | 'info';
  confirmLabel?: string;
  cancelLabel?: string;
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{
    visible: boolean;
    options: ConfirmOptions | null;
  }>({
    visible: false,
    options: null,
  });

  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    setState({
      visible: true,
      options,
    });
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const handleClose = useCallback((value: boolean) => {
    setState({ visible: false, options: null });
    if (resolverRef.current) {
      resolverRef.current(value);
      resolverRef.current = null;
    }
  }, []);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <AnimatePresence>
        {state.visible && state.options && (
          <ConfirmDialog
            options={state.options}
            onClose={handleClose}
          />
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context.confirm;
}

function ConfirmDialog({
  options,
  onClose,
}: {
  options: ConfirmOptions;
  onClose: (value: boolean) => void;
}) {
  const { title, message, type = 'warning', confirmLabel = 'Confirmar', cancelLabel = 'Cancelar' } = options;

  let Icon = HelpCircle;
  let iconColor = 'text-amber-600 bg-amber-50 border-amber-100';
  let confirmBtnBg = 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500';

  if (type === 'danger') {
    Icon = AlertCircle;
    iconColor = 'text-red-600 bg-red-50 border-red-100/50';
    confirmBtnBg = 'bg-red-600 hover:bg-red-700 focus:ring-red-500';
  } else if (type === 'info') {
    Icon = Info;
    iconColor = 'text-blue-600 bg-blue-50 border-blue-100';
    confirmBtnBg = 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500';
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => onClose(false)}
        className="fixed inset-0 bg-black/60 backdrop-blur-xs"
      />

      {/* Modal Content */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className="bg-white rounded-2xl w-full max-w-sm overflow-hidden flex flex-col p-6 shadow-2xl relative z-10 border border-gray-100"
      >
        <div className="flex justify-center mb-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center border-4 ${iconColor}`}>
            <Icon size={24} />
          </div>
        </div>
        
        <h3 className="text-lg font-black text-gray-900 text-center mb-2 tracking-tight">
          {title}
        </h3>
        
        <p className="text-sm text-gray-500 text-center mb-6 leading-relaxed">
          {message}
        </p>

        <div className="flex gap-3 w-full">
          <button
            onClick={() => onClose(false)}
            className="flex-1 py-2.5 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer text-sm"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => onClose(true)}
            className={`flex-1 py-2.5 rounded-xl font-bold text-white transition-colors shadow-sm cursor-pointer text-sm ${confirmBtnBg}`}
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
