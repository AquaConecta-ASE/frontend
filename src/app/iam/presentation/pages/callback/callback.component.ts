import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, filter, of, switchMap, take, timeout, tap, map } from 'rxjs';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-callback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="callback-container">
      <div class="callback-card">
        <div class="spinner"></div>
        <h2>{{ title }}</h2>
        <p>{{ message }}</p>
        @if (error) {
          <div class="error-message">
            <p>{{ error }}</p>
            <button (click)="retry()" class="retry-button">Retry</button>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .callback-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: #2196f3;
      padding: 1rem;
    }

    .callback-card {
      background: white;
      border-radius: 12px;
      padding: 3rem 2rem;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
      text-align: center;
      max-width: 400px;
      width: 100%;
    }

    .spinner {
      border: 4px solid #f3f3f3;
      border-top: 4px solid #635dff;
      border-radius: 50%;
      width: 50px;
      height: 50px;
      animation: spin 1s linear infinite;
      margin: 0 auto 1.5rem;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    h2 {
      color: #333;
      font-size: 1.5rem;
      margin-bottom: 0.5rem;
    }

    p {
      color: #666;
      font-size: 1rem;
      margin-bottom: 1rem;
    }

    .error-message {
      background: #fee;
      border: 1px solid #fcc;
      border-radius: 8px;
      padding: 1rem;
      margin-top: 1rem;
    }

    .error-message p {
      color: #c33;
      margin-bottom: 1rem;
    }

    .retry-button {
      background: #635dff;
      color: white;
      border: none;
      border-radius: 6px;
      padding: 0.75rem 1.5rem;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .retry-button:hover {
      background: #7b75ff;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(99, 93, 255, 0.3);
    }
  `]
})
export class CallbackComponent implements OnInit {
  private auth0 = inject(AuthService);
  private router = inject(Router);
  private http = inject(HttpClient);

  title = 'Processing Login...';
  message = 'Please wait while we complete your authentication.';
  error = '';

  ngOnInit(): void {
    this.handleAuth0Callback();
  }

  private handleAuth0Callback(): void {
    console.log('=== INICIO AUTH0 CALLBACK ===');
    
    this.auth0.isAuthenticated$.pipe(
      filter(isAuthenticated => isAuthenticated !== null),
      take(1),
      timeout(10000),
      switchMap(isAuthenticated => {
        if (isAuthenticated) {
          console.log('Usuario autenticado con Auth0');
          
          // Obtener el token de acceso
          return this.auth0.getAccessTokenSilently().pipe(
            take(1),
            tap(token => {
              console.log('=== TOKEN DEBUG ===');
              console.log('Token obtenido:', token ? 'Sí' : 'No');
              if (token) {
                console.log('Token length:', token.length);
                console.log('Token preview:', token.substring(0, 50) + '...');
                localStorage.setItem('auth_token', token);
                localStorage.setItem('auth_method', 'auth0');
                console.log('Token guardado en localStorage con key: auth_token');
                
                // Verificar que se guardó correctamente
                const savedToken = localStorage.getItem('auth_token');
                console.log('Verificación - Token en localStorage:', savedToken ? 'Sí' : 'No');
              }
              console.log('=== FIN TOKEN DEBUG ===');
            }),
            switchMap(token => {
              // Obtener información del usuario de Auth0
              return this.auth0.user$.pipe(
                take(1),
                switchMap(user => {
                  if (user) {
                    console.log('Usuario Auth0:', user);
                    
                    // Extraer roles del custom claim de Auth0
                    const namespace = 'https://aquaconecta.com';
                    const roles = user[`${namespace}/roles`] || [];
                    const userEmail = user[`${namespace}/email`] || user.email;
                    const userNickname = user[`${namespace}/nickname`] || user.nickname;
                    const userMetadata = user[`${namespace}/user_metadata`] || {};
                    
                    console.log('Roles extraídos:', roles);
                    console.log('Email:', userEmail);
                    console.log('Nickname:', userNickname);
                    console.log('User metadata:', userMetadata);
                    
                    // Determinar el rol principal
                    let userRole = 'provider'; // Por defecto
                    if (roles && roles.length > 0) {
                      // Verificar si tiene rol de admin
                      if (roles.includes('admin') || roles.includes('ROLE_ADMIN') || roles.includes('Administrator')) {
                        userRole = 'admin';
                      } else if (roles.includes('provider') || roles.includes('ROLE_PROVIDER')) {
                        userRole = 'provider';
                      } else {
                        userRole = roles[0]; // Usar el primer rol disponible
                      }
                    }
                    
                    console.log('Rol asignado:', userRole);
                    
                    // Almacenar información completa del usuario
                    const authUser = {
                      id: user.sub || '',
                      email: userEmail || '',
                      username: userEmail || user.name || '',
                      name: user.name || '',
                      picture: user.picture || '',
                      auth0Id: user.sub || '',
                      nickname: userNickname || '',
                      emailVerified: user.email_verified || false,
                      roles: roles, // Array de roles
                      role: userRole, // Rol principal
                      metadata: userMetadata
                    };
                    
                    localStorage.setItem('auth_user', JSON.stringify(authUser));
                    localStorage.setItem('user_role', userRole);
                    console.log('Usuario completo guardado en localStorage:', authUser);
                    
                    // Intentar obtener el perfil del backend
                    return this.getUserProfileFromBackend(token, user.email || '').pipe(
                      switchMap(profile => {
                        if (profile) {
                          // Perfil existe - actualizar usuario con IDs correctos
                          console.log('✅ Perfil obtenido del backend:', profile);
                          console.log('📋 Estructura del perfil recibido:');
                          console.log('  - profile.id (Provider ID en respuesta):', profile.id);
                          console.log('  - profile.userId (User ID):', profile.userId);
                          console.log('  - profile.email:', profile.email);
                          console.log('  - profile.taxName:', profile.taxName);
                          
                          // IMPORTANTE: El endpoint /providers/{id}/profiles devuelve el PROVIDER, no el PROFILE
                          // El profile.id que viene aquí es en realidad el providerId
                          // Necesitamos obtener el profileId real si el backend lo devuelve
                          
                          const updatedUser = {
                            ...authUser,
                            id: profile.userId,  // ← ID de la tabla users (CRÍTICO para crear residentes)
                            userId: profile.userId, // Explícito
                            providerId: profile.id, // ← Este es el Provider ID (para GET /providers/{id}/profiles)
                            profileId: profile.profileId || profile.id, // ← Profile ID real si existe en respuesta
                            companyName: profile.taxName || profile.companyName || profile.firstName,
                            taxName: profile.taxName || '',
                            email: profile.email || authUser.email,
                            phone: profile.phone || '',
                            ruc: profile.ruc || '',
                            direction: profile.direction || '',
                            documentNumber: profile.documentNumber || '',
                            documentType: profile.documentType || '',
                            firstName: profile.firstName || '',
                            lastName: profile.lastName || '',
                            auth0Id: authUser.auth0Id  // Mantener referencia a Auth0
                          };
                          
                          localStorage.setItem('auth_user', JSON.stringify(updatedUser));
                          console.log('✅ Usuario actualizado correctamente:');
                          console.log('  - user.id (User ID):', updatedUser.id);
                          console.log('  - user.userId (User ID):', updatedUser.userId);
                          console.log('  - user.providerId (Provider ID para endpoints):', updatedUser.providerId);
                          console.log('  - user.profileId (Profile ID):', updatedUser.profileId);
                          console.log('  - user.auth0Id (Auth0 referencia):', updatedUser.auth0Id);
                          
                          // Verificación de guardado
                          const verify = JSON.parse(localStorage.getItem('auth_user') || '{}');
                          console.log('🔍 Verificación - IDs guardados en localStorage:');
                          console.log('  - userId:', verify.userId);
                          console.log('  - providerId:', verify.providerId);
                          console.log('  - profileId:', verify.profileId);
                          
                          return of({ user: authUser, profile, userRole });
                        } else {
                          // Perfil NO existe (404) - crear automáticamente
                          console.log('⚠️ No se encontró perfil - Creando perfil automáticamente...');
                          
                          const companyName = authUser.name || 'Nuevo Usuario';
                          
                          const newProfileData = {
                            firstName: companyName,
                            lastName: companyName,
                            email: authUser.email,
                            direction: '',
                            documentNumber: '',
                            documentType: 'RUC',
                            phone: ''
                          };
                          
                          console.log('📤 Datos del nuevo perfil:', newProfileData);
                          
                          return this.createProfileInBackend(newProfileData).pipe(
                            tap((createdProfile: any) => {
                              console.log('✅ Perfil creado exitosamente en callback:', createdProfile);
                              console.log('📋 Estructura del perfil creado:');
                              console.log('  Respuesta completa:', JSON.stringify(createdProfile, null, 2));
                              console.log('  - createdProfile.id (Profile ID):', createdProfile.id);
                              console.log('  - createdProfile.userId (User ID):', createdProfile.userId);
                              console.log('  - createdProfile.profileId:', createdProfile.profileId);
                              console.log('  - createdProfile.providerId (Provider ID):', createdProfile.providerId);
                              
                              // IMPORTANTE: El backend devuelve diferentes IDs
                              // - userId: ID de tabla users (necesario para crear residentes)
                              // - id: ID de tabla profiles
                              // - providerId: ID de tabla providers (para GET /providers/{id}/profiles)
                              const updatedUser = {
                                ...authUser,
                                id: createdProfile.userId,  // ← ID de la tabla users (CRÍTICO)
                                userId: createdProfile.userId, // Explícito
                                profileId: createdProfile.id, // ID de la tabla profiles
                                providerId: createdProfile.providerId || createdProfile.id, // ID de tabla providers
                                companyName: createdProfile.firstName || createdProfile.taxName || companyName,
                                taxName: createdProfile.taxName || '',
                                email: createdProfile.email || authUser.email,
                                phone: createdProfile.phone || '',
                                ruc: createdProfile.ruc || '',
                                direction: createdProfile.direction || '',
                                documentNumber: createdProfile.documentNumber || '',
                                documentType: createdProfile.documentType || '',
                                firstName: createdProfile.firstName || '',
                                lastName: createdProfile.lastName || '',
                                auth0Id: authUser.auth0Id
                              };
                              
                              localStorage.setItem('auth_user', JSON.stringify(updatedUser));
                              console.log('✅ Usuario actualizado con perfil nuevo:');
                              console.log('  - user.id (User ID):', updatedUser.id);
                              console.log('  - user.userId (User ID):', updatedUser.userId);
                              console.log('  - user.profileId (Profile ID):', updatedUser.profileId);
                              console.log('  - user.providerId (Provider ID):', updatedUser.providerId);
                              console.log('  - user.auth0Id:', updatedUser.auth0Id);
                              
                              // Verificar guardado
                              const verify = JSON.parse(localStorage.getItem('auth_user') || '{}');
                              console.log('🔍 Verificación - Usuario guardado:');
                              console.log('  - userId:', verify.userId);
                              console.log('  - profileId:', verify.profileId);
                              console.log('  - providerId:', verify.providerId);
                            }),
                            map((createdProfile: any) => ({ user: authUser, profile: createdProfile, userRole })),
                            catchError(createError => {
                              console.error('❌ Error al crear perfil automáticamente:', createError);
                              console.error('Error completo:', createError);
                              // Continuar sin perfil si falla la creación
                              return of({ user: authUser, profile: null, userRole });
                            })
                          );
                        }
                      }),
                      catchError(error => {
                        console.warn('Error general al obtener/crear perfil:', error);
                        // Si falla, continuar con la info de Auth0
                        return of({ user: authUser, profile: null, userRole });
                      })
                    );
                  } else {
                    throw new Error('No user information received from Auth0');
                  }
                })
              );
            }),
            switchMap(({ user, profile, userRole }) => {
              this.title = 'Success!';
              this.message = 'Redirecting to your dashboard...';
              
              // Determinar la ruta según el rol del usuario
              let targetRoute = '/home'; // Por defecto para providers
              
              // Si es admin, redirigir al dashboard de administrador
              if (userRole === 'admin') {
                targetRoute = '/admin/admin-dashboard';
                console.log('✅ Usuario es ADMIN, redirigiendo a:', targetRoute);
              } else {
                console.log('✅ Usuario es PROVIDER, redirigiendo a:', targetRoute);
              }
              
              console.log('Ruta de redirección final:', targetRoute);
              
              // Navigate after a brief delay
              setTimeout(() => {
                this.router.navigate([targetRoute]);
                console.log('=== FIN AUTH0 CALLBACK ===');
              }, 1000);
              
              return of(null);
            })
          );
        } else {
          throw new Error('Authentication failed');
        }
      }),
      catchError(error => {
        console.error('Auth0 callback error:', error);
        this.title = 'Authentication Error';
        this.message = '';
        this.error = error.message || 'An error occurred during authentication. Please try again.';
        return of(null);
      })
    ).subscribe();
  }

  private getUserProfileFromBackend(token: string, email: string): Observable<any> {
    console.log('Consultando perfil del backend...');
    
    // Usar el nuevo endpoint /me/profile que usa el token JWT
    const profileUrl = `${environment.serverBasePath}providers/me/profile`;
    
    return this.http.get<any>(profileUrl).pipe(
      tap(profile => {
        console.log('Perfil recibido del backend:', profile);
        console.log('ID de la base de datos:', profile.id);
      }),
      catchError(error => {
        console.warn('No se pudo obtener perfil del backend:', error);
        console.warn('Código de error:', error.status);
        console.warn('Mensaje:', error.message);
        
        // Si es 404, devolver null (perfil no existe)
        if (error.status === 404) {
          console.log('Perfil no encontrado (404) - necesita ser creado');
          return of(null);
        }
        
        // Para otros errores, también devolver null
        return of(null);
      })
    );
  }

  private createProfileInBackend(profileData: any): Observable<any> {
    console.log('Creando perfil en el backend con datos:', profileData);
    
    const profileUrl = `${environment.serverBasePath}profiles`;
    
    return this.http.post<any>(profileUrl, profileData).pipe(
      tap((createdProfile: any) => {
        console.log('Perfil creado con ID:', createdProfile.id);
      }),
      catchError(error => {
        console.error('Error al crear perfil:', error);
        throw error;
      })
    );
  }

  retry(): void {
    this.error = '';
    this.title = 'Processing Login...';
    this.message = 'Please wait while we complete your authentication.';
    this.router.navigate(['/login']);
  }
}
