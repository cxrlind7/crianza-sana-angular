import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DarkModeToggle } from '../../shared/dark-mode-toggle/dark-mode-toggle';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-nav-bar',
  imports: [RouterLink, RouterLinkActive, DarkModeToggle],
  templateUrl: './nav-bar.html',
  styleUrl: './nav-bar.scss',
})
export class NavBar implements OnInit {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  readonly currentUser = this.authService.currentUser;
  readonly isAdmin = computed(() => {
    const email = this.currentUser()?.email;
    return !!email && environment.adminEmails.includes(email);
  });

  readonly isMenuOpen = signal(false);
  readonly isScrolled = signal(false);
  readonly showUserMenu = signal(false);

  readonly links = [
    { name: 'Inicio', path: '/' },
    { name: '¿Quiénes somos?', path: '/about' },
    { name: 'Blog', path: '/blog' },
    { name: 'Galería', path: '/gallery' },
  ];

  ngOnInit(): void {
    this.isScrolled.set(window.scrollY > 50);
  }

  @HostListener('window:scroll')
  handleScroll(): void {
    this.isScrolled.set(window.scrollY > 50);
  }

  toggleMenu(): void {
    this.isMenuOpen.update((open) => !open);
    document.body.style.overflow = this.isMenuOpen() ? 'hidden' : '';
  }

  closeMenu(): void {
    this.isMenuOpen.set(false);
    document.body.style.overflow = '';
    this.showUserMenu.set(false);
  }

  toggleUserMenu(): void {
    this.showUserMenu.update((open) => !open);
  }

  async handleSignOut(): Promise<void> {
    try {
      await this.authService.logout();
      this.closeMenu();
      this.router.navigate(['/']);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }

  goToLogin(): void {
    this.closeMenu();
    this.router.navigate(['/login']);
  }
}
