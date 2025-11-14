import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {catchError, retry, switchMap} from 'rxjs/operators';
import { Resident } from '../models/resident.model';
import { BaseService } from '../../../shared/services/base.service';
import { OperatorFunction, throwError, timer } from 'rxjs';
import { retryWhen, mergeMap } from 'rxjs/operators';
import { Event } from '../models/event.model';
import { map } from 'rxjs/operators';
import { ProviderApiServiceService } from '../../providers/services/provider-api.service.service';
@Injectable({
  providedIn: 'root'
})
export class ResidentService extends BaseService<Resident> {
  private providerService = inject(ProviderApiServiceService);

  constructor(http: HttpClient) {
    super(http);
    this.resourceEndpoint = 'residents';
  }

  /**
   * Obtiene el perfil del usuario autenticado usando el token JWT
   * Usa el endpoint /providers/me/profile que obtiene el ID correcto de la BD
   */
  getProvidersProfile(): Observable<any> {
    return this.providerService.getMyProfile();
  }

  // Método que obtiene residentes por provider usando el perfil
  getResidentsByProvider(): Observable<Resident[]> {
    return this.getProvidersProfile().pipe(
      switchMap(profile => {
        console.log('Perfil obtenido:', profile);

        // Extraer el userId del perfil
        const providerId = profile.id;

        if (!providerId) {
          throw new Error('No se pudo obtener el ID del proveedor del perfil');
        }

        const url = `${this.resourcePath()}`;
        console.log('URL para GET residents:', url);

        return this.http.get<Resident[]>(url, this.httpOptions);
      }),
      retry(2),
      catchError(this.handleError)
    );
  }

  getResidents(): Observable<Resident[]> {
    // Usar el método específico que obtiene por provider
    return this.getResidentsByProvider();
  }

  getAllResidents(): Observable<Resident[]> {
    return this.http.get<Resident[]>(`${this.basePath}residents`, this.httpOptions);
  }

  createResident(resident: any): Observable<Resident> {
    // Usar el endpoint /residents/complete en lugar del endpoint base
    const url = `${this.basePath}residents/complete`;
    console.log('POST URL para crear residente:', url);
    console.log('Datos enviados:', resident);
    return this.http.post<Resident>(url, resident, this.httpOptions);
  }

  // Método para obtener un residente por ID
  getResidentById(id: number): Observable<Resident> {
    const url = `${this.resourcePath()}/${id}`;
    console.log('URL para GET resident by ID:', url);

    return this.http.get<any>(url, this.httpOptions).pipe(
      map(response => {
        console.log('Response from backend for resident ID', id, ':', response);
        
        // Si la respuesta es un array, tomar el primer elemento
        if (Array.isArray(response)) {
          if (response.length > 0) {
            console.log('Response is array, returning first element:', response[0]);
            return response[0];
          }
          throw new Error(`Resident with ID ${id} not found in array`);
        }
        
        // Si la respuesta es un objeto directo, devolverlo
        if (response && typeof response === 'object') {
          console.log('Response is object, returning directly:', response);
          return response as Resident;
        }
        
        throw new Error(`Invalid response format for resident ID ${id}`);
      }),
      retry(2),
      catchError(this.handleError)
    );
  }

  getAllEventsByResidentId(residentId: number): Observable<Event[]> {
    return this.http.get<Resident[]>(`${this.basePath}${this.resourceEndpoint}`, this.httpOptions).pipe(
      map((residents: any[]) => {
        const allEvents: Event[] = [];
        const resident = residents.find((r: any) => r.id === residentId);

        if (resident && Array.isArray(resident.sensor_events)) {
          resident.sensor_events.forEach((event: any, index: number) => {
            allEvents.push({
              id: index + 1,
              event_type: event.event,
              quality_value: event.water_quality,
              status: event.status,
              level_value: event.water_level
            });
          });
        }

        return allEvents;
      }),
      catchError(this.handleError)
    );
  }

  updateResident(id: number, resident: Resident): Observable<Resident> {
    return this.update(id, resident);
  }

  deleteResident(id: number): Observable<any> {
    return this.delete(id);
  }

}
