import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
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
import { AuthService as Auth0Service } from '@auth0/auth0-angular';

@Component({
  selector: 'app-home',
  imports: [RouterLink, CommonModule, HeaderContentComponent, FormsModule, LanguageToggleComponent],
  templateUrl: './home.component.html',
  standalone: true,
  styleUrls: ['./home.component.css', './profile-warning.css']
})
export class HomeComponent implements OnInit {
  title = 'AquaConecta';
  username: string | null = null;
  userRole: string | null = null;
  showProfileDropdown: boolean = false;
  selectedLanguage: string = 'en';
  
  // Inject Auth0 service
  private auth0 = inject(Auth0Service);

  // Dashboard metrics - usar null para distinguir "cargando" de "0 real"
  waterRequestsCount: number | null = null;
  waterRequestsPending: number | null = null;
  reportsCount: number | null = null;
  reportsActive: number | null = null;
  residentsCount: number | null = null;
  deviceEventsCount: number | null = null;
  lastDeviceUpdate: string = 'Live';
  isAdmin: boolean = false;
  
  // Loading states
  isLoadingWaterRequests: boolean = true;
  isLoadingReports: boolean = true;
  isLoadingResidents: boolean = true;
  isLoadingDevices: boolean = true;
  
  // Profile warning
  showProfileWarning: boolean = false;

  options = [
    { path: '/water-requests', name: 'Solicitud de Agua Potable' },
    { path: '/login', name: 'Iniciar Sesión' },
    { path: '/signup', name: 'Registrarse' },
    { path: '/report', name: 'Lista de Reportes' },
    { path: '/providers', name: 'Lista de proveedores' },
    { path: '/provider', name: 'Detalles del proveedor' },
  ];
  constructor(
    private sensordataApiService: WaterRequestApiService,
    private residentService: ResidentService,
    private authService: AuthService,
    private reportdataapiservice: ReportdataApiService,
    private http: HttpClient,
    private languageService: LanguageService,
    private translationService: TranslationService,
    private sensorDataService: DeviceDataService,
    private router: Router ) {
  }
  ngOnInit(): void {
    this.loadUsername();
    
    // Verificar si el perfil está incompleto
    const user = this.getStoredUser();
    if (user?.profileIncomplete) {
      console.log('⚠️ Perfil incompleto detectado');
      // Mostrar notificación al usuario
      this.showProfileIncompleteWarning();
    }
    
    // Verificar si el providerId está disponible
    const hasValidProviderId = user?.providerId && !user.providerId.toString().startsWith('auth0|');
    
    if (hasValidProviderId) {
      console.log('✅ providerId disponible al cargar home:', user.providerId);
      this.loadDashboardData();
    } else {
      console.log('⚠️ providerId NO disponible, esperando...');
      
      // Reintentar cada 500ms hasta que el providerId esté disponible (máximo 10 intentos = 5 segundos)
      let attempts = 0;
      const maxAttempts = 10;
      
      const checkInterval = setInterval(() => {
        attempts++;
        const currentUser = this.getStoredUser();
        const isValid = currentUser?.providerId && !currentUser.providerId.toString().startsWith('auth0|');
        
        console.log(`🔄 Intento ${attempts}/${maxAttempts} - providerId:`, currentUser?.providerId);
        
        if (isValid) {
          console.log('✅ providerId ahora disponible:', currentUser.providerId);
          clearInterval(checkInterval);
          this.loadDashboardData();
        } else if (attempts >= maxAttempts) {
          console.error('❌ providerId no disponible después de', maxAttempts, 'intentos');
          clearInterval(checkInterval);
          // Cargar de todos modos para mostrar la UI
          this.loadDashboardData();
        }
      }, 500);
    }

    // Load saved language
    const savedLanguage = localStorage.getItem('selected_language');
    if (savedLanguage) {
      this.selectedLanguage = savedLanguage;
    }

    // Subscribe to language changes
    this.languageService.currentLanguage$.subscribe(language => {
      this.selectedLanguage = language;
    });
    
    // 🔔 ESCUCHAR cuando el perfil esté completamente cargado
    this.authService.userProfileReady$.subscribe(isReady => {
      if (isReady) {
        console.log('🔔 HomeComponent: Perfil listo detectado - recargando datos...');
        this.loadUsername();
        this.loadDashboardData();
      }
    });
  }
  
