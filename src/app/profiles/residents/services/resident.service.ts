import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {catchError, retry, switchMap} from 'rxjs/operators';
import { Resident } from '../models/resident.model';
import { BaseService } from '../../../shared/services/base.service';
import { OperatorFunction, throwError, timer } from 'rxjs';
import { retryWhen, mergeMap } from 'rxjs/operators';
import { Event } from '../models/event.model';
import { map } from 'rxjs/operators';
@Injectable({
  providedIn: 'root'
})
export class ResidentService extends BaseService<Resident> {

  constructor(http: HttpClient) {
    super(http);
    this.resourceEndpoint = 'residents';
  }

  getProvidersProfile(): Observable<any> {
    const storedUser = localStorage.getItem('auth_user');
    if (!storedUser) {
      return throwError(() => new Error('No user found in localStorage'));
    }
    const user = JSON.parse(storedUser);
    return this.http.get<any>(`${this.basePath}providers/${user.id}/profiles`, this.httpOptions);
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
    return this.create(resident);
  }

  // Método para obtener un residente por ID, si da error em eñ resident-summary.component cambiar para que devuelva un array
  getResidentById(id: number): Observable<Resident> {
    const url = `${this.resourcePath()}/${id}`;  // URL actual
    console.log('URL para GET resident by ID:', url);

    return this.http.get<Resident[]>(url, this.httpOptions).pipe(
      map(residents => {
        if (residents && residents.length > 0) {
          return residents[0];
        }
        throw new Error(`Resident with ID ${id} not found`);
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
