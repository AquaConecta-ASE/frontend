import { Component, OnInit, ViewChild, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialog } from '@angular/material/dialog';
import { HeaderContentComponent } from '../../../../public/components/header-content/header-content.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { TranslationService } from '../../../../shared/services/translation.service';
import { LanguageToggleComponent } from '../../../../shared/components/language-toggle/language-toggle.component';

import { Resident } from '../../models/resident.model';
import { SubscriptionModel } from '../../models/subscription.model';
import { ResidentService } from '../../services/resident.service';
import { SubscriptionService } from '../../services/subscription.service';
import { AddSubscriptionDialogComponent } from '../../../../subcriptions/add-subscription-dialog/add-subscription-dialog.component';

@Component({
  selector: 'app-resident-summary',
  standalone: true,
  imports: [
    CommonModule,
    HeaderContentComponent,
    MatTableModule,
    MatSort,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    TranslatePipe],
  templateUrl: './resident-summary.component.html',
  styleUrl: './resident-summary.component.css'
})
export class ResidentSummaryComponent implements OnInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  residentData: Resident | null = null;
  subscriptions = new MatTableDataSource<SubscriptionModel>();

  displayedColumns: string[] = ['id', 'deviceId', 'waterTankSize', 'startDate', 'endDate', 'status'];
  isLoadingResults = true;
  error: string | null = null;
  constructor(
    private route: ActivatedRoute,
    private residentService: ResidentService,
    private subscriptionService: SubscriptionService,
    private cdr: ChangeDetectorRef,
    private translationService: TranslationService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    const residentId = +this.route.snapshot.paramMap.get('id')!;
    if (!residentId) {
      this.error = 'ID de residente no válido';
      this.isLoadingResults = false;
      return;
    }

    // Cargar datos del residente
    this.residentService.getResidentById(residentId).subscribe({
      next: (resident) => {
        this.residentData = Array.isArray(resident) ? resident[0] : resident;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error cargando residente:', error);
        this.error = 'No se pudo cargar el residente';
        this.isLoadingResults = false;
      }
    });

    // Cargar suscripciones asociadas
    this.subscriptionService.getSubscriptionsByResidentId(residentId).subscribe({
      next: (subscriptions) => {
        console.log('');
        console.log('📋📋📋 SUSCRIPCIONES DEL RESIDENTE 📋📋📋');
        console.log('🆔 Resident ID:', residentId);
        console.log('📊 Total de suscripciones:', subscriptions.length);
        console.log('');
        console.log('📦 Datos completos de las suscripciones:');
        console.log(JSON.stringify(subscriptions, null, 2));
        console.log('');
        
        subscriptions.forEach((sub, index) => {
          console.log(`📌 Suscripción ${index + 1}:`);
          console.log('  - ID:', sub.id);
          console.log('  - Device ID:', sub.deviceId);
          console.log('  - Water Tank Size:', sub.waterTankSize ? `${sub.waterTankSize} L` : 'N/A');
          console.log('  - Start Date:', sub.startDate);
          console.log('  - End Date:', sub.endDate);
          console.log('  - Status:', sub.status);
          console.log('');
        });
        
        this.subscriptions.data = subscriptions;
        this.subscriptions.paginator = this.paginator;
        this.subscriptions.sort = this.sort;
        this.isLoadingResults = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error cargando suscripciones:', error);
        this.error = 'No se pudieron cargar las suscripciones';
        this.isLoadingResults = false;
      }
    });
  }
  getStatusClass(status: string): string {
    switch (status.toUpperCase()) {
      case 'ACTIVE': return 'status-active';
      case 'INACTIVE': return 'status-inactive';
      default: return 'status-unknown';
    }
  }

  getTranslatedStatus(status: string): string {
    switch (status.toUpperCase()) {
      case 'ACTIVE': return this.translationService.translate('active');
      case 'INACTIVE': return this.translationService.translate('inactive');
      case 'RECEIVED': return this.translationService.translate('received');
      case 'IN_PROGRESS': return this.translationService.translate('in_progress');
      case 'CLOSED': return this.translationService.translate('closed');
      default: return status;
    }
  }

  openAddSubscriptionDialog(): void {
    if (!this.residentData) {
      return;
    }

    const dialogRef = this.dialog.open(AddSubscriptionDialogComponent, {
      width: '500px',
      data: { residentId: this.residentData.id }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.success) {
        // Recargar las suscripciones después de agregar una nueva
        this.loadSubscriptions();
      }
    });
  }

  private loadSubscriptions(): void {
    if (!this.residentData) return;

    this.subscriptionService.getSubscriptionsByResidentId(this.residentData.id).subscribe({
      next: (subscriptions) => {
        this.subscriptions.data = subscriptions;
        this.subscriptions.paginator = this.paginator;
        this.subscriptions.sort = this.sort;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error recargando suscripciones:', error);
      }
    });
  }
}
