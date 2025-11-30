import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { map, tap, switchMap } from 'rxjs/operators';
import { User } from '../../domain/models/user.model';
import { AuthCredentials } from '../../domain/models/auth-credentials.model';
import { Router } from '@angular/router';
import {BaseService} from '../../../shared/services/base.service';
import {catchError } from 'rxjs/operators';
import {environment} from '../../../../environments/environment';
import { of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService extends BaseService<User> {

  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY = 'auth_user';
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  
  // Nuevo: Observable para notificar cuando el perfil completo está listo (con providerId)
  private userProfileReadySubject = new BehaviorSubject<boolean>(false);
  public userProfileReady$ = this.userProfileReadySubject.asObservable();

  public currentUser$ = this.currentUserSubject.asObservable();
  public isLoggedIn$ = this.currentUser$.pipe(map(user => !!user));

  constructor(
    http: HttpClient,
    private router: Router
  ) {
    super(http);
    this.resourceEndpoint = 'authentication/sign-up';

    this.loadStoredUser();
  }

  // Add the missing loadStoredUser method
  private loadStoredUser(): void {
    const storedUser = localStorage.getItem(this.USER_KEY);
    if (storedUser) {
      const user = JSON.parse(storedUser);
      this.currentUserSubject.next(user);
      
      // Verificar si el usuario tiene providerId (perfil completo)
      if (user.providerId && !user.providerId.toString().startsWith('auth0|')) {
        console.log('✅ Perfil completo detectado en localStorage con providerId:', user.providerId);
        this.userProfileReadySubject.next(true);
      } else {
        console.log('⚠️ Usuario sin providerId válido en localStorage');
        this.userProfileReadySubject.next(false);
      }
    }
  }
  
  /**
   * Notifica que el perfil del usuario está completamente cargado
   * Debe llamarse desde el callback después de obtener el perfil del BFF
   */
  public notifyUserProfileReady(): void {
    console.log('🔔 AuthService: Notificando que el perfil está listo');
    this.userProfileReadySubject.next(true);
    
    // También recargar el usuario actual desde localStorage
    const storedUser = localStorage.getItem(this.USER_KEY);
    if (storedUser) {
      const user = JSON.parse(storedUser);
      this.currentUserSubject.next(user);
      console.log('✅ Usuario actualizado en AuthService:', user);
    }
  }

  // Add the missing login method
  login(credentials: AuthCredentials): Observable<User> {
    console.log('=== INICIO LOGIN ===');
    this.resourceEndpoint = 'authentication/sign-in';
    const payload = {
      username: credentials.email,
      password: credentials.password
    };

    return this.http.post<{ id: number; username: string; token: string }>(
      `${environment.serverBasePath}${this.resourceEndpoint}`,
      payload
    ).pipe(
      tap(response => {
        console.log('Respuesta del login recibida:', response);

        const user = new User({
          id: Number(response.id),
          username: response.username,
          email: credentials.email
        });

        console.log('Guardando en localStorage:');
        console.log('- TOKEN_KEY:', this.TOKEN_KEY);
        console.log('- USER_KEY:', this.USER_KEY);
        console.log('- Token a guardar:', response.token);
        console.log('- Usuario a guardar:', user);

        // Guardar en localStorage
        localStorage.setItem(this.TOKEN_KEY, response.token);
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));

        // Verificar que se guardaron
        const savedToken = localStorage.getItem(this.TOKEN_KEY);
        const savedUser = localStorage.getItem(this.USER_KEY);
        console.log('Verificación después de guardar:');
        console.log('- Token guardado:', savedToken ? 'Sí' : 'No');
        console.log('- Usuario guardado:', savedUser ? 'Sí' : 'No');

        // Actualizar subject
        this.currentUserSubject.next(user);
        console.log('CurrentUserSubject actualizado:', this.currentUserSubject.value);
        console.log('=== FIN LOGIN ===');
      }),
      catchError((error: any) => {
        console.error('Error en el login:', error);
        return throwError(() => new Error('Error en el login'));
      })
    );
  }

  signup(username: string, password: string, roles: string[], profileData: any): Observable<void> {
    // Validar que los datos críticos estén presentes
    const requiredFields = ['firstName', 'lastName', 'email', 'companyName', 'ruc'];
    const missingFields = requiredFields.filter(field => !profileData[field] || profileData[field].trim() === '');

    if (missingFields.length > 0) {
      console.error('Campos faltantes:', missingFields);
      return throwError(() => new Error(`Faltan campos requeridos: ${missingFields.join(', ')}`));
    }

    console.log('Datos del perfil validados:', profileData);

    console.log('Iniciando proceso de signup para:', username);
    const payload = { username, password, roles };

    return this.http.post<{ id: number; username: string }>(
      `${environment.serverBasePath}${this.resourceEndpoint}`,
      payload
    ).pipe(
      tap(signupResponse => {
        console.log('Respuesta del signup:', signupResponse);
      }),
      switchMap(signupResponse => {
        console.log('Procediendo con login automático...');
        const loginPayload = { username, password };

        return this.http.post<{ token: string }>(
          `${environment.serverBasePath}authentication/sign-in`,
          loginPayload
        ).pipe(
          tap(loginResponse => {
            console.log('Respuesta del login:');

            // Verificar que el token existe
            if (!loginResponse.token) {
              throw new Error('El servidor no devolvió un token válido');
            }

            console.log('Token recibido:');
            localStorage.setItem('auth_token', loginResponse.token);
            console.log('Token guardado en localStorage');
          }),
          switchMap(loginResponse => {
            const token = loginResponse.token;
            console.log('Creando perfil de usuario...');

            // Primero crear el perfil de usuario
            const profilePayload = {

              taxName: profileData.companyName,
              ruc: profileData.ruc,
              userId: signupResponse.id,

              firstName: profileData.firstName,
              lastName: profileData.lastName,

              email: profileData.email,
              direction: profileData.direction,
              documentNumber: profileData.documentNumber,
              documentType: profileData.documentType,
              phone: profileData.phone
            };

            console.log('Payload del perfil:');
            console.log('URL del perfil:', `${environment.serverBasePath}providers`);
            console.log('Headers que se enviarán:', {
              'Authorization': `Bearer `,
              'Content-Type': 'application/json'
            });

            return this.http.post<void>(
              `${environment.serverBasePath}providers`,
              profilePayload,
              {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              }
            ).pipe(
              tap(() => {
                console.log('Perfil creado exitosamente');
              }),

              catchError((profileError: any) => {
                console.error('Error detallado al crear perfil:', profileError);
                console.error('Status:', profileError.status);
                console.error('Message:', profileError.message);
                console.error('Error completo:', profileError);
                console.error('Token usado:', token);
                console.error('URL usada:', `${environment.serverBasePath}providers`);

                // Verificar si el token está en localStorage
                const storedToken = localStorage.getItem('auth_token');
                console.error('Token en localStorage:', storedToken);

                return throwError(() => new Error(`Error al crear el perfil de usuario: ${profileError.message || profileError.error?.message || 'Error desconocido'}`));
              })
            );
          }),
          catchError((loginError: any) => {
            console.error('Error en el login automático:', loginError);
            console.error('Status:', loginError.status);
            console.error('Message:', loginError.message);
            return throwError(() => new Error(`Error en el login automático: ${loginError.message || loginError.error?.message || 'Error desconocido'}`));
          })
        );
      }),
      map(() => {
        console.log('Proceso de signup completado exitosamente');
        this.logout();
        return void 0;
      }),
      catchError((error: any) => {
        console.error('Error general en el registro:', error);
        console.error('Stack trace:', error.stack);
        return throwError(() => new Error(`Error en el registro: ${error.message || 'Error desconocido'}`));
      })
    );
  }


// En auth.service.ts - Método logout mejorado con debugging
  logout(): void {
    console.log('=== INICIO LOGOUT AUTH SERVICE ===');

    // Clear all auth-related items from localStorage
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    // Clear the current user subject
    this.currentUserSubject.next(null);

    // Clear any cached HTTP headers by making a request with empty headers
    this.http.get(`${environment.serverBasePath}authentication/logout`, {
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })
    }).subscribe({
      error: () => {
        // Even if the request fails, we still want to proceed with the logout
        console.log('Logout request completed');
      }
    });

    // Navigate to login page
    this.router.navigate(['/login']).then(() => {
      // Force a page reload to clear any cached state
      window.location.reload();
    });

    console.log('=== FIN LOGOUT AUTH SERVICE ===');
  }


  private isValidEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  }


}
