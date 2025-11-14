import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of, throwError } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { ResidentData, SubscriptionData, SensorEvent, ResidentSensorData } from '../model/device-data.model';
import { ProviderApiServiceService } from './provider-api.service.service';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class DeviceDataService {
  private providerService = inject(ProviderApiServiceService);
  private http = inject(HttpClient);
  protected basePath = environment.serverBasePath;

  getProvidersProfile(): Observable<any> {
    console.log('=== SERVICIO: getProvidersProfile() ===');
    // Usar el nuevo método que obtiene el perfil por token JWT
    return this.providerService.getMyProfile();
  }

  getResidentsByProvider(providerId: number): Observable<ResidentData[]> {
    console.log('=== SERVICIO: getResidentsByProvider() ===');
    console.log('Provider ID:', providerId);
    const url = `${this.basePath}residents`;
    console.log('URL:', url);
    return this.http.get<ResidentData[]>(url).pipe(
      catchError(error => {
        console.error('Error in getResidentsByProvider:', error);
        return throwError(() => error);
      })
    );
  }

  getSubscriptionByResident(residentId: number): Observable<SubscriptionData[]> {
    const url = `${this.basePath}residents/${residentId}/subscriptions`;
    return this.http.get<SubscriptionData[]>(url).pipe(
      catchError(error => {
        console.error('Error in getSubscriptionByResident:', error);
        return throwError(() => error);
      })
    );
  }

  getSensorEvents(deviceId: number): Observable<SensorEvent[]> {
    if (deviceId === null || deviceId === undefined || isNaN(deviceId as any)) {
      console.warn('getSensorEvents called with invalid deviceId:', deviceId);
      // Return an empty array observable instead of calling an endpoint with 'undefined'
      return of([] as SensorEvent[]);
    }

    const url = `${this.basePath}devices/${deviceId}/events`;
    return this.http.get<SensorEvent[]>(url).pipe(
      catchError(error => {
        console.error('Error in getSensorEvents:', error);
        return throwError(() => error);
      })
    );
  }

  getCompleteSensorData(): Observable<ResidentSensorData[]> {
    console.log('=== SERVICIO: getCompleteSensorData() iniciado ===');
    return this.getProvidersProfile().pipe(
      switchMap(profile => {
        console.log('Perfil del proveedor obtenido:', profile);
        const providerId = profile.id;
        console.log('Provider ID:', providerId);

        if (!providerId) {
          console.error('No se pudo obtener el ID del proveedor del perfil');
          throw new Error('No se pudo obtener el ID del proveedor del perfil');
        }

        console.log('Llamando a getCompleteSensorDataByProvider con providerId:', providerId);
        return this.getCompleteSensorDataByProvider(providerId);
      })
    );
  }

  getCompleteSensorDataByProvider(providerId: number): Observable<ResidentSensorData[]> {
    console.log('=== SERVICIO: getCompleteSensorDataByProvider() iniciado ===');
    console.log('Provider ID recibido:', providerId);

    return this.getResidentsByProvider(providerId).pipe(
      switchMap(residents => {
        console.log('Residentes obtenidos:', residents);
        if (!residents || residents.length === 0) {
          console.log('No hay residentes para este proveedor');
          return of([]);
        }

        const residentDataObservables = residents.map(resident =>
          this.getSubscriptionByResident(resident.id).pipe(
            switchMap(subscriptions => {
                if (subscriptions && subscriptions.length > 0) {
                // Filtrar suscripciones que tengan deviceId o sensorId válido
                const validSubscriptions = subscriptions.filter(sub => {
                  const idToUse = (sub as any).deviceId ?? (sub as any).sensorId;
                  return sub && idToUse !== null && idToUse !== undefined && !isNaN(idToUse as any);
                });
                if (!validSubscriptions || validSubscriptions.length === 0) {
                  console.warn(`No valid deviceId/sensorId found for resident ${resident.id}. Subscriptions:`, subscriptions);
                  return of({
                    resident,
                    subscriptions: subscriptions,
                    sensorEvents: []
                  } as ResidentSensorData);
                }

                // Obtener eventos de todos los sensores del residente (usar deviceId o sensorId)
                const sensorEventObservables = validSubscriptions.map(subscription => {
                  const idToUse = (subscription as any).deviceId ?? (subscription as any).sensorId;
                  console.log(`Fetching events for resident ${resident.id} using id:`, idToUse);
                  return this.getSensorEvents(idToUse).pipe(
                    catchError(() => of([]))
                  );
                });

                // Si no hay observables (defensivo), retornar datos vacíos
                if (sensorEventObservables.length === 0) {
                  return of({
                    resident,
                    subscriptions: subscriptions,
                    sensorEvents: []
                  } as ResidentSensorData);
                }

                return forkJoin(sensorEventObservables).pipe(
                  map(allSensorEvents => {
                    // Combinar todos los eventos de todos los sensores
                    const combinedEvents = allSensorEvents.flat();

                    return {
                      resident,
                      subscriptions: subscriptions,
                      sensorEvents: combinedEvents
                    } as ResidentSensorData;
                  }),
                  catchError(() => of({
                    resident,
                    subscriptions: subscriptions,
                    sensorEvents: []
                  } as ResidentSensorData))
                );
              } else {
                return of({
                  resident,
                  subscriptions: [],
                  sensorEvents: []
                } as ResidentSensorData);
              }
            }),
            catchError(() => of({
              resident,
              subscriptions: [],
              sensorEvents: []
            } as ResidentSensorData))
          )
        );

        return forkJoin(residentDataObservables);
      })
    );
  }
}
