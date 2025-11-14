import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { PredictionResponse, ConsumptionRecord } from '../model/prediction.model';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PredictiveAnalyticsService {
  private http = inject(HttpClient);
  private basePath: string;
  private resourceEndpoint = '/predictive-analytics';

  constructor() {
    // Use environment config or fallback to localhost
    // Ensure basePath doesn't end with '/' to avoid double slashes
    const baseUrl = environment.serverBasePath || 'http://localhost:8080/api/v1';
    this.basePath = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  }

  private get httpOptions(): { headers: HttpHeaders } {
    return {
      headers: new HttpHeaders({
        'Content-type': 'application/json'
      })
    };
  }

  private resourcePath(): string {
    return `${this.basePath}${this.resourceEndpoint}`;
  }

  /**
   * 1️⃣ Get prediction for a specific subscription (READ ONLY)
   * GET /api/v1/predictive-analytics/subscriptions/{subscriptionId}/predictions?residentId={residentId}
   */
  getPredictionBySubscription(subscriptionId: number, residentId: number): Observable<PredictionResponse | null> {
    const url = `${this.resourcePath()}/subscriptions/${subscriptionId}/predictions?residentId=${residentId}`;
    return this.http.get<PredictionResponse>(url, this.httpOptions)
      .pipe(
        catchError(error => {
          console.error('Error fetching prediction for subscription:', error);
          return of(null);
        })
      );
  }

  /**
   * 2️⃣ Generate new prediction for a subscription (ALWAYS CREATES NEW)
   * POST /api/v1/predictive-analytics/subscriptions/{subscriptionId}/predictions?residentId={residentId}
   */
  generatePredictionForSubscription(subscriptionId: number, residentId: number): Observable<PredictionResponse | null> {
    const url = `${this.resourcePath()}/subscriptions/${subscriptionId}/predictions?residentId=${residentId}`;
    return this.http.post<PredictionResponse>(url, null, this.httpOptions)
      .pipe(
        catchError(error => {
          console.error('Error generating prediction for subscription:', error);
          return of(null);
        })
      );
  }

  /**
   * 3️⃣ Get all predictions for a resident (all subscriptions)
   * GET /api/v1/predictive-analytics/residents/{residentId}/predictions
   */
  getAllPredictionsForResident(residentId: number): Observable<PredictionResponse[]> {
    const url = `${this.resourcePath()}/residents/${residentId}/predictions`;
    return this.http.get<PredictionResponse[]>(url, this.httpOptions)
      .pipe(
        catchError(error => {
          console.error('Error fetching all predictions for resident:', error);
          return of([]);
        })
      );
  }

  /**
   * 4️⃣ Get consumption history for a subscription
   * GET /api/v1/predictive-analytics/subscriptions/{subscriptionId}/consumption-history?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
   */
  getConsumptionHistory(subscriptionId: number, startDate?: string, endDate?: string): Observable<ConsumptionRecord[]> {
    let url = `${this.resourcePath()}/subscriptions/${subscriptionId}/consumption-history`;

    // Add query parameters if provided
    const params: string[] = [];
    if (startDate) params.push(`startDate=${startDate}`);
    if (endDate) params.push(`endDate=${endDate}`);
    if (params.length > 0) {
      url += '?' + params.join('&');
    }

    return this.http.get<ConsumptionRecord[]>(url, this.httpOptions)
      .pipe(
        catchError(error => {
          console.error('Error fetching consumption history:', error);
          return of([]);
        })
      );
  }

  /**
   * 5️⃣ Get prediction history for a subscription (all predictions: ACTIVE and OUTDATED)
   * GET /api/v1/predictive-analytics/subscriptions/{subscriptionId}/predictions/history?residentId={residentId}
   */
  getPredictionHistory(subscriptionId: number, residentId: number): Observable<PredictionResponse[]> {
    const url = `${this.resourcePath()}/subscriptions/${subscriptionId}/predictions/history?residentId=${residentId}`;
    return this.http.get<PredictionResponse[]>(url, this.httpOptions)
      .pipe(
        catchError(error => {
          console.error('Error fetching prediction history for subscription:', error);
          return of([]);
        })
      );
  }
}
