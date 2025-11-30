import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { User } from '../../../iam/domain/models/user.model';
import { CommonModule } from '@angular/common';
import {AuthService} from '../../../iam/application/services/auth.service';

@Component({
  selector: 'app-page-not-found',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './page-not-found.component.html',
  styleUrls: ['./page-not-found.component.css']
})
export class PageNotFoundComponent implements OnInit {
  currentUser: User | null = null;
  redirectingMessage: string = '';
  countDown: number = 5;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Verificar si estamos en proceso de autenticación con Auth0
    const authMethod = localStorage.getItem('auth_method');
    const currentPath = window.location.pathname;
    
    // Si estamos en callback o hay un proceso de Auth0 activo, esperar más tiempo
    if (currentPath.includes('/callback') || authMethod === 'auth0') {
      console.log('Proceso de Auth0 detectado, esperando más tiempo...');
      setTimeout(() => {
        this.checkUserAndRedirect();
      }, 2000); // Esperar 2 segundos para Auth0
      return;
    }
    
    // Para login tradicional, proceder normalmente
    this.checkUserAndRedirect();
  }

  private checkUserAndRedirect(): void {
    // Subscribe to current user
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;

      // Si no hay usuario cargado, intentar cargar desde localStorage
      if (!user) {
        this.loadUserFromStorage();
      }

      // Dar un poco de tiempo para que se cargue la información del usuario
      setTimeout(() => {
        this.determineRedirect();
      }, 500);
    });
  }

  private loadUserFromStorage(): void {
    try {
      // Intentar cargar de diferentes fuentes
      const storedUser = localStorage.getItem('auth_user') || localStorage.getItem('USER_KEY');
      const authMethod = localStorage.getItem('auth_method');
      
      if (storedUser) {
        this.currentUser = JSON.parse(storedUser);
        console.log('Usuario cargado desde localStorage:', this.currentUser);
        console.log('Método de autenticación:', authMethod);
      } else {
        console.log('No se encontró usuario en localStorage');
        console.log('auth_user:', localStorage.getItem('auth_user'));
        console.log('auth_method:', authMethod);
      }
    } catch (error) {
      console.error('Error al cargar usuario desde localStorage:', error);
    }
  }

  private determineRedirect(): void {
    console.log('=== DETERMINE REDIRECT DEBUG ===');
    console.log('Current user:', this.currentUser);
    console.log('Is admin?', this.isAdmin());

    let redirectPath: string;

    if (!this.currentUser) {
      // Usuario no autenticado - enviar al login
      redirectPath = '/login';
      this.redirectingMessage = 'Redirigiendo al inicio de sesión';
      console.log('Usuario no autenticado - enviando a login');
    } else if (this.isAdmin()) {
      // Administrador - enviar al admin-dashboard admin
      redirectPath = '/admin/admin-dashboard';
      this.redirectingMessage = 'Redirigiendo al panel de administración';
      console.log('Usuario admin detectado - enviando a admin admin-dashboard');
    } else {
      // Proveedor u otro usuario autenticado - enviar a home
      redirectPath = '/home';
      this.redirectingMessage = 'Redirigiendo a la página principal';
      console.log('Usuario provider - enviando a home');
    }

    console.log('Redirect path:', redirectPath);
    console.log('=== END DETERMINE REDIRECT DEBUG ===');

    this.startCountdown(redirectPath);
  }

  private isAdmin(): boolean {
    // Múltiples métodos para verificar si el usuario es administrador
    if (!this.currentUser) return false;

    // 1. Verificar si el username es exactamente "admin" (como en home.component.ts)
    if (this.currentUser.username === "admin") {
      return true;
    }

    // 2. Verificar por roles en el objeto user
    if (this.currentUser.roles?.toLowerCase().includes('admin')) {
      return true;
    }

    // 3. Verificar por username que contenga admin
    if (this.currentUser.username?.toLowerCase().includes('admin')) {
      return true;
    }

    // 4. Verificar en localStorage por si el rol se guarda separadamente
    const storedRoles = localStorage.getItem('user_roles') || localStorage.getItem('roles');
    if (storedRoles?.toLowerCase().includes('admin')) {
      return true;
    }

    // 5. Verificar la URL actual - si ya está en admin admin-dashboard, es admin
    if (window.location.pathname.includes('/admin')) {
      return true;
    }

    // 6. Verificar específicamente en localStorage como lo hace home.component.ts
    const storedUser = localStorage.getItem('auth_user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        if (user?.username === "admin") {
          return true;
        }
      } catch (error) {
        console.error('Error parsing user from localStorage:', error);
      }
    }

    console.log('Admin check details:', {
      userRoles: this.currentUser.roles,
      username: this.currentUser.username,
      storedRoles: storedRoles,
      currentPath: window.location.pathname,
      currentUser: this.currentUser
    });

    return false;
  }

  // Hacer el método público para que esté disponible en el template
  public isAdminUser(): boolean {
    return this.isAdmin();
  }

  private startCountdown(redirectPath: string): void {
    const interval = setInterval(() => {
      this.countDown--;
      if (this.countDown <= 0) {
        clearInterval(interval);
        this.router.navigate([redirectPath]);
      }
    }, 1000);
  }

  goToRedirect(): void {
    if (!this.currentUser) {
      this.router.navigate(['/login']);
    } else if (this.isAdmin()) {
      this.router.navigate(['/admin/dashboard']);
    } else {
      this.router.navigate(['/home']);
    }
  }

  // Método mantenido por compatibilidad, pero ya no se usa en el template
  /*
  goToHome(): void {
    if (!this.currentUser) {
      this.router.navigate(['/login']);
    } else if (this.isAdmin()) {
      // Si es admin, llevarlo al admin-dashboard, no a home
      this.router.navigate(['/admin/admin-dashboard']);
    } else {
      this.router.navigate(['/home']);
    }
  }
  */
}
