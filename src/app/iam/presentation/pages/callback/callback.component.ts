import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService as Auth0Service } from '@auth0/auth0-angular';
import { AuthService } from '../../../application/services/auth.service';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, delay, filter, of, retry, switchMap, take, timeout, tap, map } from 'rxjs';
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
  private auth0Service = inject(Auth0Service);
  private authService = inject(AuthService);
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
    
    this.auth0Service.isAuthenticated$.pipe(
      filter(isAuthenticated => isAuthenticated !== null),
      take(1),
      timeout(10000),
      switchMap(isAuthenticated => {
        if (isAuthenticated) {
          console.log('Usuario autenticado con Auth0');
          
          // Obtener el token de acceso
          return this.auth0Service.getAccessTokenSilently().pipe(
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
              return this.auth0Service.user$.pipe(
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
                    
                    // Dar un pequeño delay para asegurar que el token esté completamente propagado
                    console.log('⏳ Esperando 800ms para asegurar que el token esté listo...');
                    
                    // Intentar obtener el perfil del backend
                    return of(null).pipe(
                      delay(800), // Delay adicional antes de llamar al BFF
                      tap(() => console.log('✅ Delay completado, llamando al BFF...')),
                      switchMap(() => this.getUserProfileFromBackend(token, user.email || '')),
                      tap(profile => {
                        console.log('📦 Respuesta del getUserProfileFromBackend:', profile);
                        if (!profile) {
                          console.error('❌❌❌ EL BFF DEVOLVIÓ NULL O UNDEFINED');
                          console.error('Esto significa que hubo un error al llamar al BFF');
                          console.error('Revisa los logs anteriores para ver el error exacto');
                        }
                      }),
                      switchMap(profile => {
                        if (profile) {
                          console.log('');
                          console.log('✅✅✅ PERFIL OBTENIDO - INICIANDO MAPEO ✅✅✅');
                          console.log('📋 Datos RAW del backend:', JSON.stringify(profile, null, 2));
                          console.log('');
                          console.log('🆔 EXTRAYENDO IDs PARA LOCALSTORAGE:');
                          console.log('  - profile.id → será providerId:', profile.id, '(tipo:', typeof profile.id, ')');
                          console.log('  - profile.userId → será userId:', profile.userId, '(tipo:', typeof profile.userId, ')');
                          console.log('');
                          console.log('📋 EXTRAYENDO DATOS DEL PERFIL:');
                          console.log('  - taxName:', profile.taxName);
                          console.log('  - ruc:', profile.ruc);
                          console.log('  - email:', profile.email);
                          console.log('  - firstName:', profile.firstName);
                          console.log('  - lastName:', profile.lastName);
                          console.log('  - phone:', profile.phone);
                          console.log('');
                          
                          console.log('🔨 Creando objeto updatedUser para localStorage...');
                          const updatedUser = {
                            ...authUser,
                            // IDs CRÍTICOS del backend
                            userId: profile.userId,        // ← ID de la tabla users (CRÍTICO)
                            providerId: profile.id,        // ← ID de la tabla providers (el "id" en la respuesta)
                            id: profile.userId,            // ← Alias de userId para compatibilidad
                            
                            // Datos del perfil
                            companyName: profile.taxName || profile.firstName || '',
                            taxName: profile.taxName || '',
                            email: profile.email || authUser.email,
                            phone: profile.phone || '',
                            ruc: profile.ruc || '',
                            direction: profile.direction || '',
                            documentNumber: profile.documentNumber || '',
                            documentType: profile.documentType || '',
                            firstName: profile.firstName || '',
                            lastName: profile.lastName || '',
                            
                            // Mantener referencia a Auth0
                            auth0Id: authUser.auth0Id
                          };
                          
                          console.log('');
                          console.log('💾💾💾 GUARDANDO EN LOCALSTORAGE 💾💾💾');
                          console.log('📝 Objeto updatedUser completo:');
                          console.log(JSON.stringify(updatedUser, null, 2));
                          console.log('');
                          console.log('🆔 IDs que se guardarán:');
                          console.log('  - userId:', updatedUser.userId);
                          console.log('  - providerId:', updatedUser.providerId, '← PROVIDER ID DEL BACKEND');
                          console.log('  - id:', updatedUser.id);
                          console.log('');
                          
                          localStorage.setItem('auth_user', JSON.stringify(updatedUser));
                          console.log('✅ Guardado completado en localStorage');
                          
                          console.log('');
                          console.log('🔍 VERIFICANDO LO QUE SE GUARDÓ:');
                          const verify = JSON.parse(localStorage.getItem('auth_user') || '{}');
                          console.log('📋 Contenido completo de localStorage:');
                          console.log(JSON.stringify(verify, null, 2));
                          console.log('');
                          console.log('🆔 IDs FINALES EN LOCALSTORAGE:');
                          console.log('  - verify.userId:', verify.userId, '(tipo:', typeof verify.userId, ')');
                          console.log('  - verify.providerId:', verify.providerId, '(tipo:', typeof verify.providerId, ') ← CRÍTICO');
                          console.log('  - verify.id:', verify.id, '(tipo:', typeof verify.id, ')');
                          console.log('  - verify.email:', verify.email);
                          console.log('  - verify.taxName:', verify.taxName);
                          console.log('  - verify.ruc:', verify.ruc);
                          console.log('');
                          
                          // ⚠️ VALIDACIÓN CRÍTICA
                          if (!verify.providerId) {
                            console.error('❌❌❌ CRÍTICO: providerId es undefined o null!');
                            console.error('❌ providerId actual:', verify.providerId);
                            console.error('❌ profile.id original era:', profile.id);
                            console.error('❌ Algo falló en el mapeo o guardado');
                          } else if (verify.providerId.toString().startsWith('auth0|')) {
                            console.error('❌❌❌ CRÍTICO: providerId contiene auth0 ID!');
                            console.error('❌ providerId actual:', verify.providerId);
                            console.error('❌ Debería ser un número como:', profile.id);
                          } else {
                            console.log('✅✅✅ providerId guardado correctamente:', verify.providerId);
                          }
                          
                          if (!verify.userId) {
                            console.error('❌❌❌ CRÍTICO: userId es undefined o null!');
                            console.error('❌ userId actual:', verify.userId);
                          } else {
                            console.log('✅✅✅ userId guardado correctamente:', verify.userId);
                          }
                          
                          return of({ user: updatedUser, profile, userRole });
                        } else {
                          // 🆕 PERFIL NO EXISTE - CREAR AUTOMÁTICAMENTE
                          console.log('⚠️ Perfil no encontrado - Creando perfil automáticamente...');
                          console.log('📋 Datos disponibles de Auth0 para crear perfil:');
                          console.log('  - email:', user.email);
                          console.log('  - name:', user.name);
                          console.log('  - nickname:', user.nickname);
                          
                          // Crear perfil con datos básicos de Auth0
                          const newProfileData = {
                            firstName: user.name || user.nickname || 'Provider',
                            lastName: user.name || user.nickname || 'User',
                            email: user.email || '',
                            direction: '',          // Vacío - el provider lo llenará después
                            documentNumber: '',     // Vacío - el provider lo llenará después
                            documentType: 'RUC',    // Por defecto RUC
                            phone: ''               // Vacío - el provider lo llenará después
                          };
                          
                          console.log('📤 Creando perfil con datos:', JSON.stringify(newProfileData, null, 2));
                          
                          return this.createProfileInBackend(newProfileData).pipe(
                            tap((createdProfile: any) => {
                              console.log('✅ Perfil creado automáticamente');
                              console.log('📋 Respuesta del backend:', JSON.stringify(createdProfile, null, 2));
                              
                              // Guardar datos del perfil creado en localStorage
                              // NO intentar obtener del BFF todavía (puede dar error 500)
                              const updatedUser = {
                                ...authUser,
                                // Guardar lo que el backend devolvió
                                userId: createdProfile.userId || authUser.id,
                                providerId: createdProfile.providerId || null,
                                id: createdProfile.userId || authUser.id,
                                profileId: createdProfile.id,
                                // Datos del perfil
                                companyName: user.name || '',
                                firstName: createdProfile.firstName || user.name || '',
                                lastName: createdProfile.lastName || user.name || '',
                                email: createdProfile.email || user.email || '',
                                phone: '',
                                ruc: '',
                                direction: '',
                                documentNumber: '',
                                documentType: 'RUC',
                                taxName: '',
                                auth0Id: authUser.auth0Id,
                                // Marcar que el perfil está incompleto
                                profileIncomplete: true
                              };
                              
                              localStorage.setItem('auth_user', JSON.stringify(updatedUser));
                              console.log('✅ Usuario guardado en localStorage');
                              console.log('  - userId:', updatedUser.userId);
                              console.log('  - providerId:', updatedUser.providerId || 'null (se obtendrá después)');
                              console.log('  - profileId:', updatedUser.profileId);
                              console.log('  - email:', updatedUser.email);
                              console.log('  - profileIncomplete:', updatedUser.profileIncomplete);
                            }),
                            map((createdProfile: any) => {
                              const updatedUser = JSON.parse(localStorage.getItem('auth_user') || '{}');
                              return { user: updatedUser, profile: createdProfile, userRole };
                            }),
                            catchError(createError => {
                              console.error('❌ Error al crear perfil automáticamente:', createError);
                              console.error('Error completo:', createError);
                              // Si falla la creación, continuar con usuario básico
                              return of({ user: authUser, profile: null, userRole });
                            })
                          );
                        }
                      }),
                      catchError(error => {
                        console.warn('⚠️ Error general al obtener/crear perfil:', error);
                        console.warn('⚠️ NO sobrescribir localStorage - mantener lo que ya existe');
                        
                        // IMPORTANTE: NO devolver authUser porque NO tiene providerId
                        // En su lugar, leer lo que esté en localStorage (puede tener providerId de un intento anterior)
                        const currentUser = JSON.parse(localStorage.getItem('auth_user') || '{}');
                        
                        console.log('📋 Usuario actual en localStorage:', currentUser);
                        console.log('   - providerId actual:', currentUser.providerId);
                        
                        // Si falla, continuar SIN sobrescribir el usuario
                        return of({ user: currentUser, profile: null, userRole });
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
              
              // Verificación final antes de navegar
              const finalUser = JSON.parse(localStorage.getItem('auth_user') || '{}');
              console.log('');
              console.log('═══════════════════════════════════════════════');
              console.log('🔍 VERIFICACIÓN FINAL ANTES DE NAVEGAR');
              console.log('═══════════════════════════════════════════════');
              console.log('📋 Usuario en localStorage:', JSON.stringify(finalUser, null, 2));
              console.log('🆔 IDs críticos:');
              console.log('   - userId:', finalUser.userId, '(tipo:', typeof finalUser.userId, ')');
              console.log('   - providerId:', finalUser.providerId, '(tipo:', typeof finalUser.providerId, ')');
              console.log('   - auth0Id:', finalUser.auth0Id);
              
              if (!finalUser.providerId || finalUser.providerId.toString().startsWith('auth0|')) {
                console.error('');
                console.error('❌❌❌ ALERTA CRÍTICA ❌❌❌');
                console.error('providerId NO está correcto antes de navegar!');
                console.error('providerId actual:', finalUser.providerId);
                console.error('Esto causará errores en la página siguiente');
                console.error('═══════════════════════════════════════════════');
                
                // Navegar sin reload
                setTimeout(() => {
                  console.log('🚀 Navegando a:', targetRoute);
                  this.router.navigate([targetRoute]);
                  console.log('=== FIN AUTH0 CALLBACK ===');
                }, 1000);
              } else {
                console.log('');
                console.log('✅✅✅ TODO CORRECTO ✅✅✅');
                console.log('providerId:', finalUser.providerId);
                console.log('userId:', finalUser.userId);
                console.log('═══════════════════════════════════════════════');
                
                // Navegar y hacer refresh automático de la página
                console.log('🔄 Marcando para hacer refresh después de navegar...');
                sessionStorage.setItem('needs_refresh_after_login', 'true');
                
                setTimeout(() => {
                  console.log('🚀 Navegando a:', targetRoute);
                  this.router.navigate([targetRoute]).then(() => {
                    // Verificar si necesita refresh
                    if (sessionStorage.getItem('needs_refresh_after_login') === 'true') {
                      console.log('🔄 Haciendo refresh automático de la página...');
                      sessionStorage.removeItem('needs_refresh_after_login');
                      window.location.reload();
                    }
                  });
                  console.log('=== FIN AUTH0 CALLBACK ===');
                }, 1000);
              }
              
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
    console.log('');
    console.log('🔍🔍🔍 CONSULTANDO PERFIL DEL BACKEND 🔍🔍🔍');
    console.log('📧 Email del usuario:', email);
    console.log('🔑 Token disponible:', token ? 'Sí' : 'No');
    if (token) {
      console.log('🔑 Token length:', token.length);
      console.log('🔑 Token preview:', token.substring(0, 30) + '...');
    }
    
    const profileUrl = `${environment.serverBasePath}providers/me/profile`;
    console.log('📡 URL COMPLETA del endpoint:', profileUrl);
    console.log('📡 Este endpoint devuelve:');
    console.log('   - id (providerId)');
    console.log('   - userId');
    console.log('   - taxName, ruc, firstName, lastName, email, phone, etc.');
    
    // Agregar headers explícitos con el token
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
    
    console.log('📤 Headers enviados:', {
      'Authorization': token ? `Bearer ${token.substring(0, 20)}...` : 'No token',
      'Content-Type': 'application/json'
    });
    
    // Estrategia de retry mejorada para evitar race condition en primer login
    return of(null).pipe(
      delay(1000), // Aumentar delay inicial a 1 segundo (antes era 500ms)
      tap(() => console.log('⏰ Delay completado, haciendo petición al BFF...')),
      switchMap(() => this.http.get<any>(profileUrl, { headers })),
      retry({
        count: 4, // Aumentar a 4 intentos (antes eran 3)
        delay: (error, retryCount) => {
          console.log(`⚠️ Intento ${retryCount} falló - Error ${error.status}: ${error.message}`);
          console.log(`🔄 Reintentando en ${1.5 * retryCount}s...`);
          
          // Reintentar en errores de red (0), CORS, o servidor (500+)
          if (error.status === 0 || error.status >= 500) {
            // Delay progresivo: 1.5s, 3s, 4.5s
            return of(null).pipe(delay(1500 * retryCount));
          }
          
          // Para otros errores (401, 403, 404), no reintentar
          throw error;
        }
      }),
      tap(profile => {
        console.log('');
        console.log('✅✅✅ PERFIL RECIBIDO DEL BACKEND ✅✅✅');
        console.log('📦 Respuesta completa:', profile);
        console.log('📦 JSON:', JSON.stringify(profile, null, 2));
        console.log('');
        console.log('🆔 IDs EXTRAÍDOS:');
        console.log('  - profile.id (PROVIDER ID):', profile.id, '(tipo:', typeof profile.id, ')');
        console.log('  - profile.userId (USER ID):', profile.userId, '(tipo:', typeof profile.userId, ')');
        console.log('');
        console.log('📋 DATOS DEL PERFIL:');
        console.log('  - taxName:', profile.taxName);
        console.log('  - ruc:', profile.ruc);
        console.log('  - firstName:', profile.firstName);
        console.log('  - lastName:', profile.lastName);
        console.log('  - email:', profile.email);
        console.log('  - phone:', profile.phone);
        console.log('  - direction:', profile.direction);
        console.log('  - documentNumber:', profile.documentNumber);
        console.log('  - documentType:', profile.documentType);
        console.log('');
      }),
      catchError(error => {
        console.error('❌ Error al obtener perfil del BFF:', error);
        console.error('  - Status:', error.status);
        console.error('  - Message:', error.message);
        console.error('  - Error completo:', error);
        
        // Si es 404, devolver null (perfil no existe)
        if (error.status === 404) {
          console.log('📝 Perfil no encontrado (404) - necesita ser creado');
          return of(null);
        }
        
        // Para otros errores, también devolver null y continuar
        console.warn('⚠️ Continuando sin perfil del backend');
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