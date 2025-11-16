import { Injectable } from '@angular/core';
import { HttpClient } from "@angular/common/http";
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { IssueReportModel } from '../model/issue-report.model';
import {BaseService} from '../../../shared/services/base.service';

@Injectable({
  providedIn: 'root'
})
export class ReportdataApiService extends BaseService<IssueReportModel> {
  constructor(http: HttpClient) {
    super(http);
    this.resourceEndpoint = 'issue-reports';
  }

  getAllProviders(): Observable<any[]> {
    return this.http.get<any[]>(`${this.basePath}providers`, this.httpOptions);
  }

  /**
   * Obtiene el perfil del proveedor autenticado
   * Usa el providerId del localStorage para construir la URL correcta
   */
  getProviderProfile(): Observable<any> {
    const storedUser = localStorage.getItem('auth_user');
    if (!storedUser) {
      console.error('No user found in localStorage');
      throw new Error('No user found in localStorage');
    }
    
    const user = JSON.parse(storedUser);
    const providerId = user.providerId || user.id;
    
    console.log('=== GET PROVIDER PROFILE (Issue Reports) ===');
    console.log('User from localStorage:', user);
    console.log('Provider ID to use:', providerId);
    console.log('Endpoint:', `${this.basePath}providers/${providerId}/profiles`);
    
    if (!providerId || (typeof providerId === 'string' && providerId.includes('auth0'))) {
      console.error('❌ Provider ID no válido:', providerId);
      throw new Error('Invalid provider ID');
    }
    
    return this.http.get<any>(`${this.basePath}providers/${providerId}/profiles`, this.httpOptions);
  }

  /**
   * Obtiene los reportes filtrados por providerId
   * El backend debe filtrar por providerId en el query
   */
  getReportsByProviderId(providerId: number): Observable<IssueReportModel[]> {
    console.log('=== GET REPORTS BY PROVIDER ID ===');
    console.log('Provider ID:', providerId);
    console.log('Endpoint:', `${this.basePath}issue-reports`);
    console.log('Los reportes serán filtrados en el frontend por providerId:', providerId);
    
    return this.http.get<IssueReportModel[]>(`${this.basePath}issue-reports`, this.httpOptions);
  }

  getResidentById(residentId: number): Observable<any> {
    return this.http.get<any>(`${this.basePath}residents/${residentId}`, this.httpOptions);
  }


  getReportById(id: string): Observable<IssueReportModel> {
   return this.http.get<any>(`${this.basePath}issue-reports/${id}`, this.httpOptions);
  }

  updateReport(report: IssueReportModel): Observable<IssueReportModel> {
    return this.http.put<IssueReportModel>(`${this.basePath}issue-reports/${report.id}`, report, this.httpOptions)
  }

  getAllReports(): Observable<IssueReportModel[]> {
    return this.getAll();
  }


}