  private showProfileIncompleteWarning(): void {
    // Mostrar banner de advertencia solo si no se ha cerrado antes en esta sesión
    const hasClosedWarning = sessionStorage.getItem('profile_warning_closed');
    if (!hasClosedWarning) {
      this.showProfileWarning = true;
    }
  }
  
  closeProfileWarning(): void {
    this.showProfileWarning = false;
    sessionStorage.setItem('profile_warning_closed', 'true');
  }
  
  goToProfile(): void {
    this.router.navigate(['/provider/1/profile']);
  }
  
  private getStoredUser(): any {
    const storedUser = localStorage.getItem('auth_user');
    if (!storedUser) return null;
    try {
      return JSON.parse(storedUser);
    } catch {
      return null;
    }
  }

  changeLanguage(event: any): void {
    this.selectedLanguage = event.target.value;
    this.languageService.changeLanguage(this.selectedLanguage);
  }

  translate(key: string): string {
    return this.translationService.translate(key);
  }

  private loadUsername(): void {
    const storedUser = localStorage.getItem('auth_user');
    const authMethod = localStorage.getItem('auth_method');
    
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        this.username = user?.username || user?.name || user?.email || null;
        
        // Detectar si es admin de diferentes formas
        if (authMethod === 'auth0') {
          // Para Auth0, verificar el rol del custom claim
          const userRole = user?.role || localStorage.getItem('user_role');
          console.log('Auth0 - Rol del usuario:', userRole);
          this.isAdmin = userRole === 'admin' || userRole === 'Administrator' || userRole === 'ROLE_ADMIN';
          
          // También verificar en el array de roles
          if (user?.roles && Array.isArray(user.roles)) {
            this.isAdmin = this.isAdmin || user.roles.some((r: string) => 
              r.toLowerCase().includes('admin')
            );
          }
        } else {
          // Para login tradicional
          this.isAdmin = this.username === "admin";
        }
        
        console.log('Usuario:', this.username);
        console.log('Es admin:', this.isAdmin);
        console.log('Método de auth:', authMethod);
        
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

    // Verificar el método de autenticación
    const authMethod = localStorage.getItem('auth_method');
    console.log('Método de autenticación:', authMethod);

    // Verificar token ANTES del logout del servicio
    const tokenBefore = localStorage.getItem('auth_token');
    console.log('Token ANTES de llamar logout:', tokenBefore ? 'Existe' : 'No existe');

    // Limpiar estado local PRIMERO
    console.log('Limpiando estado local del componente...');
    console.log('Estado local limpiado');

    if (authMethod === 'auth0') {
      // Logout de Auth0
      console.log('Cerrando sesión de Auth0...');
      
      // Limpiar localStorage
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      localStorage.removeItem('auth_method');
      localStorage.removeItem('user_role');
      
      // Llamar al logout de Auth0
      this.auth0.logout({
        logoutParams: {
          returnTo: window.location.origin + '/login'
        }
      });
    } else {
      // Logout tradicional
      console.log('Llamando a authService.logout() [tradicional]...');
      this.authService.logout();
      
      // Verificar token DESPUÉS del logout del servicio
      setTimeout(() => {
        const tokenAfter = localStorage.getItem('auth_token');
        console.log('Token DESPUÉS de authService.logout():', tokenAfter ? 'AÚN EXISTE!' : 'Eliminado');
        console.log('=== FIN LOGOUT COMPONENT ===');
      }, 100);
    }
  }

  private loadDashboardData(): void {
    this.loadWaterRequests();

    this.loadReports();

    this.loadResidents();

    this.loadDevices();
  }

