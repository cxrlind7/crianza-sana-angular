import { Component, inject } from '@angular/core';
import { DarkModeService } from '../../core/services/dark-mode.service';

@Component({
  selector: 'app-dark-mode-toggle',
  templateUrl: './dark-mode-toggle.html',
  styleUrl: './dark-mode-toggle.scss',
})
export class DarkModeToggle {
  private readonly darkMode = inject(DarkModeService);

  readonly isDark = this.darkMode.isDark;

  toggleDark(): void {
    this.darkMode.toggleDark();
  }
}
