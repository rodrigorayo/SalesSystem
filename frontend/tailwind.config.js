import animate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                indigo: {
                    50: 'color-mix(in srgb, var(--brand-color, #4f46e5) 10%, white)',
                    100: 'color-mix(in srgb, var(--brand-color, #4f46e5) 20%, white)',
                    200: 'color-mix(in srgb, var(--brand-color, #4f46e5) 40%, white)',
                    300: 'color-mix(in srgb, var(--brand-color, #4f46e5) 60%, white)',
                    400: 'color-mix(in srgb, var(--brand-color, #4f46e5) 80%, white)',
                    500: 'color-mix(in srgb, var(--brand-color, #4f46e5) 90%, white)',
                    600: 'var(--brand-color, #4f46e5)',
                    700: 'color-mix(in srgb, var(--brand-color, #4f46e5) 80%, black)',
                    800: 'color-mix(in srgb, var(--brand-color, #4f46e5) 60%, black)',
                    900: 'color-mix(in srgb, var(--brand-color, #4f46e5) 40%, black)',
                    950: 'color-mix(in srgb, var(--brand-color, #4f46e5) 20%, black)',
                }
            }
        },
    },
    plugins: [
        animate
    ],
}
