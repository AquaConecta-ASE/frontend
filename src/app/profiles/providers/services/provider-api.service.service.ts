import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, throwError } from 'rxjs';
import { Provider } from '../model/provider.model';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ProviderApiServiceService {
  private http = inject(HttpClient);
  private basePath: string = environment.serverBasePath;
  private resourceEndpoint = 'providers';

  private resourcePath(): string {
    return `${this.basePath}${this.resourceEndpoint}`;
  }

  getAllProviders(): Observable<Provider[]> {
    return this.http.get<Provider[]>(this.resourcePath());
  }

  /**
   * Obtiene el perfil del usuario autenticado
   * Usa el endpoint /providers/me/profile que devuelve todos los datos del provider
   * incluyendo el providerId (que es el campo 'id' de la respuesta)
   */
  getMyProfile(): Observable<any> {
    console.log('=== GET MY PROFILE ===');
    
    // Verificar si tenemos el token de Auth0
    const storedUser = localStorage.getItem('auth_user');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      console.log('📋 User en localStorage:', {
        auth0Id: user.auth0Id,
        userId: user.userId,
        providerId: user.providerId,
        email: user.email
      });
    }
    
    const endpoint = `${this.basePath}${this.resourceEndpoint}/me/profile`;
    console.log('📡 Endpoint completo:', endpoint);
    console.log('🔑 ¿Requiere autenticación con Auth0 token?', 'Sí (JWT en headers)');
    
    return this.http.get<any>(endpoint).pipe(
      tap(response => {
        console.log('✅✅✅ RESPUESTA COMPLETA DEL BACKEND ✅✅✅');
        console.log('📦 Response RAW:', response);
        console.log('📦 Response JSON:', JSON.stringify(response, null, 2));
        console.log('');
        console.log('📋 Estructura de campos recibidos:');
        console.log('  - id (providerId):', response.id, '← ESTE ES EL PROVIDER ID');
        console.log('  - taxName:', response.taxName);
        console.log('  - ruc:', response.ruc);
        console.log('  - userId:', response.userId);
        console.log('  - firstName:', response.firstName);
        console.log('  - lastName:', response.lastName);
        console.log('  - email:', response.email);
        console.log('  - direction:', response.direction);
        console.log('  - documentNumber:', response.documentNumber);
        console.log('  - documentType:', response.documentType);
        console.log('  - phone:', response.phone);
        console.log('');
        console.log('🔍 Tipos de datos:');
        console.log('  - typeof id:', typeof response.id);
        console.log('  - typeof userId:', typeof response.userId);
      })
    );
  }

  /**
   * Crea un nuevo perfil para el usuario autenticado
   * El backend extrae el user ID del token JWT
   */
  createProfile(profileData: any): Observable<any> {
    console.log('=== CREATE PROFILE ===');
    console.log('Profile data:', profileData);
    console.log('Endpoint: POST', `${this.basePath}profiles`);
    console.log('Request body (formatted):');
    console.log(JSON.stringify(profileData, null, 2));
    
    // Verificar que los campos tienen valores
    console.log('Validación de campos:');
    console.log('  firstName:', profileData.firstName ? '✅' : '❌ VACÍO');
    console.log('  lastName:', profileData.lastName ? '✅' : '❌ VACÍO');
    console.log('  email:', profileData.email ? '✅' : '❌ VACÍO');
    console.log('  direction:', profileData.direction ? '✅' : '❌ VACÍO');
    console.log('  documentNumber:', profileData.documentNumber ? '✅' : '❌ VACÍO');
    console.log('  documentType:', profileData.documentType ? '✅' : '❌ VACÍO');
    console.log('  phone:', profileData.phone ? '✅' : '❌ VACÍO');
    
    return this.http.post<any>(`${this.basePath}profiles`, profileData);
  }

  /**
   * Actualiza el perfil del usuario (tabla profile)
   * Usa PUT /profiles (el backend extrae el user del token JWT)
   */
  updateProfile(profileData: any): Observable<any> {
    console.log('=== UPDATE PROFILE ===');
    console.log('Profile data to update:', profileData);
    console.log('Request body:', JSON.stringify(profileData, null, 2));
    console.log('Endpoint: PUT', `${this.basePath}profiles`);
    
    return this.http.put<any>(`${this.basePath}profiles`, profileData);
  }

  /**
   * Actualiza el provider del usuario (tabla provider)
   * Usa PUT /providers/{providerId}/profiles
   */
  updateProvider(providerData: any): Observable<any> {
    const storedUser = localStorage.getItem('auth_user');
    if (!storedUser) {
      return throwError(() => new Error('No user found in localStorage'));
    }
    const user = JSON.parse(storedUser);
    // ✅ CORRECTO: Usar providerId, no user.id
    const providerId = user.providerId;
    
    if (!providerId) {
      console.error('❌ No provider ID found in user data');
      console.error('📋 User data:', JSON.stringify(user, null, 2));
      console.error('💡 El BFF debe devolver providerId en /providers/me/profile');
      return throwError(() => new Error('No provider ID found in user data'));
    }
    
    console.log('=== UPDATE PROVIDER ===');
    console.log('Provider data to update:', providerData);
    console.log('Using provider ID:', providerId);
    console.log('Request body:', JSON.stringify(providerData, null, 2));
    console.log('Endpoint: PUT', `${this.basePath}${this.resourceEndpoint}/${providerId}/profiles`);
    
    return this.http.put<any>(`${this.basePath}${this.resourceEndpoint}/${providerId}/profiles`, providerData);
  }

  /**
   * @deprecated Use updateProfile() or updateProvider() instead
   */
  UpdateProvider(provider: any): Observable<any> {
    console.log('⚠️ UpdateProvider is deprecated, using updateProfile instead');
    return this.updateProfile(provider);
  }

  /**
   * @deprecated Use getMyProfile() instead
   * Este método usa el ID del localStorage que puede ser el auth0 ID
   */
  getProvidersProfile(): Observable<any> {
    const storedUser = localStorage.getItem('auth_user');
    if (!storedUser) {
      return throwError(() => new Error('No user found in localStorage'));
    }
    const user = JSON.parse(storedUser);
    console.log('⚠️ DEPRECATED: Use getMyProfile() instead');
    console.log('Getting profile for user:', user);
    // ✅ CORRECTO: Usar providerId, no user.id
    const providerId = user.providerId;
    return this.http.get<any>(`${this.basePath}${this.resourceEndpoint}/${providerId}/profiles`);
  }

  getProviderById(id: number): Observable<Provider> {
    console.log('Getting provider with ID:', id);
    return this.http.get<Provider>(`${this.basePath}${this.resourceEndpoint}/${id}/profiles`);
  }

  // Método específico para admin - endpoint directo sin /profiles
  getProviderByIdForAdmin(id: number): Observable<Provider> {
    console.log('Getting provider with ID for admin:', id);
    return this.http.get<Provider>(`${this.basePath}${this.resourceEndpoint}/${id}`);
  }
}
