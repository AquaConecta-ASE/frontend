import { Component, OnInit, Injector, AfterViewInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PredictiveAnalyticsService } from '../services/predictive-analytics.service';
import { Prediction, PredictionResponse, ConsumptionRecord } from '../model/prediction.model';
import { HeaderContentComponent } from '../../../public/components/header-content/header-content.component';
import { DeviceDataService } from '../../../profiles/providers/services/device-data.service';
import { ResidentSensorData } from '../../../profiles/providers/model/device-data.model';
import { forkJoin } from 'rxjs';

import Chart from 'chart.js/auto';

@Component({
  selector: 'app-predictive-analytics',
  standalone: true,
  imports: [CommonModule, HeaderContentComponent],
  templateUrl: './predictive-analytics.component.html',
  styleUrls: ['./predictive-analytics.component.css']
})

export class PredictiveAnalyticsComponent implements OnInit, AfterViewInit, OnDestroy {
  isLoading = false;
  loadError: string | null = null;
  
  // NEW: Support for multiple subscriptions per resident
  allPredictions: Prediction[] = []; // All predictions for selected resident
  selectedPrediction: Prediction | null = null; // Currently selected subscription prediction
  
  // Consumption history (for additional charts/insights)
  consumptionHistory: ConsumptionRecord[] = [];
  
  // NEW: Prediction history for selected subscription
  predictionHistory: Prediction[] = []; // All historical predictions (ACTIVE + OUTDATED)
  showPredictionHistory = false; // Toggle to show/hide history section
  
  // Residents from provider
  residents: ResidentSensorData[] = [];
  
  // Filtros / estado de UI
  selectedResidentId: number | null = null;
  selectedResident: ResidentSensorData | null = null;
  selectedSubscriptionId: number | null = null; // NEW: Selected subscription/tank
  timeWindow: '7d' | '30d' | '90d' = '7d'; // Backend returns 7-day predictions
  // UI: whether to show remaining stock (decreasing series) instead of daily consumption
  showRemaining = false;
  // UI: show resident selector modal
  showResidentSelector = false;
  // UI: show subscription selector
  showSubscriptionList = false; // NEW: Show list of subscriptions/tanks

  analyticsService!: PredictiveAnalyticsService;
  deviceDataService!: DeviceDataService;
  @ViewChild('paChart', { static: false }) paChart!: ElementRef<HTMLCanvasElement>;
  private chartInstance: Chart | null = null;

  constructor(private injector: Injector) {
    // resolver en tiempo de ejecución para evitar errores de token de inyección estáticos
    try {
      this.analyticsService = this.injector.get(PredictiveAnalyticsService as any);
      this.deviceDataService = this.injector.get(DeviceDataService as any);
    } catch (e) {
      console.warn('Services not available via injector', e);
    }
  }

  ngOnInit(): void {
    // Check if authentication token is available
    const token = localStorage.getItem('auth_token');
    if (!token) {
      console.warn('⚠️ No authentication token found. API requests may fail with 401 Unauthorized.');
      this.loadError = 'Authentication required. Please log in.';
      return;
    }
    
    // Load residents from provider
    this.loadResidents();
  }

  /**
   * Load residents from DeviceDataService
   */
  private loadResidents(): void {
    if (!this.deviceDataService) {
      this.loadError = 'Device data service not available';
      return;
    }

    this.isLoading = true;
    this.deviceDataService.getCompleteSensorData().subscribe({
      next: (data) => {
        this.residents = data;
        this.isLoading = false;
        
        if (this.residents.length === 0) {
          this.loadError = 'No residents found for this provider';
        }
      },
      error: (err) => {
        console.error('Error loading residents:', err);
        this.loadError = 'Error loading residents';
        this.isLoading = false;
      }
    });
  }

  ngOnDestroy(): void {
    if (this.chartInstance) {
      try { this.chartInstance.destroy(); } catch (e) {}
      this.chartInstance = null;
    }
  }

  /**
   * Open resident selector modal
   */
  openResidentSelector(): void {
    this.showResidentSelector = true;
  }

  /**
   * Close resident selector modal
   */
  closeResidentSelector(): void {
    this.showResidentSelector = false;
  }

  /**
   * Select a resident and load ALL their predictions (all subscriptions)
   */
  selectResidentFromList(resident: ResidentSensorData): void {
    this.selectedResident = resident;
    this.selectedResidentId = resident.resident.id;
    this.showResidentSelector = false;
    this.loadAllPredictionsForResident(resident.resident.id);
  }

