import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HeaderContentComponent } from '../../components/header-content/header-content.component';
import { HttpClient } from '@angular/common/http';
import {WaterRequestApiService} from '../../../serviceRequests/water-requests/services/water-request-api.service';
import {ResidentService} from '../../../profiles/residents/services/resident.service';
import {AuthService} from '../../../iam/application/services/auth.service';
import {catchError} from 'rxjs/operators';
import {forkJoin, of} from 'rxjs';
import {ReportdataApiService} from '../../../serviceRequests/issue-reports/services/reportdata-api.service';
import { LanguageService } from '../../../shared/services/language.service';
import { TranslationService } from '../../../shared/services/translation.service';
import { LanguageToggleComponent } from '../../../shared/components/language-toggle/language-toggle.component';
import {DeviceDataService} from '../../../profiles/providers/services/device-data.service';

@Component({
  selector: 'app-home',
  imports: [RouterLink, CommonModule, HeaderContentComponent, FormsModule, LanguageToggleComponent],
  templateUrl: './home.component.html',
  standalone: true,
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit {
  title = 'AquaConecta';
  username: string | null = null;
  userRole: string | null = null;
  showProfileDropdown: boolean = false;
  selectedLanguage: string = 'en';

  // Dashboard metrics
  waterRequestsCount: number = 0;
  waterRequestsPending: number = 0;
  reportsCount: number = 0;
  reportsActive: number = 0;
  residentsCount: number = 0;
  deviceEventsCount: number = 0;
  lastDeviceUpdate: string = 'Live';
  isAdmin: boolean = false;

  options = [
    { path: '/water-requests', name: 'Solicitud de Agua Potable' },
    { path: '/login', name: 'Iniciar Sesión' },
    { path: '/signup', name: 'Registrarse' },
    { path: '/report', name: 'Lista de Reportes' },
    { path: '/providers', name: 'Lista de proveedores' },
    { path: '/provider', name: 'Detalles del proveedor' },
    { path: '/predictive-analytics', name: 'Predictive Analytics' },
  ];
  constructor(
    private sensordataApiService: WaterRequestApiService,
    private residentService: ResidentService,
    private authService: AuthService,
    private reportdataapiservice: ReportdataApiService,
    private http: HttpClient,
    private languageService: LanguageService,
    private translationService: TranslationService,
    private sensorDataService: DeviceDataService ) {
  }
  ngOnInit(): void {
    this.loadUsername();
    this.loadDashboardData();

    // Load saved language
    const savedLanguage = localStorage.getItem('selected_language');
    if (savedLanguage) {
      this.selectedLanguage = savedLanguage;
    }

    // Subscribe to language changes
    this.languageService.currentLanguage$.subscribe(language => {
      this.selectedLanguage = language;
    });
  }

  changeLanguage(event: any): void {
    this.selectedLanguage = event.target.value;
    this.languageService.changeLanguage(this.selectedLanguage);
  }

  translate(key: string): string {
    const result = this.translationService.translate(key);
    const currentLang = this.languageService.getCurrentLanguage();
    console.log(`Translating key: ${key}, Language: ${currentLang}, Result: ${result}`);
    return result;
  }

  private loadUsername(): void {
    const storedUser = localStorage.getItem('auth_user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        this.username = user?.username || null;
        this.isAdmin = this.username === "admin";
        if(this.isAdmin) {
          this.userRole = user?.role || 'Administrator';
        } else {
          this.userRole = user?.role || 'Provider';
        }
        console.log('User role:', this.userRole, 'Is admin:', this.isAdmin);
      } catch (error) {
        console.error('Error parsing user from localStorage:', error);
        this.username = null;
        this.userRole = 'Provider';
        this.isAdmin = false;
      }
    }
  }

  // Profile dropdown methods
  toggleProfileDropdown(): void {
    this.showProfileDropdown = !this.showProfileDropdown;
  }

  getUserInitials(): string {
    if (!this.username) return 'U';
    return this.username
      .split(' ')
      .map(name => name.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  }

  logout(): void {

    // Cerrar dropdown
    this.showProfileDropdown = false;
    console.log('=== INICIO LOGOUT COMPONENT ===');

    // Verificar token ANTES del logout del servicio
    const tokenBefore = localStorage.getItem('auth_token');
    console.log('Token ANTES de llamar authService.logout():', tokenBefore ? 'Existe' : 'No existe');

    // Limpiar estado local PRIMERO
    console.log('Limpiando estado local del componente...');

    console.log('Estado local limpiado');

    // LLAMAR AL LOGOUT DEL SERVICIO
    console.log('Llamando a authService.logout()...');
    this.authService.logout();

    // Verificar token DESPUÉS del logout del servicio
    setTimeout(() => {
      const tokenAfter = localStorage.getItem('auth_token');
      console.log('Token DESPUÉS de authService.logout():', tokenAfter ? 'AÚN EXISTE!' : 'Eliminado');
      console.log('=== FIN LOGOUT COMPONENT ===');
    }, 100);    // Redirigir al login
  }

  private loadDashboardData(): void {
    this.loadWaterRequests();

    this.loadReports();

    this.loadResidents();

    this.loadDevices();
  }

  private loadWaterRequests(): void {
    // Si es admin, obtener todas las requests directamente
    if (this.isAdmin) {
      this.sensordataApiService.getAllRequests().subscribe({
        next: (allRequests) => {
          this.waterRequestsCount = allRequests.length;
          this.waterRequestsPending = allRequests.filter(req => req.status === 'RECEIVED').length;
          console.log(`Admin - Total requests: ${this.waterRequestsCount}, Pending: ${this.waterRequestsPending}`);
        },
        error: (error) => {
          console.error('Error loading all water requests for admin:', error);
          this.waterRequestsCount = 0;
          this.waterRequestsPending = 0;
        }
      });
    } else {
      // Si es proveedor, obtener solo las requests de sus residentes
      this.sensordataApiService.getProviderProfile().subscribe({
        next: (providerProfile) => {
          const authenticatedProviderId = providerProfile.id;

          // Obtener todas las requests y filtrar por providerId
          this.sensordataApiService.getAllRequests().subscribe({
            next: (allRequests) => {
              // Filtrar requests que pertenecen a residentes del proveedor
              const providerRequests = allRequests.filter(request => {
                // Asumiendo que el request tiene providerId o podemos obtenerlo del residentId
                return request.providerId === authenticatedProviderId;
              });

              this.waterRequestsCount = providerRequests.length;
              this.waterRequestsPending = providerRequests.filter(req => req.status === 'RECEIVED').length;
              console.log(`Provider - Total requests: ${this.waterRequestsCount}, Pending: ${this.waterRequestsPending}`);
            },
            error: (error) => {
              console.error('Error loading water requests for provider:', error);
              this.waterRequestsCount = 0;
              this.waterRequestsPending = 0;
            }
          });
        },
        error: (error) => {
          console.error('Error loading provider profile:', error);
          this.waterRequestsCount = 0;
          this.waterRequestsPending = 0;
        }
      });
    }
  }

  private loadReports(): void {
  this.reportdataapiservice.getProviderProfile().subscribe({
    next: (providerProfile) => {
      const authenticatedProviderId = providerProfile.id;
      console.log('🏠 Home - Proveedor autenticado:', authenticatedProviderId);

      // Llamar al endpoint para obtener los reportes del proveedor
      this.reportdataapiservice.getReportsByProviderId(authenticatedProviderId).subscribe({
        next: (reports) => {
          console.log('📊 Home - Reports cargados:', reports);

          // Calcular estadísticas
          this.reportsCount = reports.length;

          // Filtrar reportes activos (ajusta los estados según tu backend)
          this.reportsActive = reports.filter(report =>
            report.status === 'ACTIVE' ||
            report.status === 'OPEN' ||
            report.status === 'RECEIVED' ||
            report.status === 'IN_PROGRESS'
          ).length;

          console.log(`📈 Estadísticas - Total: ${this.reportsCount}, Activos: ${this.reportsActive}`);
        },
        error: (error) => {
          console.error('❌ Error loading issue-reports for provider:', error);
          // Datos de ejemplo en caso de error
          this.reportsCount = 0;
          this.reportsActive = 0;
        }
      });
    },
    error: (error) => {
      console.error('❌ Error loading provider profile:', error);
      // Datos de ejemplo en caso de error
      this.reportsCount = 0;
      this.reportsActive = 0;
    }
  });
  }

  private loadResidents(): void {
    this.residentService.getResidents().subscribe({
      next: (residents) => {
        this.residentsCount = residents.length;
        console.log(residents);
        if(!residents.length){
          this.residentsCount = 0;
        }
      },
      error: (error) => {
        console.error('Error loading residents:', error);
        // Datos de ejemplo en caso de error
        this.residentsCount = 156;
      }
    });
  }

  private loadDevices(): void {
    // Obtener todos los datos de dispositivos del proveedor autenticado
    this.sensorDataService.getCompleteSensorData().subscribe({
      next: (sensorData) => {
        // Contar todos los eventos de dispositivos
        let totalEvents = 0;

        sensorData.forEach(residentData => {
          if (residentData.sensorEvents && residentData.sensorEvents.length > 0) {
            totalEvents += residentData.sensorEvents.length;
          }
        });

        this.deviceEventsCount = totalEvents;
        this.lastDeviceUpdate = totalEvents > 0 ? 'Live' : 'No data';

        console.log(`Total device events: ${this.deviceEventsCount}`);
      },
      error: (error) => {
        console.error('Error loading device events:', error);
        // Valores por defecto en caso de error
        this.deviceEventsCount = 0;
        this.lastDeviceUpdate = 'No data';
      }
    });
  }

  private formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Live';
    if (diffInMinutes < 60) return `${diffInMinutes}min ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  }

  // Método para refrescar datos manualmente
  refreshDashboard(): void {
    this.loadDashboardData();
  }
}
