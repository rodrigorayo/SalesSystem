import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, User } from 'lucide-react';
import { preguntarIA } from '../api/api';

interface Message {
  id: string;
  type: 'user' | 'bot';
  text: string;
  isError?: boolean;
}

export default function ChatbotAnalitico() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      type: 'bot',
      text: '¡Hola! Soy el Asistente Analítico de Chocolates Taboada. He analizado los 46k registros históricos. ¿Qué deseas saber sobre las ventas?'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    setInput('');
    
    // Add user message
    const userMsg: Message = { id: Date.now().toString(), type: 'user', text: userText };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await preguntarIA(userText);
      
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        text: res.respuesta
      }]);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        text: 'Lo siento, el Módulo de Analítica AI está en mantenimiento o hubo un error al procesar tu solicitud.',
        isError: true
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Botón Flotante */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 p-4 rounded-full shadow-2xl transition-all z-50 hover:scale-105 active:scale-95 ${isOpen ? 'opacity-0 pointer-events-none scale-75' : 'opacity-100 bg-amber-500 text-white'}`}
      >
        <MessageSquare size={28} />
      </button>

      {/* Ventana de Chat */}
      <div 
        className={`fixed bottom-6 right-6 w-96 sm:w-[400px] h-[550px] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 transform origin-bottom-right z-50 border border-gray-100 ${isOpen ? 'scale-100 opacity-100' : 'scale-50 opacity-0 pointer-events-none'}`}
      >
        {/* Cabecera */}
        <div className="bg-amber-500 p-4 flex items-center justify-between text-white shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-xl">
              <Bot size={24} className="text-white" />
            </div>
            <div>
              <h3 className="font-black text-lg leading-tight">Asistente Taboada AI</h3>
              <p className="text-xs text-amber-100 font-medium flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Ventas Históricas Analizadas
              </p>
            </div>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex items-end gap-2 ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.type === 'bot' && (
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                  <Bot size={16} className="text-amber-600" />
                </div>
              )}
              
              <div 
                className={`max-w-[80%] rounded-2xl p-3 text-sm shadow-sm ${
                  msg.type === 'user' 
                    ? 'bg-amber-500 text-white rounded-br-none' 
                    : msg.isError 
                      ? 'bg-red-50 text-red-600 border border-red-100 rounded-bl-none'
                      : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'
                }`}
              >
                {/* Renderizar markdown simple si es necesario, o solo texto */}
                <span className="whitespace-pre-wrap leading-relaxed">{msg.text}</span>
              </div>

              {msg.type === 'user' && (
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
                  <User size={16} className="text-white" />
                </div>
              )}
            </div>
          ))}
          
          {isLoading && (
            <div className="flex items-end gap-2 justify-start">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <Bot size={16} className="text-amber-600" />
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-none p-4 shadow-sm flex gap-1 items-center">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{animationDelay: '150ms'}} />
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{animationDelay: '300ms'}} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-4 bg-white border-t border-gray-100 shrink-0">
          <div className="relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ej: ¿Cuál fue el mes de mayor venta histórica?"
              className="w-full bg-gray-50 border border-gray-200 rounded-full pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium text-gray-700 placeholder-gray-400"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-2 p-2 bg-amber-500 text-white rounded-full hover:bg-amber-600 disabled:opacity-50 disabled:hover:bg-amber-500 transition-colors"
            >
              <Send size={16} />
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