  private loadWaterRequests(): void {
    console.log('🌊 Iniciando carga de water requests...');
    this.isLoadingWaterRequests = true;
    
    // Si es admin, obtener todas las requests directamente
    if (this.isAdmin) {
      this.sensordataApiService.getAllRequests().subscribe({
        next: (allRequests) => {
          this.waterRequestsCount = allRequests.length;
          // Contar pendientes: RECEIVED, PENDING, In Progress, etc.
          this.waterRequestsPending = allRequests.filter(req => 
            req.status === 'RECEIVED' || 
            req.status === 'PENDING' || 
            req.status === 'Pending' ||
            req.status === 'IN_PROGRESS' ||
            req.status === 'In Progress'
          ).length;
          this.isLoadingWaterRequests = false;
          console.log(`✅ Admin - Total requests: ${this.waterRequestsCount}, Pending: ${this.waterRequestsPending}`);
        },
        error: (error) => {
          console.error('❌ Error loading all water requests for admin:', error);
          this.isLoadingWaterRequests = false;
          // No setear a 0, mantener null para indicar error
        }
      });
    } else {
      // Si es proveedor, obtener solo las requests de sus residentes
      this.sensordataApiService.getProviderProfile().subscribe({
        next: (providerProfile) => {
          if (!providerProfile || !providerProfile.id) {
            console.error('❌ Provider profile inválido:', providerProfile);
            this.isLoadingWaterRequests = false;
            return;
          }
          
          const authenticatedProviderId = providerProfile.id;
          console.log('=== HOME - WATER REQUESTS ===');
          console.log('✅ Provider profile recibido:', providerProfile);
          console.log('✅ Provider ID (providerId):', authenticatedProviderId);
          console.log('✅ User ID (userId):', providerProfile.userId);
          
          // Actualizar localStorage con providerId y userId si no existen
          const storedUser = localStorage.getItem('auth_user');
          if (storedUser) {
            const user = JSON.parse(storedUser);
            if (!user.providerId || !user.userId) {
              console.log('💾 Actualizando localStorage con providerId y userId del backend');
              const updatedUser = {
                ...user,
                providerId: providerProfile.id,
                userId: providerProfile.userId,
                taxName: providerProfile.taxName,
                ruc: providerProfile.ruc,
                firstName: providerProfile.firstName,
                lastName: providerProfile.lastName,
                email: providerProfile.email,
                phone: providerProfile.phone,
                direction: providerProfile.direction,
                documentNumber: providerProfile.documentNumber,
                documentType: providerProfile.documentType,
                companyName: providerProfile.taxName || providerProfile.firstName
              };
              localStorage.setItem('auth_user', JSON.stringify(updatedUser));
              console.log('✅ localStorage actualizado con providerId:', updatedUser.providerId);
            }
          }

          // Obtener todas las requests y filtrar por providerId
          this.sensordataApiService.getAllRequests().subscribe({
            next: (allRequests) => {
              console.log('📋 Total requests del backend:', allRequests.length);
              console.log('Todas las requests:', allRequests);
              
              // Filtrar requests que pertenecen al proveedor
              const providerRequests = allRequests.filter(request => {
                const match = request.providerId === authenticatedProviderId;
                console.log(`Request ID ${request.id}: providerId=${request.providerId}, match=${match}, status=${request.status}`);
                return match;
              });

              console.log('Requests filtradas del proveedor:', providerRequests.length);
              console.log('Requests del proveedor:', providerRequests);

              this.waterRequestsCount = providerRequests.length;
              
              // Contar pendientes/en progreso (no DELIVERED o COMPLETED)
              this.waterRequestsPending = providerRequests.filter(req => {
                const isPending = req.status === 'RECEIVED' || 
                                 req.status === 'PENDING' || 
                                 req.status === 'Pending' ||
                                 req.status === 'IN_PROGRESS' ||
                                 req.status === 'In Progress';
                console.log(`Request ${req.id}: status="${req.status}", isPending=${isPending}`);
                return isPending;
              }).length;
              
              this.isLoadingWaterRequests = false;
              console.log(`✅ Provider - Total requests: ${this.waterRequestsCount}, Pending: ${this.waterRequestsPending}`);
            },
            error: (error) => {
              console.error('❌ Error loading water requests for provider:', error);
              this.isLoadingWaterRequests = false;
              // No setear a 0, mantener null para indicar error
            }
          });
        },
        error: (error) => {
          console.error('❌ Error loading provider profile:', error);
          this.isLoadingWaterRequests = false;
          // No setear a 0, mantener null para indicar error
        }
      });
    }
  }

