import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService as Auth0Service } from '@auth0/auth0-angular';

@Component({
    selector: 'app-login',
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.scss'],
    standalone: true,
    imports: [CommonModule]
})
export class LoginComponent {
    // Auth0 service
    auth0 = inject(Auth0Service);
    
    // Check if user is already authenticated with Auth0
    isAuth0Authenticated$ = this.auth0.isAuthenticated$;
    auth0User$ = this.auth0.user$;
    
    constructor(
        private router: Router
    ) { }

    onSignup(): void {
        this.router.navigate(['/signup']);
    }

    // Login with Auth0
    loginWithAuth0(): void {
        this.auth0.loginWithRedirect({
            appState: {
                target: '/home'
            },
            authorizationParams: {
                prompt: 'login' // Fuerza a mostrar la pantalla de login siempre
            }
        });
    }

    // Logout from Auth0
    logoutAuth0(): void {
        this.auth0.logout({
            logoutParams: {
                returnTo: window.location.origin + '/login'
            }
        });
    }
}
