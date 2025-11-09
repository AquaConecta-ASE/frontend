import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ResidentSensorData, SensorEvent } from '../../profiles/providers/model/device-data.model';
import { HeaderContentComponent } from '../../public/components/header-content/header-content.component';
import { LanguageToggleComponent } from '../../shared/components/language-toggle/language-toggle.component';
import { TranslationService } from '../../shared/services/translation.service';
import {DeviceDataService} from '../../profiles/providers/services/device-data.service';

@Component({
  selector: 'app-sensor-monitoring',
  templateUrl: './device-monitoring.component.html',
  styleUrls: ['./device-monitoring.component.css'],
  standalone: true,
  imports: [CommonModule, HeaderContentComponent]
})
export class DeviceMonitoringComponent implements OnInit {
  residentDeviceData: ResidentSensorData[] = [];
  selectedResident: ResidentSensorData | null = null;
  selectedDevice: any = null;
  isLoading = false;
  loadError: string | null = null;
  isModalOpen = false;
  isDetailModalOpen = false;
  modalStep: 'devices' | 'details' = 'devices';

  constructor(
    private deviceDataService: DeviceDataService,
    private translationService: TranslationService
  ) {}

  translate(key: string): string {
    return this.translationService.translate(key);
  }

  ngOnInit(): void {
    this.loadDeviceData();
  }

  loadDeviceData(): void {
    this.isLoading = true;
    this.loadError = null;

    this.deviceDataService.getCompleteSensorData().subscribe({
      next: (data) => {
        this.residentDeviceData = data;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading device data:', error);
        this.loadError = this.translate('error_loading_device_data');
        this.isLoading = false;
      }
    });
  }

  selectResident(residentData: ResidentSensorData): void {
    this.selectedResident = residentData;
    this.selectedDevice = null;
    this.modalStep = 'devices';
    this.isModalOpen = true;
  }

  selectDevice(device: any): void {
    this.selectedDevice = device;
    this.modalStep = 'details';
  }

  backToDeviceList(): void {
    this.selectedDevice = null;
    this.modalStep = 'devices';
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.selectedResident = null;
    this.selectedDevice = null;
    this.modalStep = 'devices';
  }

  // Listen to global keydown events. Use Event in the parameter because
  // HostListener provides a general Event type; cast to KeyboardEvent at runtime
  // to access keyboard-specific properties safely.
  @HostListener('document:keydown', ['$event'])
  onEscapeKey(event: Event): void {
    const ke = event as KeyboardEvent;
    // Guard: only handle real keyboard events and the Escape key
    if (!ke || typeof ke.key !== 'string') return;
    if (ke.key === 'Escape' || ke.key === 'Esc') {
      if (this.isModalOpen) {
        this.closeModal();
      }
    }
  }

  retry(): void {
    this.loadDeviceData();
  }

  getStatusClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'active': return 'status-active';
      case 'inactive': return 'status-inactive';
      case 'suspended': return 'status-suspended';
      default: return 'status-unknown';
    }
  }

  getStatusText(status: string): string {
    switch (status?.toLowerCase()) {
      case 'active': return this.translate('status_active');
      case 'inactive': return this.translate('status_inactive');
      case 'suspended': return this.translate('status_suspended');
      default: return status || this.translate('status_unknown');
    }
  }

  getEventTypeClass(eventType: string): string {
    switch (eventType?.toLowerCase()) {
      case 'normal': return 'event-normal';
      case 'warning': return 'event-warning';
      case 'critical': return 'event-critical';
      case 'maintenance': return 'event-maintenance';
      case 'water-measurement': return 'event-water-measurement';
      case 'monitoring measurement': return 'event-monitoring-measurement';
      default: return 'event-unknown';
    }
  }

  getEventTypeText(eventType: string): string {
    switch (eventType?.toLowerCase()) {
      case 'normal': return this.translate('event_normal');
      case 'warning': return this.translate('event_warning');
      case 'critical': return this.translate('event_critical');
      case 'maintenance': return this.translate('event_maintenance');
      case 'water-measurement': return this.translate('event_water_measurement');
      case 'monitoring measurement': return this.translate('event_monitoring_measurement');
      default: return eventType || this.translate('event_unknown');
    }
  }

  getQualityClass(quality: string): string {
    // Mapeo de los nuevos valores de calidad del agua en inglés
    switch (quality.toLowerCase().trim()) {
      case 'excellent':
        return 'quality-excellent';
      case 'good':
        return 'quality-good';
      case 'acceptable':
        return 'quality-acceptable';
      case 'bad':
        return 'quality-bad';
      case 'non-potable':
        return 'quality-non-potable';
      case 'contaminated water':
        return 'quality-contaminated';
      case 'contaminated': // <-- Agregado para el valor recibido del backend
        return 'quality-contaminated';
      case 'without water':
        return 'quality-without-water';
      default:
        // Fallback para valores numéricos o desconocidos
        const qualityNum = parseFloat(quality);
        if (!isNaN(qualityNum)) {
          if (qualityNum >= 8) return 'quality-excellent';
          if (qualityNum >= 6) return 'quality-good';
          if (qualityNum >= 4) return 'quality-acceptable';
          return 'quality-bad';
        }
        return 'quality-bad';
    }
  }

  getLevelClass(level: string): string {
    const levelNum = parseFloat(level);
    if (levelNum >= 80) return 'level-high';
    if (levelNum >= 50) return 'level-medium';
    if (levelNum >= 20) return 'level-low';
    return 'level-critical';
  }

  hasActiveDevice(residentData: ResidentSensorData): boolean {
    return residentData.subscriptions && residentData.subscriptions.length > 0 &&
           residentData.subscriptions.some((sub: any) => sub.status.toLowerCase() === 'active');
  }

  getLatestEvent(events: SensorEvent[]): SensorEvent | null {
    return events.length > 0 ? events[events.length - 1] : null;
  }

  // Método para obtener la primera suscripción activa (para compatibilidad con el template actual)
  getActiveSubscription(residentData: ResidentSensorData): any {
    return residentData.subscriptions?.find(sub => sub.status.toLowerCase() === 'active') || null;
  }

  // Método para obtener todas las suscripciones activas
  getActiveSubscriptions(residentData: ResidentSensorData): any[] {
    return residentData.subscriptions?.filter(sub => sub.status.toLowerCase() === 'active') || [];
  }

  // Dashboard statistics methods
  getActiveDevicesCount(): number {
    return this.residentDeviceData.reduce((total: number, resident: ResidentSensorData) => {
      const activeSubscriptions = resident.subscriptions?.filter((sub: any) => sub.status.toLowerCase() === 'active') || [];
      return total + activeSubscriptions.length;
    }, 0);
  }

  getTotalEventsCount(): number {
    return this.residentDeviceData.reduce((total: number, resident: ResidentSensorData) => {
      return total + (resident.sensorEvents?.length || 0);
    }, 0);
  }

  getAverageQuality(): string {
    const activeResidents = this.residentDeviceData.filter((resident: ResidentSensorData) =>
      this.hasActiveDevice(resident) && resident.sensorEvents && resident.sensorEvents.length > 0
    );

    if (activeResidents.length === 0) {
      return '0.0';
    }

    const totalQuality = activeResidents.reduce((total, resident) => {
      const latestEvent = this.getLatestEvent(resident.sensorEvents);
      const quality = latestEvent ? parseFloat(latestEvent.qualityValue) : 0;
      return total + quality;
    }, 0);

    const average = totalQuality / activeResidents.length;
    return average.toFixed(1);
  }

  getResidentInitials(resident: ResidentSensorData): string {
    if (!resident || !resident.resident || !resident.resident.firstName) {
      return 'R';
    }

    const firstName = resident.resident.firstName.trim();
    const lastName = resident.resident.lastName?.trim() || '';

    if (!lastName) {
      return firstName.charAt(0).toUpperCase();
    } else {
      return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
    }
  }

  // Método para obtener eventos específicos de un dispositivo de un residente específico
  getDeviceEventsForResident(deviceId: number | undefined, residentData: ResidentSensorData): SensorEvent[] {
    if (deviceId === null || deviceId === undefined) return [];
    return residentData.sensorEvents.filter((event: SensorEvent) => ((event.deviceId ?? (event as any).sensorId) === deviceId));
  }

  // Método para obtener el último evento de un dispositivo específico de un residente específico
  getLatestEventForDeviceOfResident(deviceId: number | undefined, residentData: ResidentSensorData): SensorEvent | null {
    const events = this.getDeviceEventsForResident(deviceId, residentData);
    return events.length > 0 ? events[events.length - 1] : null;
  }

  // Método para obtener eventos específicos de un dispositivo
  getDeviceEvents(deviceId: number | undefined): SensorEvent[] {
    if (!this.selectedResident) return [];
    if (deviceId === null || deviceId === undefined) return [];
    return this.selectedResident.sensorEvents.filter((event: SensorEvent) => ((event.deviceId ?? (event as any).sensorId) === deviceId));
  }

  // Método para obtener el último evento de un dispositivo específico
  getLatestEventForDevice(deviceId: number | undefined): SensorEvent | null {
    const events = this.getDeviceEvents(deviceId);
    return events.length > 0 ? events[events.length - 1] : null;
  }

  // Método para verificar si un dispositivo tiene eventos recientes
  hasDeviceActivity(deviceId: number | undefined): boolean {
    return this.getDeviceEvents(deviceId).length > 0;
  }

  // Helper público: obtiene el id válido desde una suscripción (deviceId o sensorId)
  public getIdFromSubscription(sub: any): number | undefined {
    if (!sub) return undefined;
    return (sub.deviceId ?? sub.sensorId) as number | undefined;
  }

  // Nuevas funciones para el resumen inteligente del card

  // Obtener rango de calidad de todos los dispositivos activos
  getQualityRange(residentData: ResidentSensorData): string {
    const activeSubscriptions = this.getActiveSubscriptions(residentData);
    if (activeSubscriptions.length === 0) return 'N/A';

    const qualities: string[] = [];
    activeSubscriptions.forEach((subscription: any) => {
      const id = this.getIdFromSubscription(subscription);
      const latestEvent = this.getLatestEventForDeviceOfResident(id, residentData);
      if (latestEvent) {
        qualities.push(latestEvent.qualityValue);
      }
    });

    if (qualities.length === 0) return 'N/A';

    const uniqueQualities = [...new Set(qualities)];

    if (uniqueQualities.length === 1) {
      return uniqueQualities[0];
    }

    // Ordenar de mejor a peor: excellent, good, acceptable, bad, non-potable, contaminated water
    const qualityOrder = ['excellent', 'good', 'acceptable', 'bad', 'non-potable', 'contaminated'];
    const sortedQualities = uniqueQualities.sort((a, b) => {
      const indexA = qualityOrder.indexOf(a.toLowerCase().trim());
      const indexB = qualityOrder.indexOf(b.toLowerCase().trim());
      return indexA - indexB;
    });

    return `${sortedQualities[0]} - ${sortedQualities[sortedQualities.length - 1]}`;
  }

  // Verificar si hay dispositivos críticos (calidad mala o nivel bajo)
  hasCriticalDevices(residentData: ResidentSensorData): boolean {
    const activeSubscriptions = this.getActiveSubscriptions(residentData);

    return activeSubscriptions.some((subscription: any) => {
      const id = this.getIdFromSubscription(subscription);
      const latestEvent = this.getLatestEventForDeviceOfResident(id, residentData);
      if (latestEvent) {
        const levelValue = typeof latestEvent.levelValue === 'string' ?
          parseFloat(latestEvent.levelValue) : latestEvent.levelValue;
        const qualityLower = latestEvent.qualityValue.toLowerCase().trim();
        const isBadQuality = ['bad', 'non-potable', 'contaminated', 'without water'].includes(qualityLower);
        return isBadQuality || levelValue < 30;
      }
      return false;
    });
  }

  // Contar dispositivos críticos
  getCriticalDevicesCount(residentData: ResidentSensorData): number {
    const activeSubscriptions = this.getActiveSubscriptions(residentData);

    return activeSubscriptions.filter((subscription: any) => {
      const id = this.getIdFromSubscription(subscription);
      const latestEvent = this.getLatestEventForDeviceOfResident(id, residentData);
      if (latestEvent) {
        const levelValue = typeof latestEvent.levelValue === 'string' ?
          parseFloat(latestEvent.levelValue) : latestEvent.levelValue;
        const qualityLower = latestEvent.qualityValue.toLowerCase().trim();
        const isBadQuality = ['bad', 'non-potable', 'contaminated', 'without water'].includes(qualityLower);
        return isBadQuality || levelValue < 30;
      }
      return false;
    }).length;
  }

  // Obtener estado general de los dispositivos
  getDevicesStatusSummary(residentData: ResidentSensorData): string {
    const activeSubscriptions = this.getActiveSubscriptions(residentData);
    if (activeSubscriptions.length === 0) return this.translate('no_devices');

    const totalDevices = activeSubscriptions.length;
    const criticalCount = this.getCriticalDevicesCount(residentData);
    const goodCount = totalDevices - criticalCount;

    if (totalDevices === 1) {
      return criticalCount > 0 ? this.translate('critical_status') : this.translate('normal_status');
    }

    if (criticalCount === 0) {
      return `${totalDevices} ${this.translate('devices_normal')}`;
    } else if (criticalCount === totalDevices) {
      return `${totalDevices} ${this.translate('devices_critical')}`;
    } else {
      return `${goodCount} ${this.translate('devices_ok')}, ${criticalCount} ${this.translate('devices_critical_short')}`;
    }
  }

  // Obtener la calidad promedio
  getAverageQualityForResident(residentData: ResidentSensorData): string {
    const activeSubscriptions = this.getActiveSubscriptions(residentData);
    if (activeSubscriptions.length === 0) return 'N/A';

    const qualities: string[] = [];
    activeSubscriptions.forEach((subscription: any) => {
      const id = this.getIdFromSubscription(subscription);
      const latestEvent = this.getLatestEventForDeviceOfResident(id, residentData);
      if (latestEvent) {
        qualities.push(latestEvent.qualityValue);
      }
    });

    if (qualities.length === 0) return 'N/A';

    // Convertir calidades a números para calcular promedio
    const qualityValues: number[] = qualities.map(q => {
      const qualityLower = q.toLowerCase().trim();
      switch(qualityLower) {
        case 'excellent': return 6;
        case 'good': return 5;
        case 'acceptable': return 4;
        case 'bad': return 3;
        case 'non-potable': return 2;
        case 'contaminated': return 1;
        case 'without water': return 0;
        default: return 0;
      }
    });

    const sum = qualityValues.reduce((accumulator, current) => accumulator + current, 0);
    const average = sum / qualityValues.length;

    if (average >= 5.5) return 'excellent';
    if (average >= 4.5) return 'good';
    if (average >= 3.5) return 'acceptable';
    if (average >= 2.5) return 'bad';
    if (average >= 1.5) return 'non-potable';
    if (average >= 0.5) return 'contaminated';
    return 'without water';
  }

  // Obtener calidad promedio actual de todos los dispositivos activos
  getCurrentQualitySummary(residentData: ResidentSensorData): string {
    const activeSubscriptions = this.getActiveSubscriptions(residentData);
    if (activeSubscriptions.length === 0) return 'N/A';

    const qualities: string[] = [];
    activeSubscriptions.forEach((subscription: any) => {
      const id = this.getIdFromSubscription(subscription);
      const latestEvent = this.getLatestEventForDeviceOfResident(id, residentData);
      if (latestEvent) {
        qualities.push(latestEvent.qualityValue);
      }
    });

    if (qualities.length === 0) return 'N/A';

    if (activeSubscriptions.length === 1) {
      return this.translateQualityValue(qualities[0]); // Si solo hay un sensor, mostrar su valor exacto traducido
    }
    // Para múltiples sensores, calcular promedio
    return this.translateQualityValue(this.getAverageQualityForResident(residentData));
  }

  // Obtener el valor original de calidad para aplicar clases CSS (SIN traducir)
  getCurrentQualityForClass(residentData: ResidentSensorData): string {
    const activeSubscriptions = this.getActiveSubscriptions(residentData);
    if (activeSubscriptions.length === 0) return 'N/A';

    const qualities: string[] = [];
    activeSubscriptions.forEach((subscription: any) => {
      const id = this.getIdFromSubscription(subscription);
      const latestEvent = this.getLatestEventForDeviceOfResident(id, residentData);
      if (latestEvent) {
        qualities.push(latestEvent.qualityValue);
      }
    });

    if (qualities.length === 0) return 'N/A';

    if (activeSubscriptions.length === 1) {
      return qualities[0]; // Valor original sin traducir
    }
    // Para múltiples sensores, calcular promedio y retornar valor original
    return this.getAverageQualityForResident(residentData);
  }

  // Obtener nivel promedio actual de todos los dispositivos activos
  getCurrentLevelSummary(residentData: ResidentSensorData): string {
    const activeSubscriptions = this.getActiveSubscriptions(residentData);
    if (activeSubscriptions.length === 0) return 'N/A';

    const levels: number[] = [];
    activeSubscriptions.forEach((subscription: any) => {
      const id = this.getIdFromSubscription(subscription);
      const latestEvent = this.getLatestEventForDeviceOfResident(id, residentData);
      if (latestEvent) {
        const levelValue = typeof latestEvent.levelValue === 'string' ?
          parseFloat(latestEvent.levelValue) : latestEvent.levelValue;
        if (!isNaN(levelValue)) {
          levels.push(levelValue);
        }
      }
    });

    if (levels.length === 0) return 'N/A';

    if (activeSubscriptions.length === 1) {
      return `${levels[0].toFixed(2)}%`; // Si solo hay un sensor, mostrar su valor exacto con 2 decimales
    }

    // Para múltiples sensores, calcular promedio
    const averageLevel = levels.reduce((sum, level) => sum + level, 0) / levels.length;
    return `${averageLevel.toFixed(2)}%`;
  }

  // Obtener clase CSS para el nivel promedio
  getAverageLevelClass(residentData: ResidentSensorData): string {
    const levelSummary = this.getCurrentLevelSummary(residentData);
    if (levelSummary === 'N/A') return '';

    const levelValue = parseFloat(levelSummary.replace('%', ''));
    return this.getLevelClass(levelValue.toString());
  }

  // Traducir valores de calidad del agua
  translateQualityValue(quality: string): string {
    if (!quality) return 'N/A';

    const qualityLower = quality.toLowerCase().trim();
    switch (qualityLower) {
      case 'excellent':
        return this.translate('quality_excellent');
      case 'good':
        return this.translate('quality_good');
      case 'acceptable':
        return this.translate('quality_acceptable');
      case 'bad':
        return this.translate('quality_bad');
      case 'non-potable':
        return this.translate('quality_non_potable');
      case 'contaminated water':
        return this.translate('quality_contaminated_water');
      case 'without water':
        return this.translate('quality_without_water');
      default:
        return quality; // Mantener valor original si no se reconoce
    }
  }
}