  /**
   * Load ALL predictions for a resident (all subscriptions/tanks)
   */
  private loadAllPredictionsForResident(residentId: number): void {
    if (!this.analyticsService) {
      this.loadError = 'Analytics service not available';
      return;
    }

    this.isLoading = true;
    this.loadError = null;

    this.analyticsService.getAllPredictionsForResident(residentId).subscribe({
      next: (responses: PredictionResponse[]) => {
        if (responses && responses.length > 0) {
          // Convert all predictions
          this.allPredictions = responses.map(r => this.convertBackendResponseToInternal(r));
          
          // Add resident name to all predictions
          const resident = this.residents.find(r => r.resident.id === residentId);
          if (resident) {
            const fullName = `${resident.resident.firstName} ${resident.resident.lastName}`;
            this.allPredictions.forEach(p => {
              p.residentName = fullName;
              // Try to find subscription name from subscriptions array
              const subscription = resident.subscriptions?.find(s => s.id === p.subscriptionId);
              if (subscription) {
                p.subscriptionName = `Subscription #${subscription.id}`;
              }
            });
          }
          
          // Auto-select first subscription
          if (this.allPredictions.length > 0) {
            this.selectSubscription(this.allPredictions[0]);
          }
          
          this.showSubscriptionList = responses.length > 1; // Show list if multiple subscriptions
        } else {
          this.allPredictions = [];
          this.selectedPrediction = null;
          this.loadError = 'No predictions available for this resident. Generate predictions for their subscriptions first.';
        }
        this.isLoading = false;
      },
      error: (err: any) => {
        console.error('Error loading predictions:', err);
        this.loadError = 'Error loading predictions from API';
        this.isLoading = false;
      }
    });
  }

  /**
   * Select a specific subscription to view
   */
  selectSubscription(prediction: Prediction): void {
    this.selectedPrediction = prediction;
    this.selectedSubscriptionId = prediction.subscriptionId || null;
    
    // Only load consumption history and prediction history if subscriptionId is available
    if (prediction.subscriptionId) {
      // Load consumption history for this subscription
      this.loadConsumptionHistory(prediction.subscriptionId);
      
      // Load prediction history for this subscription
      this.loadPredictionHistory(prediction.subscriptionId);
    } else {
      console.warn('SubscriptionId not available in prediction. Cannot load consumption/prediction history.');
      this.consumptionHistory = [];
      this.predictionHistory = [];
    }
    
    // Rebuild chart
    setTimeout(() => this.buildChart(), 0);
  }

  /**
   * Generate prediction for a specific subscription
   */
  generatePredictionForSubscription(subscriptionId: number): void {
    if (!this.selectedResidentId) {
      this.loadError = 'No resident selected';
      return;
    }

    if (!this.analyticsService) return;

    this.isLoading = true;
    this.analyticsService.generatePredictionForSubscription(subscriptionId, this.selectedResidentId).subscribe({
      next: (response: PredictionResponse | null) => {
        if (response) {
          console.log('Prediction generated successfully:', response);
          // Reload all predictions for the resident
          this.loadAllPredictionsForResident(this.selectedResidentId!);
        } else {
          this.loadError = 'Failed to generate prediction. Ensure subscription has at least 7 days of data.';
          this.isLoading = false;
        }
      },
      error: (err: any) => {
        console.error('Error generating prediction:', err);
        this.loadError = err?.message || 'Error generating prediction. Minimum 7 days of data required.';
        this.isLoading = false;
      }
    });
  }

