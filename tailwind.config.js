/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx,css}'],
  theme: {
    fontFamily: {
      sans: [
        'Inter',
        '-apple-system',
        'BlinkMacSystemFont',
        'Segoe UI',
        'Roboto',
        'Oxygen-Sans',
        'Ubuntu',
        'Cantarell',
        'Helvetica Neue',
        'PingFang SC',
        'Microsoft YaHei',
        'sans-serif',
      ],
      mono: [
        'JetBrains Mono',
        'SFMono-Regular',
        'Consolas',
        'Liberation Mono',
        'Menlo',
        'monospace',
      ],
    },
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        surface: 'hsl(var(--surface))',
        'surface-raised': 'hsl(var(--surface-raised))',
        foreground: 'hsl(var(--foreground))',
        muted: 'hsl(var(--muted))',
        subtle: 'hsl(var(--subtle))',
        accent: 'hsl(var(--accent))',
        'accent-2': 'hsl(var(--accent-2))',
        'accent-foreground': 'hsl(var(--accent-foreground))',
        line: 'hsl(var(--line) / 0.16)',
        paper: 'hsl(var(--paper))',
      },
      borderRadius: {
        card: '0.75rem',
        panel: '1rem',
      },
    },
  },
  plugins: [],
};
