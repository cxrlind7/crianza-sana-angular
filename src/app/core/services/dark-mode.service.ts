import { Injectable, effect, signal } from '@angular/core';

const STORAGE_KEY = 'theme-preference';

function getStoredPreference(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function prefersDarkSystem(): boolean {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyTheme(dark: boolean) {
  const root = document.documentElement;
  root.setAttribute('data-theme', dark ? 'dark' : 'light');
  root.setAttribute('data-bs-theme', dark ? 'dark' : 'light');
}

@Injectable({ providedIn: 'root' })
export class DarkModeService {
  readonly isDark = signal(this.resolveInitial());

  constructor() {
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!getStoredPreference()) {
          this.isDark.set(e.matches);
        }
      });
    }

    effect(() => {
      applyTheme(this.isDark());
    });
  }

  private resolveInitial(): boolean {
    const stored = getStoredPreference();
    return stored ? stored === 'dark' : prefersDarkSystem();
  }

  toggleDark(): void {
    this.setDark(!this.isDark());
  }

  setDark(value: boolean): void {
    this.isDark.set(value);
    try {
      localStorage.setItem(STORAGE_KEY, value ? 'dark' : 'light');
    } catch {
      /* localStorage unavailable (private mode, etc.) — theme still works for this session */
    }
  }
}
