import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HeaderContentComponent } from '../../public/components/header-content/header-content.component';
import { ResidentService } from '../../profiles/residents/services/resident.service';
import { Resident } from '../../profiles/residents/models/resident.model';
import { TranslationService } from '../../shared/services/translation.service';
import { NotificationService } from '../../shared/services/notification.service';

@Component({
  selector: 'app-create-resident',
  templateUrl: './create-resident.component.html',
  styleUrls: ['./create-resident.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HeaderContentComponent]
})
export class CreateResidentComponent implements OnInit {
  residentForm!: FormGroup;
  isSubmitting = false;
  showSuccessModal = false;
  passwordResetUrl = '';
  residentEmail = '';
  residentName = '';

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private residentService: ResidentService,
    private notificationService: NotificationService,
    private translationService: TranslationService
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.checkAuthentication();
  }

  private initializeForm(): void {
    this.residentForm = this.formBuilder.group({
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      documentType: ['', [Validators.required]],
      documentNumber: ['', [Validators.required]],
      direction: ['', [Validators.required, Validators.minLength(5)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^\d{9}$/)]],
      waterTankSize: [null, [Validators.required, Validators.min(1)]]
    });
  }

  private checkAuthentication(): void {
    const token = localStorage.getItem('auth_token');
    const user = localStorage.getItem('auth_user');

    console.log('=== VERIFICACIÓN DE AUTENTICACIÓN ===');
    console.log('Token encontrado:', token ? 'SÍ' : 'NO');
    console.log('Usuario encontrado:', user ? 'SÍ' : 'NO');

    if (!token || !user) {
      console.error('Usuario no autenticado - redirigiendo al login');
      this.notificationService.error('Por favor inicie sesión para crear residentes', 3000);
      this.router.navigate(['/login']);
      return;
    }

    try {
      const userData = JSON.parse(user);
      console.log('Datos del usuario:', userData);
    } catch (error) {
      console.error('Error parsing user data:', error);
      this.router.navigate(['/login']);
      return;
    }

    console.log('=== USUARIO AUTENTICADO CORRECTAMENTE ===');
  }

  onSubmit(): void {
    if (this.residentForm.invalid) {
      this.residentForm.markAllAsTouched();
      this.notificationService.error('Por favor complete todos los campos requeridos', 3000);
      return;
    }

    this.isSubmitting = true;

    const resident = new Resident(this.residentForm.value);
    const residentData = resident.toCreateRequest();

    console.log('Creando residente con datos:', residentData);

    this.residentService.createResident(residentData).subscribe({
      next: (response: any) => {
        console.log('Residente creado exitosamente:', response);
        this.isSubmitting = false;
        
        // Guardar datos para mostrar en el modal
        this.passwordResetUrl = response.passwordResetUrl || '';
        this.residentEmail = response.email || residentData.email;
        this.residentName = response.fullName || `${residentData.firstName} ${residentData.lastName}`;
        
        // Mostrar modal con el link
        this.showSuccessModal = true;
        
        this.notificationService.success('¡Residente creado exitosamente!', 3000);
      },
      error: (err) => {
        console.error('Error al crear el residente:', err);
        this.isSubmitting = false;
        
        const errorMessage = err.error?.message || 'Error al crear el residente. Por favor intente nuevamente.';
        this.notificationService.error(errorMessage, 5000);
      }
    });
  }

  translate(key: string): string {
    return this.translationService.translate(key);
  }

  closeModal(): void {
    this.showSuccessModal = false;
    this.router.navigate(['/residents']);
  }

  copyToClipboard(): void {
    if (this.passwordResetUrl) {
      navigator.clipboard.writeText(this.passwordResetUrl).then(() => {
        this.notificationService.success('¡Link copiado al portapapeles!', 2000);
      }).catch(err => {
        console.error('Error al copiar:', err);
        this.notificationService.error('Error al copiar el link', 2000);
      });
    }
  }
}
