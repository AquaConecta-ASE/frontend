import { Component, OnInit, Injector, AfterViewInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PredictiveAnalyticsService } from './services/predictive-analytics.service';
import { Prediction } from './model/prediction.model';
import { HeaderContentComponent } from '../../public/components/header-content/header-content.component';

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
  // Predicciones cargadas desde el backend (placeholder)
  predictions: Prediction[] = [];

  // Filtros / estado de UI
  selectedResidentId: number | null = null;
  timeWindow: '7d' | '30d' | '90d' = '30d';
  // UI: whether to show remaining stock (decreasing series) instead of daily consumption
  showRemaining = false;

  analyticsService!: PredictiveAnalyticsService;
  @ViewChild('paChart', { static: false }) paChart!: ElementRef<HTMLCanvasElement>;
  private chartInstance: Chart | null = null;

  constructor(private injector: Injector) {
    // resolver en tiempo de ejecución para evitar errores de token de inyección estáticos
    try {
      this.analyticsService = this.injector.get(PredictiveAnalyticsService as any);
    } catch (e) {
      // fallback: dejarlo indefinido — el servicio es requerido para llamadas reales
      console.warn('PredictiveAnalyticsService not available via injector', e);
    }
  }

  // --- Cálculos derivados para la plantilla (evita expresiones complejas en el HTML) ---
  avgPredictedConsumption(): number {
    if (!this.predictions || this.predictions.length === 0) return 0;
    const sum = this.predictions.reduce((acc, p) => acc + (p.predictedConsumption ?? 0), 0);
    return sum / this.predictions.length;
  }

  autoRestockCount(): number {
    if (!this.predictions) return 0;
    return this.predictions.filter(p => p.recommendedAction === 'auto_restock').length;
  }

  ngOnInit(): void {
    // Inicialmente cargamos datos mock para la visualización
    this.predictions = this.getMockPredictions();
    // Intentar cargar del servicio real (si está disponible)
    this.loadPredictions();
  }

  ngOnDestroy(): void {
    if (this.chartInstance) {
      try { this.chartInstance.destroy(); } catch (e) {}
      this.chartInstance = null;
    }
  }

  loadPredictions(): void {
    // This module is currently configured to use mock/hardcoded data only.
    // Avoid making any HTTP calls from here to prevent the app from
    // attempting to contact the backend (useful for local demos or when
    // the API is unavailable).
    this.isLoading = false;
    this.loadError = null;
    this.predictions = this.normalizePredictions(this.getMockPredictions() as any[]);
    // build chart after data is available
    setTimeout(() => this.buildChart(), 0);
  }

  // Normalize incoming predictions from backend or mocks to the internal Prediction shape
  private normalizePredictions(items: any[]): Prediction[] {
    if (!items || !Array.isArray(items)) return [];
    return items.map((it: any) => {
      const residentId = it.residentId ?? it.id ?? it.resident_id ?? null;
  const residentName = (it.residentName ?? it.name ?? it.resident_name ?? it.resident) || undefined;
      const deviceId = it.deviceId ?? it.device_id ?? undefined;
      const sensorId = it.sensorId ?? it.sensor_id ?? undefined;
      const predictedConsumption = it.predictedConsumption ?? it.predicted_consumption ?? it.predicted_amount ?? 0;
      const predictedConsumptionPerDay = it.predictedConsumptionPerDay ?? it.predicted_consumption_per_day ?? undefined;
      const predictedSeriesRaw = it.predictedSeries ?? it.series ?? it.predictions_series ?? undefined;
      let predictedSeries: {date:string; value:number}[] | undefined = undefined;
      if (Array.isArray(predictedSeriesRaw)) {
        predictedSeries = predictedSeriesRaw.map((s: any, idx: number) => {
          // try to infer date/ts and value fields
          const date = s.date ?? s.ts ?? s.timestamp ?? s.time ?? (`T${idx}`);
          const value = s.value ?? s.v ?? s.amount ?? 0;
          return { date: String(date), value: Number(value) };
        });
      }
      const restockProbability = it.restockProbability ?? it.restock_probability ?? it.restock_prob ?? undefined;
      const predictedDaysUntilEmpty = it.predictedDaysUntilEmpty ?? it.predicted_days_until_empty ?? it.days_until_empty ?? undefined;
      const recommendedAction = it.recommendedAction ?? it.recommended_action ?? it.action ?? undefined;
  const metadata = it.metadata ?? { confidence: (it.confidence ?? it.model_confidence) };

      return {
        residentId,
        residentName,
        deviceId,
        sensorId,
        predictedConsumption: Number(predictedConsumption),
        predictedConsumptionPerDay: predictedConsumptionPerDay ? Number(predictedConsumptionPerDay) : undefined,
        predictedSeries,
        restockProbability: restockProbability != null ? Number(restockProbability) : undefined,
        predictedDaysUntilEmpty: predictedDaysUntilEmpty != null ? Number(predictedDaysUntilEmpty) : undefined,
        recommendedAction: recommendedAction,
        metadata: metadata
      } as Prediction;
    });
  }

  // Helpers para UI: seleccionar residente, cambiar ventana temporal
  selectResident(residentId: number | string | null): void {
    // HTML select returns string, convert to number or null
    if (residentId === null || residentId === '' || residentId === 'null') {
      this.selectedResidentId = null;
    } else if (typeof residentId === 'string') {
      const parsed = Number(residentId);
      this.selectedResidentId = Number.isFinite(parsed) ? parsed : null;
    } else {
      this.selectedResidentId = residentId;
    }
    // rebuild chart to reflect new selection
    setTimeout(() => this.buildChart(), 0);
  }

  toggleRemaining(v: boolean) {
    this.showRemaining = !!v;
    setTimeout(() => this.buildChart(), 0);
  }

  changeWindow(win: '7d' | '30d' | '90d') {
    this.timeWindow = win;
    this.loadPredictions();
  }

  selectedResidentName(): string | null {
    if (this.selectedResidentId == null) return null;
    const p = this.predictions.find(x => x.residentId === this.selectedResidentId);
    return p ? (p.residentName || (`Resident ${p.residentId}`)) : (`Resident ${this.selectedResidentId}`);
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

  // --- Chart building and mock data ---
  private buildChart(): void {
    if (!this.paChart) return;
    const canvas = this.paChart.nativeElement as HTMLCanvasElement;

    // Determine chosen series
    let chosenPrediction = null as Prediction | null;
    if (this.selectedResidentId != null) {
      chosenPrediction = this.predictions.find(p => p.residentId === this.selectedResidentId) ?? null;
    }
    if (!chosenPrediction) {
      chosenPrediction = this.predictions.find(p => p.predictedSeries && p.predictedSeries.length) ?? null;
    }

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
      } else {
        // compute average per-day across all predictions
        const perDayValues: number[] = [];
        for (const p of this.predictions) {
          if (p.predictedConsumptionPerDay != null) perDayValues.push(Number(p.predictedConsumptionPerDay));
          else if (p.predictedConsumption != null) perDayValues.push(Number(p.predictedConsumption) / windowDays);
        }
        if (perDayValues.length) {
          perDay = perDayValues.reduce((a, b) => a + b, 0) / perDayValues.length;
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

  private getMockPredictions(): Prediction[] {
    const today = new Date();
    const makeDate = (offset: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() + offset);
      return d.toISOString().slice(0,10); // YYYY-MM-DD
    };

    return [
      { residentId: 1, residentName: 'Antonio Quezada', sensorId: 101, predictedConsumption: 140, predictedConsumptionPerDay: 4.67,
        predictedSeries: [{date:makeDate(1), value:4.3},{date:makeDate(2), value:4.6},{date:makeDate(3),value:4.8},{date:makeDate(4),value:5.0}], predictedDaysUntilEmpty:16, restockProbability:0.12, recommendedAction:'none', metadata:{confidence:0.75} },
      { residentId: 2, residentName: 'María Pérez', sensorId: 102, predictedConsumption: 240, predictedConsumptionPerDay:8.0,
        predictedSeries: [{date:makeDate(1), value:7.5},{date:makeDate(2), value:8.0},{date:makeDate(3),value:8.2},{date:makeDate(4),value:8.4}], predictedDaysUntilEmpty:3, restockProbability:0.92, recommendedAction:'alert', metadata:{confidence:0.82} },
      { residentId: 3, residentName: 'Lucía Gómez', sensorId: 103, predictedConsumption: 60, predictedConsumptionPerDay:2.0,
        predictedSeries: [{date:makeDate(1), value:1.8},{date:makeDate(2), value:2.0},{date:makeDate(3),value:2.1},{date:makeDate(4),value:2.2}], predictedDaysUntilEmpty:40, restockProbability:0.05, recommendedAction:'none', metadata:{confidence:0.68} }
    ] as Prediction[];
  }
}
