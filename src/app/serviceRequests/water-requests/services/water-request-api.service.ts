import { Injectable } from '@angular/core';
import {HttpClient} from "@angular/common/http";
import { Observable, throwError } from 'rxjs';
import {BaseService} from '../../../shared/services/base.service';
import {WaterRequestModel} from '../model/water-request.model';

@Injectable({
  providedIn: 'root'
})
export class WaterRequestApiService extends BaseService<WaterRequestModel> {

  constructor(http: HttpClient) {
    super(http);
    this.resourceEndpoint = 'water-supply-requests';
  }

  getProviderProfile(): Observable<any> {
    const storedUser = localStorage.getItem('auth_user');
    if (!storedUser) {
      return throwError(() => new Error('No user found in localStorage'));
    }
    const user = JSON.parse(storedUser);
    return this.http.get<any>(`${this.basePath}providers/${user.id}/profiles`, this.httpOptions);
  }

  getAllRequests(): Observable<WaterRequestModel[]> {
    return this.http.get<WaterRequestModel[]>(`${this.basePath}${this.resourceEndpoint}`, this.httpOptions);
  }
  // se obtiene el los residentes con el providerId http://localhost:8080/api/v1/residents/by-provider/providerId, este te da el id del resident(id
  getResidentsByProviderId(providerId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.basePath}residents`, this.httpOptions);
  }

  getResidentsByAdmin(): Observable<any[]> {
    return this.http.get<any[]>(`${this.basePath}residents`, this.httpOptions);
  }

  getWaterRequestsByResidentId(residentId: number): Observable<WaterRequestModel[]> {
    return this.http.get<WaterRequestModel[]>(`${this.basePath}water-supply-requests`, this.httpOptions);
  }

  // con la id del residente obtenido te devuelve todos los residentes con water request http://localhost:8080/api/v1/water-request/resident/residentId
  getResidentProfileByResidentId(residentId: number): Observable<any> {
    const url = `${this.basePath}residents/{id}?userId=${residentId}`;
    return this.http.get<any>(url, this.httpOptions);
  }

  updateDeliveredAt(id: number, status:String, deliveredAt: Date): Observable<WaterRequestModel> {
    const url = `${this.resourcePath()}/${id}`;
    // Convertir la fecha al formato ISO 8601
    const isoDate = deliveredAt.toISOString();

    const body = {
      status: status,
      deliveredAt: isoDate  // Ahora es una string en formato ISO
    };
    console.log('PUT URL:', url);
    console.log('PUT Body:', body);

    return this.http.put<WaterRequestModel>(url, body, this.httpOptions);
  }

}
