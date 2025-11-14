import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { TranslationService } from '../../shared/services/translation.service';
import { LanguageService } from '../../shared/services/language.service';
import { NotificationService } from '../../shared/services/notification.service';
import { subscriptionTranslations } from './translations';
import { environment } from '../../../environments/environment';

export interface AddSubscriptionData {
  residentId: number;
}

@Component({
  selector: 'app-add-subscription-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule
  ],
  templateUrl: './add-subscription-dialog.component.html',
  styleUrls: ['./add-subscription-dialog.component.css']
})
export class AddSubscriptionDialogComponent implements OnInit, OnDestroy {
  subscriptionForm: FormGroup;
  isLoading = false;
  error: string | null = null;

  // Estado del formulario y pago simplificado
  paymentAmount = 0;
  showPaymentForm = false;
  subscriptionCreated = false;
  createdSubscription: any = null;
  readonly FIXED_PRICE = 200; // Precio fijo por dispositivo e instalación en soles

  constructor(
    private dialogRef: MatDialogRef<AddSubscriptionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AddSubscriptionData,
    private formBuilder: FormBuilder,
    private http: HttpClient,
    private translationService: TranslationService,
    private languageService: LanguageService,
    private notificationService: NotificationService
  ) {
    this.subscriptionForm = this.formBuilder.group({
      waterTankSize: ['', [Validators.required, Validators.min(1), Validators.pattern('^[0-9]+$')]]
    });
  }

  ngOnInit(): void {
    this.setupFormValidation();
  }
  ngOnDestroy(): void {
    // no-op
  }

  private setupFormValidation(): void {
    this.subscriptionForm.get('waterTankSize')?.valueChanges.subscribe(value => {
      if (value && this.subscriptionForm.get('waterTankSize')?.valid) {
        this.calculatePaymentAmount(value);
        this.showPaymentForm = true;
      } else {
        this.showPaymentForm = false;
        this.paymentAmount = 0;
      }
    });
  }

  private calculatePaymentAmount(liters: number): void {
    this.paymentAmount = this.FIXED_PRICE; // Precio fijo por dispositivo e instalación
  }

  private loadMercadoPagoScript(): void {
    // MercadoPago removed - no external script required
  }

  private createSubscription(): void {
    const subscriptionData = {
      residentId: this.data.residentId,
      waterTankSize: this.subscriptionForm.get('waterTankSize')?.value
    };

    const token = localStorage.getItem('auth_token');
          if (!token) {
        this.isLoading = false;
        this.error = this.translate('session_expired');
        return;
      }

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });

    this.http.post(`${environment.serverBasePath}subscriptions`, subscriptionData, { headers })
      .subscribe({
        next: (response) => {
          this.isLoading = false;

          // Mostrar mensaje de confirmación de suscripción creada
          this.notificationService.success(this.translate('subscription_created_success'), 6000);

          // Mantener el diálogo abierto (no redirigir ni cerrar)
          this.subscriptionCreated = true;
          this.createdSubscription = response;
        },
        error: (error) => {
          this.isLoading = false;
          console.error('Error al crear suscripción:', error);

          if (error.status === 401) {
            this.error = this.translate('session_expired');
          } else if (error.status === 400) {
            this.error = this.translate('invalid_data');
          } else {
            this.error = this.translate('error_creating_subscription');
          }
        }
      });
  }
  openPaymentModal(): void {
    // removed: MercadoPago modal
  }
  onSubmit(): void {
    if (this.subscriptionForm.valid) {
      // Directly create subscription without any payment gateway
      this.isLoading = true;
      this.createSubscription();
    }
  }

  onCancel(): void {
    this.dialogRef.close({ success: false });
  }

  getErrorMessage(fieldName: string): string {
    const field = this.subscriptionForm.get(fieldName);
    if (field?.hasError('required')) {
      return this.translate('field_required');
    }
    if (field?.hasError('min')) {
      return this.translate('value_must_be_greater');
    }
    if (field?.hasError('pattern')) {
      return this.translate('only_integers_allowed');
    }
    return '';
  }

  translate(key: string): string {
    const currentLang = this.languageService.getCurrentLanguage();
    const translations = subscriptionTranslations[currentLang as keyof typeof subscriptionTranslations];
    return translations?.[key as keyof typeof translations] || key;
  }
}
