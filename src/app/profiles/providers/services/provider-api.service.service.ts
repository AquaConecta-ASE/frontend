import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
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
   * Usa el endpoint /providers/{providerId}/profiles
   * IMPORTANTE: Necesita el providerId (no el profileId ni el userId)
   */
  getMyProfile(): Observable<any> {
    const storedUser = localStorage.getItem('auth_user');
    if (!storedUser) {
      console.log('No user found in localStorage');
      return throwError(() => new Error('No user found in localStorage'));
    }
    
    const user = JSON.parse(storedUser);
    
    console.log('=== GET MY PROFILE ===');
    console.log('User from localStorage:', user);
    console.log('Available IDs:');
    console.log('  - user.userId:', user.userId);
    console.log('  - user.providerId:', user.providerId, '← Este se usa para /providers/{id}/profiles');
    console.log('  - user.profileId:', user.profileId);
    console.log('  - user.id:', user.id);
    console.log('  - user.auth0Id:', user.auth0Id);
    
    // IMPORTANTE: El endpoint es /providers/{providerId}/profiles
    // Necesitamos el providerId (ID de la tabla providers), NO el profileId
    let providerIdToUse = user.providerId || user.id;
    
    // Validar que NO sea un ID de Auth0 (comienza con "auth0|")
    if (!providerIdToUse || (typeof providerIdToUse === 'string' && providerIdToUse.includes('auth0'))) {
      console.error('❌ El providerId no es válido:', providerIdToUse);
      console.error('El usuario debe completar su perfil primero');
      return throwError(() => new Error('No valid provider ID found. Profile may not have been created yet.'));
    }
    
    console.log('✅ Provider ID a usar:', providerIdToUse);
    const endpoint = `${this.basePath}${this.resourceEndpoint}/${providerIdToUse}/profiles`;
    console.log('📡 Endpoint:', endpoint);
    
    return this.http.get<any>(endpoint);
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
    const providerId = user.id || user.providerId;
    
    if (!providerId) {
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
    console.log('Getting profile for user:', user);
    return this.http.get<any>(`${this.basePath}${this.resourceEndpoint}/${user.id}/profiles`);
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
