import { Injectable } from '@angular/core';
import { HttpClient } from "@angular/common/http";
import { Observable, of, throwError } from 'rxjs';
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

  getProviderProfile(): Observable<any> {
    const storedUser = localStorage.getItem('auth_user');
    if (!storedUser) {
      return throwError(() => new Error('No user found in localStorage'));
    }
    const user = JSON.parse(storedUser);
    return this.http.get<any>(`${this.basePath}providers/${user.id}/profiles`, this.httpOptions);
  }

  getReportsByProviderId(providerId: number): Observable<IssueReportModel[]> {

    return this.http.get<IssueReportModel[]>(`${this.basePath}issue-reports`, this.httpOptions)
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
