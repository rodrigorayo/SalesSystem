import { useState, useMemo } from 'react';
import { Eye, EyeOff, Check, X as XIcon } from 'lucide-react';

interface Props {
    value: string;
    onChange: (val: string) => void;
    confirmValue: string;
    onConfirmChange: (val: string) => void;
    label?: string;
    placeholder?: string;
    inputClassName?: string;
}

interface Rule {
    label: string;
    test: (pw: string) => boolean;
}

const RULES: Rule[] = [
    { label: 'Al menos 8 caracteres', test: pw => pw.length >= 8 },
    { label: 'Letra mayúscula (A-Z)', test: pw => /[A-Z]/.test(pw) },
    { label: 'Letra minúscula (a-z)', test: pw => /[a-z]/.test(pw) },
    { label: 'Número (0-9)', test: pw => /\d/.test(pw) },
    { label: 'Carácter especial (!@#$…)', test: pw => /[^A-Za-z0-9]/.test(pw) },
];

function getStrength(pw: string) {
    const passed = RULES.filter(r => r.test(pw)).length;
    if (passed <= 1) return { level: 0, label: 'Muy débil', color: 'bg-red-500', textColor: 'text-red-600' };
    if (passed === 2) return { level: 1, label: 'Débil', color: 'bg-orange-400', textColor: 'text-orange-600' };
    if (passed === 3) return { level: 2, label: 'Media', color: 'bg-yellow-400', textColor: 'text-yellow-600' };
    if (passed === 4) return { level: 3, label: 'Fuerte', color: 'bg-blue-500', textColor: 'text-blue-600' };
    return { level: 4, label: 'Muy fuerte', color: 'bg-green-500', textColor: 'text-green-600' };
}

export default function PasswordField({
    value, onChange, confirmValue, onConfirmChange,
    label = 'Contraseña',
    placeholder = 'Mínimo 8 caracteres',
    inputClassName = '',
}: Props) {
    const [showPw, setShowPw] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [touched, setTouched] = useState(false);

    const strength = useMemo(() => getStrength(value), [value]);
    const passwordsMatch = value === confirmValue;
    const confirmDirty = confirmValue.length > 0;

    const baseInput = `w-full border rounded-xl px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 pr-10 ${inputClassName}`;

    return (
        <div className="space-y-3">
            {/* Password field */}
            <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">{label}</label>
                <div className="relative">
                    <input
                        type={showPw ? 'text' : 'password'}
                        required
                        placeholder={placeholder}
                        className={`${baseInput} ${touched && value.length < 8 ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'}`}
                        value={value}
                        onChange={e => onChange(e.target.value)}
                        onBlur={() => setTouched(true)}
                    />
                    <button
                        type="button"
                        onClick={() => setShowPw(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        tabIndex={-1}
                    >
                        {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                </div>

                {/* Strength bar — only shown once user starts typing */}
                {value.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                        {/* Bar */}
                        <div className="flex gap-1">
                            {[0, 1, 2, 3, 4].map(i => (
                                <div
                                    key={i}
                                    className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= strength.level ? strength.color : 'bg-gray-200'}`}
                                />
                            ))}
                        </div>
                        <p className={`text-[11px] font-bold ${strength.textColor}`}>{strength.label}</p>

                        {/* Rules checklist */}
                        <div className="grid grid-cols-1 gap-0.5 pt-1">
                            {RULES.map(rule => {
                                const ok = rule.test(value);
                                return (
                                    <div key={rule.label} className={`flex items-center gap-1.5 text-[11px] ${ok ? 'text-green-600' : 'text-gray-400'}`}>
                                        {ok
                                            ? <Check size={11} className="shrink-0" />
                                            : <XIcon size={11} className="shrink-0" />}
                                        {rule.label}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Confirm password */}
            <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Confirmar contraseña</label>
                <div className="relative">
                    <input
                        type={showConfirm ? 'text' : 'password'}
                        required
                        placeholder="Repite la contraseña"
                        className={`${baseInput} ${confirmDirty && !passwordsMatch ? 'border-red-300 bg-red-50' : confirmDirty && passwordsMatch ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-gray-50'}`}
                        value={confirmValue}
                        onChange={e => onConfirmChange(e.target.value)}
                    />
                    <button
                        type="button"
                        onClick={() => setShowConfirm(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        tabIndex={-1}
                    >
                        {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                </div>
                {confirmDirty && !passwordsMatch && (
                    <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1">
                        <XIcon size={11} /> Las contraseñas no coinciden
                    </p>
                )}
                {confirmDirty && passwordsMatch && (
                    <p className="text-[11px] text-green-600 mt-1 flex items-center gap-1">
                        <Check size={11} /> Las contraseñas coinciden
                    </p>
                )}
            </div>
        </div>
    );
}
