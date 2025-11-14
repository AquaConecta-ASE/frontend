import {Component, OnInit} from '@angular/core';
import {HeaderContentComponent} from '../../../../public/components/header-content/header-content.component';
import {Subscription} from '../../model/subscription.model';
import {ActivatedRoute, Router} from '@angular/router';
import {ProviderApiServiceService} from '../../services/provider-api.service.service';
import {Resident} from '../../model/resident.model';
import {ResidentApiServiceService} from '../../services/resident-api.service.service';
import {NgForOf} from '@angular/common';
import {SubscriptionApiServiceService} from '../../services/subscription-api.service.service';
import {Provider} from '../../model/provider.model';
import {AuthService} from '../../../../iam/application/services/auth.service';
import {User} from '../../../../iam/domain/models/user.model';

import {MatPaginatorModule} from '@angular/material/paginator';
import {MatSortModule} from '@angular/material/sort';
import {MatTableDataSource, MatTableModule} from '@angular/material/table';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {CommonModule} from '@angular/common';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatDialog} from '@angular/material/dialog';

@Component({
  selector: 'app-provider-summary',
  imports: [
    HeaderContentComponent,
    CommonModule, HeaderContentComponent, MatProgressSpinnerModule, MatTableModule, MatSortModule,
    MatPaginatorModule, MatFormFieldModule, MatInputModule
],
  templateUrl: './provider-summary.component.html',
  standalone: true,
  styleUrl: './provider-summary.component.css'
})

export class ProviderSummaryComponent implements OnInit{
  resident: Resident[] = []; // Array to hold residents

  subscriptionsDataSource = new MatTableDataSource<Resident>();
  subscriptions: { [residentId: number]: Subscription[] } = {};

  provider!: Provider;
  currentUser: User | null = null;
  isAdmin: boolean = false;
  isProvider: boolean = false;

  displayedColumns: string[] = ['id', 'firts_name', 'last_name', 'phone','status'];

  providerId!: number;
  isLoading: boolean = true;

  constructor(
    private route: ActivatedRoute,
    private residentService: ResidentApiServiceService,
    private subscriptionService: SubscriptionApiServiceService,
    private providerService: ProviderApiServiceService,
    private authService: AuthService,
    private dialog: MatDialog,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Get provider_id from route parameters
    this.providerId = Number(this.route.snapshot.paramMap.get('id'));

    // Get current user and determine role
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      this.determineUserRole();
      this.loadDataBasedOnRole();
    });
  }

  private determineUserRole(): void {
    if (!this.currentUser) {
      console.error('No hay usuario autenticado');
      return;
    }

    // Determinar el rol basado en el username o roles del usuario
    // Asumiendo que los admins tienen un patrón específico o rol específico
    this.isAdmin = !!(this.currentUser.username?.includes('admin') ||
                   this.currentUser.roles?.includes('ADMIN') ||
                   this.currentUser.roles?.includes('ROLE_ADMIN'));

    this.isProvider = !this.isAdmin;

    console.log('Usuario actual:', this.currentUser);
    console.log('Es admin:', this.isAdmin);
    console.log('Es proveedor:', this.isProvider);
  }

  private loadDataBasedOnRole(): void {
    if (this.isAdmin) {
      this.loadAdminData();
    } else if (this.isProvider) {
      this.loadProviderData();
    }
  }

  private loadAdminData(): void {
    console.log('Cargando datos como ADMIN');

    // Admin puede ver todos los detalles del proveedor usando endpoint directo
    this.providerService.getProviderByIdForAdmin(this.providerId).subscribe(
      provider => {
        this.provider = provider;
        console.log('Provider details (ADMIN):', this.provider);
      },
      error => {
        console.error('Error fetching provider details (ADMIN):', error);
      }
    );

    // Admin puede ver todos los residentes del proveedor
    this.residentService.getAllResidentByProviderId(this.providerId).subscribe(
      (residents) => {
        const filteredResidents: Resident[] = [];
        residents.forEach((resident) => {
          if (resident.providerId === this.providerId) {
            // Asignar estado activo para residentes del admin también
            resident.status = resident.status || 'active';
            filteredResidents.push(resident);
          }
        });
        this.resident = filteredResidents;
        this.subscriptionsDataSource.data = this.resident;
        this.isLoading = false;
        console.log('Residentes filtrados (ADMIN):', filteredResidents);
      },
      (error) => {
        console.error('Error fetching residents (ADMIN):', error);
        this.isLoading = false;
      }
    );
  }

  private loadProviderData(): void {
    console.log('Cargando datos como PROVIDER');

    // Proveedor solo puede ver su propio perfil - usar el nuevo método
    this.providerService.getMyProfile().subscribe(
      (provider: any) => {
        this.provider = provider;
        console.log('Provider profile (PROVIDER) con ID correcto de BD:', this.provider);
        console.log('ID del provider:', this.provider.id);
      },
      (error: any) => {
        console.error('Error fetching provider profile (PROVIDER):', error);
      }
    );

    // Proveedor puede ver sus residentes
    this.residentService.getAllResidentByProviderId(this.providerId).subscribe(
      (residents) => {
        residents.forEach((resident) => {
          resident.status = 'active'; // Asignar estado activo
        });
        this.resident = residents;
        this.subscriptionsDataSource.data = this.resident;
        this.isLoading = false;
        console.log('Residentes del proveedor:', this.resident);
      },
      (error) => {
        console.error('Error fetching residents (PROVIDER):', error);
        this.isLoading = false;
      }
    );
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'inactive':
        return 'status-inective';
      case 'active':
        return 'status-active';
      default:
        return 'status-active'; // Por defecto mostrar como activo
    }
  }

  getStatusText(status: string): string {
    return status || 'active'; // Si no hay status, mostrar 'active'
  }

  goToProfile(): void {
    this.router.navigate([`/provider/${this.providerId}/profile`]);
  }

  // Método para mostrar información adicional solo para admins
  showAdminInfo(): boolean {
    return this.isAdmin;
  }

  // Método para mostrar información limitada para proveedores
  showProviderInfo(): boolean {
    return this.isProvider;
  }
}
