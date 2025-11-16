import {AfterViewInit, Component, inject, ViewChild} from '@angular/core';
import {HeaderContentComponent} from '../../../../public/components/header-content/header-content.component';
import {IssueReportModel} from '../../model/issue-report.model';

import {HttpClient} from '@angular/common/http';
import {MatPaginator, MatPaginatorModule} from '@angular/material/paginator';
import {MatSort, MatSortModule, SortDirection} from '@angular/material/sort';
import {merge, Observable, of as observableOf} from 'rxjs';
import {catchError, map, startWith, switchMap} from 'rxjs/operators';
import {MatTableDataSource, MatTableModule} from '@angular/material/table';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {CommonModule, DatePipe} from '@angular/common';

import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import {ReportdataApiService} from '../../services/reportdata-api.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { TranslationService } from '../../../../shared/services/translation.service';
import { LanguageToggleComponent } from '../../../../shared/components/language-toggle/language-toggle.component';

// Interfaz para el proveedor
interface Provider {
  id: number;
  taxName: string;
}

@Component({
  selector: 'app-issue-report-list',
  imports: [CommonModule, HeaderContentComponent, MatProgressSpinnerModule, MatTableModule, MatSortModule,
    MatPaginatorModule, DatePipe, MatFormFieldModule, MatInputModule, MatSelectModule, TranslatePipe],
  templateUrl: './issue-report-list.component.html',
  standalone: true,
  styleUrl: './issue-report-list.component.css'
})
export class IssueReportListComponent implements AfterViewInit {
  username: string | null = null;
  userRole: string | null = null;
  isAdmin: boolean = false;

  // Variables para el filtro de proveedores
  providers: Provider[] = [];
  selectedProviderId: number | null = null;
  allReports: IssueReportModel[] = []; // Guardamos todos los reportes originales

  goToDetail(id: number): void {
    // Permitir navegación para todos los usuarios
    this.router.navigate(['/issue-reports', id]);
  }

  // Función para determinar si la fila es clickeable
  isRowClickable(row: any): boolean {
    return row.status !== 'Closed';
  }

  tittle = 'Lista de Reportes';

  requests: MatTableDataSource<IssueReportModel> = new MatTableDataSource<IssueReportModel>();

  displayedColumns: string[] = ['id', 'resident_name', 'title', 'emissionDate', 'status'];
  resultsLength = 0;
  isLoadingResults = true;
  isRateLimitReached = false;
  constructor(private router: Router,
              private reportdataApiService: ReportdataApiService,
              private dialog: MatDialog,
              private translationService: TranslationService) {}

  ngAfterViewInit(): void {
    // Implementar lógica necesaria aquí
  }

  ngOnInit(): void {
    this.loadUsername();
    this.getAllRequests();
    this.requests.filterPredicate = (data: IssueReportModel, filter: string) => {
      return data.id.toString().toLowerCase().includes(filter);
    };

    // Cargar proveedores solo si es admin
    if (this.isAdmin) {
      this.loadProviders();
    }
  }

