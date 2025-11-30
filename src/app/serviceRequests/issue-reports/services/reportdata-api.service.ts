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
   * Usa el endpoint /providers/me/profile con el token JWT
   * Devuelve: { id (providerId), userId, taxName, ruc, email, phone, etc. }
   */
  getProviderProfile(): Observable<any> {
    console.log('=== GET PROVIDER PROFILE (Issue Reports) ===');
    console.log('📡 Usando endpoint: /providers/me/profile');
    console.log('🔑 Autenticación: Token JWT en headers');
    
    const endpoint = `${this.basePath}providers/me/profile`;
    console.log('🌐 URL completa:', endpoint);
    
    return this.http.get<any>(endpoint, this.httpOptions);
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