  private loadReports(): void {
    console.log('📋 Iniciando carga de reports...');
    this.isLoadingReports = true;
    
    this.reportdataapiservice.getProviderProfile().subscribe({
      next: (providerProfile) => {
        if (!providerProfile || !providerProfile.id) {
          console.error('❌ Provider profile inválido:', providerProfile);
          this.isLoadingReports = false;
          return;
        }
        
        const authenticatedProviderId = providerProfile.id;
        console.log('=== HOME - REPORTS ===');
        console.log('✅ Provider profile recibido:', providerProfile);
        console.log('✅ Provider ID (providerId):', authenticatedProviderId);
        console.log('✅ User ID (userId):', providerProfile.userId);
        
        // Actualizar localStorage con providerId y userId si no existen
        const storedUser = localStorage.getItem('auth_user');
        if (storedUser) {
          const user = JSON.parse(storedUser);
          if (!user.providerId || !user.userId) {
            console.log('💾 Actualizando localStorage con providerId y userId del backend');
            const updatedUser = {
              ...user,
              providerId: providerProfile.id,
              userId: providerProfile.userId,
              taxName: providerProfile.taxName,
              ruc: providerProfile.ruc,
              firstName: providerProfile.firstName,
              lastName: providerProfile.lastName,
              email: providerProfile.email,
              phone: providerProfile.phone,
              direction: providerProfile.direction,
              documentNumber: providerProfile.documentNumber,
              documentType: providerProfile.documentType,
              companyName: providerProfile.taxName || providerProfile.firstName
            };
            localStorage.setItem('auth_user', JSON.stringify(updatedUser));
            console.log('✅ localStorage actualizado con providerId:', updatedUser.providerId);
          }
        }

        // Llamar al endpoint para obtener los reportes del proveedor
        this.reportdataapiservice.getReportsByProviderId(authenticatedProviderId).subscribe({
          next: (allReports) => {
            console.log('📋 Total reportes del backend:', allReports.length);
            console.log('Todos los reportes:', allReports);

            // Filtrar reportes del proveedor
            const providerReports = allReports.filter(report => {
              const match = report.providerId === authenticatedProviderId;
              console.log(`Report ID ${report.id}: providerId=${report.providerId}, match=${match}, status=${report.status}`);
              return match;
            });

            console.log('Reportes filtrados del proveedor:', providerReports.length);

            // Calcular estadísticas
            this.reportsCount = providerReports.length;

            // Filtrar reportes activos (no cerrados)
            this.reportsActive = providerReports.filter(report => {
              const isActive = report.status === 'ACTIVE' ||
                              report.status === 'OPEN' ||
                              report.status === 'RECEIVED' ||
                              report.status === 'IN_PROGRESS' ||
                              report.status === 'In Progress' ||
                              report.status === 'Received';
              console.log(`Report ${report.id}: status="${report.status}", isActive=${isActive}`);
              return isActive;
            }).length;

            this.isLoadingReports = false;
            console.log(`✅ Home Stats - Total: ${this.reportsCount}, Activos: ${this.reportsActive}`);
          },
          error: (error) => {
            console.error('❌ Error loading issue-reports for provider:', error);
            this.isLoadingReports = false;
            // No setear a 0, mantener null para indicar error
          }
        });
      },
      error: (error) => {
        console.error('❌ Error loading provider profile:', error);
        this.isLoadingReports = false;
        // No setear a 0, mantener null para indicar error
      }
    });
  }

  private loadResidents(): void {
    console.log('👥 Iniciando carga de residents...');
    this.isLoadingResidents = true;
    
    this.residentService.getResidents().subscribe({
      next: (residents) => {
        this.residentsCount = residents.length;
        this.isLoadingResidents = false;
        console.log('✅ Residents cargados:', residents.length);
        if(!residents.length){
          this.residentsCount = 0;
        }
      },
      error: (error) => {
        console.error('❌ Error loading residents:', error);
        this.isLoadingResidents = false;
        // No setear a 0, mantener null para indicar error
      }
    });
  }

  private loadDevices(): void {
    console.log('📱 Iniciando carga de devices...');
    this.isLoadingDevices = true;
    
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
        this.isLoadingDevices = false;

        console.log(`✅ Total device events: ${this.deviceEventsCount}`);
      },
      error: (error) => {
        console.error('❌ Error loading device events:', error);
        this.isLoadingDevices = false;
        // No setear a 0, mantener null para indicar error
        this.lastDeviceUpdate = 'Error';
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