  private loadUsername(): void {
    const storedUser = localStorage.getItem('auth_user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        this.username = user?.username || null;
        this.isAdmin = this.username === "admin";
        console.log(this.username);
      } catch (error) {
        console.error('Error parsing user from localStorage:', error);
        this.username = null;
        this.userRole = 'Provider';
        this.isAdmin = false;
      }
    }
  }

  // Método para cargar todos los proveedores
  private loadProviders(): void {
    this.reportdataApiService.getAllProviders().subscribe(
      (providers: Provider[]) => {
        this.providers = providers;
        console.log('Providers loaded:', this.providers);
      },
      error => {
        console.error('Error loading providers:', error);
      }
    );
  }

  // Método para filtrar por proveedor
  onProviderChange(providerId: number | null): void {
    this.selectedProviderId = providerId;

    if (providerId === null) {
      // Mostrar todos los reportes
      this.requests.data = this.allReports;
    } else {
      // Filtrar reportes por providerId
      const filteredReports = this.allReports.filter(report => report.providerId === providerId);
      this.requests.data = filteredReports;
    }

    this.resultsLength = this.requests.data.length;
  }

  getAllRequests(): void {
    this.isLoadingResults = true;

    if (this.isAdmin) {
      this.reportdataApiService.getAllReports().subscribe(
        (response) => {
          console.log('All issue-reports:', response);

          response.forEach((report) => {
            // Formatear el status de cada reporte
            if (report.status === 'IN_PROGRESS') {
              report.status = 'In Progress';
            } else if (report.status === 'CLOSED') {
              report.status = 'Closed';
            } else if (report.status === 'RECEIVED') {
              report.status = 'Received';
            }

            this.reportdataApiService.getResidentById(report.residentId).subscribe(
              (residentProfile) => {
                report.resident = residentProfile;
              },
              error => {
                console.error(`Error loading resident profile for report ID ${report.id}:`, error);
              }
            );
          });

          // Guardar todos los reportes para el filtrado
          this.allReports = response;
          this.requests.data = response;
          this.isLoadingResults = false;
          this.resultsLength = this.requests.data.length;
          console.log('Reports loaded:', this.requests.data);
        },
        error => {
          console.error('Error loading issue-reports:', error);
          this.isLoadingResults = false;
        }
      );
    } else {
      this.reportdataApiService.getProviderProfile().subscribe(
        (providerProfile) => {
          const authenticatedProviderId = providerProfile.id;
          console.log('=== PROVIDER PROFILE OBTENIDO ===');
          console.log('Perfil completo:', providerProfile);
          console.log('Provider ID autenticado:', authenticatedProviderId);

          this.reportdataApiService.getReportsByProviderId(authenticatedProviderId).subscribe(
            (response: IssueReportModel[]) => {
              console.log('=== TODOS LOS REPORTES DEL BACKEND ===');
              console.log('Total reportes recibidos:', response.length);
              console.log('Reportes completos:', response);

              // IMPORTANTE: Filtrar reportes por providerId
              const filteredReports = response.filter(report => {
                console.log(`Reporte ID ${report.id}: providerId=${report.providerId}, match=${report.providerId === authenticatedProviderId}`);
                return report.providerId === authenticatedProviderId;
              });

              console.log('=== REPORTES FILTRADOS PARA PROVIDER ===');
              console.log('Reportes filtrados:', filteredReports.length);
              console.log('IDs de reportes:', filteredReports.map(r => r.id));

              filteredReports.forEach((report) => {
                if (report.status === 'IN_PROGRESS') {
                  report.status = 'In Progress';
                } else if (report.status === 'CLOSED') {
                  report.status = 'Closed';
                } else if (report.status === 'RECEIVED') {
                  report.status = 'Received';
                }
                this.reportdataApiService.getResidentById(report.residentId).subscribe(
                  (residentProfile) => {
                    report.resident = residentProfile;
                  },
                  error => {
                    console.error(`Error loading resident profile for report ID ${report.id}:`, error);
                  }
                );
              });

              this.allReports = filteredReports;
              this.requests.data = filteredReports;
              this.isLoadingResults = false;
              this.resultsLength = this.requests.data.length;
              console.log('Reports loaded:', this.requests.data);
            },
            error => {
              console.error('Error loading issue-reports for provider:', error);
              this.isLoadingResults = false;
            }
          );
        },
        error => {
          console.error('Error loading issue-reports:', error);
          this.isLoadingResults = false;
        }
      );
    }
  }

  applyStatusFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value.trim().toLowerCase();
    this.requests.filter = filterValue;
  }

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  getStatusClass(status: string): string {
    switch (status) {
      case 'Received':
        return 'status-received';
      case 'In Progress':
        return 'status-in-progress';
      case 'Closed':
        return 'status-closed';
      default:
        return '';
    }
  }

  getTranslatedStatus(status: string): string {
    switch (status) {
      case 'Received': return this.translationService.translate('received');
      case 'In Progress': return this.translationService.translate('in_progress');
      case 'Closed': return this.translationService.translate('closed');
      case 'ACTIVE': return this.translationService.translate('active');
      case 'INACTIVE': return this.translationService.translate('inactive');
      default: return status;
    }
  }
}
