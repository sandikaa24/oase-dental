import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0F766E',
          hover: '#115E59',
          soft: '#CCFBF1',
        },
        accent: '#14B8A6',
        background: '#F8FAFC',
        surface: '#FFFFFF',
        foreground: '#0F172A',
        muted: '#64748B',
        border: '#E2E8F0',
        success: {
          bg: '#DCFCE7',
          text: '#166534',
          icon: '#16A34A',
        },
        warning: {
          bg: '#FEF3C7',
          text: '#92400E',
          icon: '#D97706',
        },
        danger: {
          bg: '#FEE2E2',
          text: '#991B1B',
          icon: '#DC2626',
          solid: '#DC2626',
        },
        info: {
          bg: '#DBEAFE',
          text: '#1E40AF',
          icon: '#2563EB',
        },
        role: {
          owner: { bg: '#F3E8FF', text: '#7E22CE' },
          manager: { bg: '#DBEAFE', text: '#1D4ED8' },
          cashier: { bg: '#CCFBF1', text: '#0F766E' },
          employee: { bg: '#F1F5F9', text: '#475569' },
        },
        'branch-indicator': {
          bg: '#F0FDFA',
          text: '#0F766E',
          border: '#CCFBF1',
        },
      },
      borderRadius: {
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
    },
  },
  plugins: [],
};

export default config;