  /**
   * Clear selection and return to resident list
   */
  clearSelection(): void {
    this.selectedResidentId = null;
    this.selectedResident = null;
    this.selectedSubscriptionId = null;
    this.selectedPrediction = null;
    this.allPredictions = [];
    this.consumptionHistory = [];
    this.predictionHistory = [];
    this.showPredictionHistory = false;
    this.showSubscriptionList = false;
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }
  }

  /**
   * Convert backend PredictionResponse to internal Prediction model
   */
  private convertBackendResponseToInternal(response: PredictionResponse): Prediction {
    // Map next7DaysPredictions to predictedSeries
    const predictedSeries = response.next7DaysPredictions?.map(day => ({
      date: day.date,
      value: day.predictedConsumption
    })) || [];

    return {
      subscriptionId: response.subscriptionId || undefined, // OPTIONAL: Backend should provide this
      residentId: response.residentId,
      residentName: undefined, // Will be populated from residents service if needed
      subscriptionName: undefined, // Will be populated from subscriptions list
      deviceId: undefined,
      sensorId: undefined,
      predictedConsumption: response.totalPredictedConsumption7Days || 0,
      predictedConsumptionPerDay: response.dailyAverageConsumption,
      predictedSeries: predictedSeries,
      restockProbability: undefined, // Not in backend response, could be computed
      predictedDaysUntilEmpty: response.daysUntilRunout,
      recommendedAction: this.computeRecommendedAction(response),
      metadata: {
        confidence: response.confidenceScore,
        window: '7d' // Backend returns 7-day predictions
      },
      currentWaterLevel: response.currentWaterLevel,
      waterRunoutDate: response.waterRunoutDate,
      totalPredictedConsumption7Days: response.totalPredictedConsumption7Days,
      refillInfo: response.refillInfo,
      status: response.status,
      predictionDate: response.predictionDate
    };
  }

  /**
   * Compute recommended action based on backend data
   */
  private computeRecommendedAction(response: PredictionResponse): 'none' | 'alert' | 'auto_restock' {
    if (response.daysUntilRunout <= 2) {
      return 'auto_restock';
    } else if (response.daysUntilRunout <= 5) {
      return 'alert';
    }
    return 'none';
  }

  /**
   * Load consumption history for a specific subscription
   */
  loadConsumptionHistory(subscriptionId: number): void {
    if (!this.analyticsService) return;

    this.analyticsService.getConsumptionHistory(subscriptionId).subscribe({
      next: (history: ConsumptionRecord[]) => {
        this.consumptionHistory = history;
        console.log('Consumption history loaded:', history);
      },
      error: (err: any) => {
        console.error('Error loading consumption history:', err);
        if (err.status === 401) {
          console.warn('Unauthorized: Token may be invalid or expired');
        }
        this.consumptionHistory = [];
      }
    });
  }

  /**
   * Load prediction history for a specific subscription (all predictions: ACTIVE + OUTDATED)
   */
  loadPredictionHistory(subscriptionId: number): void {
    if (!this.analyticsService || !this.selectedResidentId) return;

    this.analyticsService.getPredictionHistory(subscriptionId, this.selectedResidentId).subscribe({
      next: (responses: PredictionResponse[]) => {
        if (responses && responses.length > 0) {
          // Convert all historical predictions
          this.predictionHistory = responses.map(r => this.convertBackendResponseToInternal(r));
          console.log('Prediction history loaded:', this.predictionHistory);
        } else {
          this.predictionHistory = [];
        }
      },
      error: (err: any) => {
        console.error('Error loading prediction history:', err);
        if (err.status === 401) {
          console.warn('Unauthorized: Token may be invalid or expired for prediction history');
        } else if (err.status === 404) {
          console.info('Prediction history endpoint not found. Feature may not be implemented in backend yet.');
        }
        this.predictionHistory = [];
      }
    });
  }

  /**
   * Toggle prediction history visibility
   */
  togglePredictionHistory(): void {
    this.showPredictionHistory = !this.showPredictionHistory;
  }

  /**
   * View a specific historical prediction
   */
  viewHistoricalPrediction(prediction: Prediction): void {
    this.selectedPrediction = prediction;
    // Rebuild chart with historical data
    setTimeout(() => this.buildChart(), 0);
  }

  // UI Helper functions
  toggleRemaining(v: boolean) {
    this.showRemaining = !!v;
    setTimeout(() => this.buildChart(), 0);
  }

  selectedResidentName(): string | null {
    if (!this.selectedResident) return null;
    const r = this.selectedResident.resident;
    return `${r.firstName} ${r.lastName}`;
  }

  getResidentInitials(resident: ResidentSensorData): string {
    const firstName = resident.resident.firstName || '';
    const lastName = resident.resident.lastName || '';
    return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
  }

  formatConfidence(p: Prediction): string {
    const c = p && p.metadata ? (p.metadata.confidence ?? null) : null;
    if (c == null) return '-';
    const num = Number(c);
    if (num >= 0 && num <= 1) {
      return (num * 100).toFixed(0) + '%';
    }
    return num.toFixed(2);
  }

  ngAfterViewInit(): void {
    // Ensure the chart is (re)built when the view (canvas) is available.
    // This avoids the common problem where loadPredictions() runs before
    // the ViewChild canvas is initialized and no chart is rendered.
    setTimeout(() => {
      try {
        // only build if we have predictions or mock data
        if (!this.paChart) {
          console.debug('paChart ViewChild not available in ngAfterViewInit');
          return;
        }
        this.buildChart();
      } catch (e) {
        console.warn('Error building chart in ngAfterViewInit', e);
      }
    }, 0);
  }

  // --- Chart building ---
  private buildChart(): void {
    if (!this.paChart) return;
    const canvas = this.paChart.nativeElement as HTMLCanvasElement;

    // Use the selected prediction (subscription)
    const chosenPrediction = this.selectedPrediction;

    // Determine how many points to show based on timeWindow
    const windowDays = this.timeWindow === '7d' ? 7 : this.timeWindow === '30d' ? 30 : 90;

    // helper to build ISO date strings starting from tomorrow
    const today = new Date();
    const makeDate = (offset: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() + offset);
      return d.toISOString().slice(0, 10);
    };

    let labels: string[] = [];
    let data: number[] = [];

    if (chosenPrediction && chosenPrediction.predictedSeries && chosenPrediction.predictedSeries.length) {
      // use provided series but limit/pad to windowDays
      const series = chosenPrediction.predictedSeries.slice(0, windowDays);
      labels = series.map(s => String(s.date));
      data = series.map(s => Number(s.value));
      // if series shorter than windowDays, pad with days after the last real date
      if (labels.length < windowDays) {
        // determine last date from series or today
        let lastDate = series.length ? new Date(String(series[series.length - 1].date)) : new Date();
        for (let i = labels.length; i < windowDays; i++) {
          lastDate.setDate(lastDate.getDate() + 1);
          labels.push(lastDate.toISOString().slice(0,10));
          data.push(series.length ? data[data.length - 1] : 0);
        }
      }
    } else {
      // Build a daily series from predictedConsumptionPerDay or predictedConsumption/windowDays
      // Prefer resident-specific values if a resident is selected; otherwise compute an average per-day across predictions
      let perDay: number | null = null;
      if (chosenPrediction) {
        perDay = chosenPrediction.predictedConsumptionPerDay ?? null;
        if (perDay == null && chosenPrediction.predictedConsumption != null) {
          perDay = Number(chosenPrediction.predictedConsumption) / windowDays;
        }
      }

      for (let i = 1; i <= windowDays; i++) {
        labels.push(makeDate(i));
        data.push(perDay != null ? Number(perDay) : 0);
      }
    }

    // If user asked to see remaining stock, and we can compute it, transform data
    if (this.showRemaining) {
      // try to compute starting stock: prefer predictedDaysUntilEmpty * perDay if available
      let startStock: number | null = null;
      if (chosenPrediction && chosenPrediction.predictedDaysUntilEmpty != null) {
        // estimate per-day from data series if possible
        let estPerDay: number | null = null;
        if (chosenPrediction.predictedConsumptionPerDay != null) estPerDay = chosenPrediction.predictedConsumptionPerDay;
        else if (data && data.length) estPerDay = data[0];
        else if (chosenPrediction.predictedConsumption != null) estPerDay = chosenPrediction.predictedConsumption / windowDays;
        if (estPerDay != null) startStock = Number(chosenPrediction.predictedDaysUntilEmpty) * Number(estPerDay);
      }

      if (startStock != null) {
        // build decreasing series
        const remaining: number[] = [];
        let cur = startStock;
        for (let i = 0; i < data.length; i++) {
          cur = Math.max(0, cur - (data[i] ?? 0));
          remaining.push(Number(cur.toFixed(2)));
        }
        data = remaining;
        // change dataset label to 'Remaining stock'
      }
      // otherwise leave data as-is (consumption) if we can't compute remaining
    }

    // create/destroy Chart.js instance
    try {
      if (this.chartInstance) {
        try { this.chartInstance.destroy(); } catch(e) {}
        this.chartInstance = null;
      }

      // detect if labels look like ISO dates (YYYY-MM-DD)
      const isoDate = (lab: string) => /^\d{4}-\d{2}-\d{2}$/.test(lab);
      const labelsAreDates = labels.length > 0 && labels.every(l => isoDate(String(l)));

      this.chartInstance = new Chart(canvas, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            {
              label: chosenPrediction ? (chosenPrediction.residentName || `Resident ${chosenPrediction.residentId}`) : 'Predicted',
              data: data,
              borderColor: '#0ea5e9',
              backgroundColor: 'rgba(14,165,233,0.12)',
              tension: 0.3,
              fill: true,
              pointRadius: 4,
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: true, position: 'top' },
            tooltip: {
              enabled: true,
              callbacks: {
                title: (items: any[]) => {
                  if (!items || !items.length) return '';
                  const x = items[0].label;
                  return labelsAreDates ? `Date: ${x}` : String(x);
                },
                label: (ctx: any) => {
                  const v = ctx.formattedValue ?? ctx.raw;
                  return `${ctx.dataset.label}: ${v} L/day`;
                },
                footer: (items: any[]) => {
                  // show model confidence for the chosen resident if available
                  try {
                    if (chosenPrediction && chosenPrediction.metadata && chosenPrediction.metadata.confidence != null) {
                      const c = Number(chosenPrediction.metadata.confidence);
                      const pct = c >= 0 && c <= 1 ? (c * 100).toFixed(0) + '%' : String(c);
                      return [`Model confidence: ${pct}`];
                    }
                  } catch (e) {}
                  return [];
                }
              }
            }
          },
          scales: {
            x: { display: true, title: { display: true, text: labelsAreDates ? 'Date' : 'Period' } },
            y: { display: true, title: { display: true, text: 'Consumption (L/day)' } }
          }
        }
      });
    } catch (e) {
      console.warn('Chart.js render error', e);
    }
  }
}