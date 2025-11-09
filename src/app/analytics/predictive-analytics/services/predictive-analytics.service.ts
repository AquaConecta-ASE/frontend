import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { Prediction } from '../model/prediction.model';

@Injectable({ providedIn: 'root' })
export class PredictiveAnalyticsService {
  // Ajusta basePath según tu environment/base service
  private basePath = '/api/v1/';

  constructor(private http: HttpClient) {}

  getPredictionsForProvider(window: string = '30d'): Observable<Prediction[]> {
    try {
      const stored = localStorage.getItem('auth_user');
      if (!stored) return of([]);
      const user = JSON.parse(stored);
      if (!user?.id) return of([]);

      const url = `${this.basePath}providers/${user.id}/predictions?window=${window}`;
      return this.http.get<Prediction[]>(url);
    } catch (e) {
      return of([]);
    }
  }
}
