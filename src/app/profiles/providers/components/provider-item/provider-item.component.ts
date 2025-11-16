// provider-item.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { HeaderContentComponent } from '../../../../public/components/header-content/header-content.component';
import { ProviderApiServiceService } from '../../services/provider-api.service.service';
import { Provider } from '../../model/provider.model';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {AuthService} from '../../../../iam/application/services/auth.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { LanguageToggleComponent } from '../../../../shared/components/language-toggle/language-toggle.component';

@Component({
    selector: 'app-provider-item',
    templateUrl: './provider-item.component.html',
    styleUrls: ['./provider-item.component.css'],
    standalone: true,    imports: [
        CommonModule,
        ReactiveFormsModule,
        HeaderContentComponent,
        MatSnackBarModule,
        MatProgressSpinnerModule,
        TranslatePipe
    ]
})
export class ProviderItemComponent implements OnInit {
    profileForm!: FormGroup;
    provider!: Provider;
    providerId!: number;
    isEditing: boolean = false;
    isLoading: boolean = true;
    submitInProgress: boolean = false;
    loadError: boolean = false;
    profileExists: boolean = false; // Nuevo flag para saber si el perfil existe

    constructor(
        private formBuilder: FormBuilder,
        private providerService: ProviderApiServiceService,
        private route: ActivatedRoute,
        private router: Router,
        private snackBar: MatSnackBar,
        private authService: AuthService
) { }

    ngOnInit(): void {
        // Get provider_id from route parameters
        this.providerId = Number(this.route.snapshot.paramMap.get('id'));
        this.initializeForm();
        this.loadProviderData();

    }

    private initializeForm(): void {
        this.profileForm = this.formBuilder.group({
            companyName: ['', [Validators.required, Validators.minLength(3)]],
            documentNumber: ['', [Validators.required, Validators.pattern(/^\d{11}$/)]],
            documentType: ['RUC', [Validators.required]],
            phone: ['', [Validators.required, Validators.pattern(/^\d{9}$/)]],
            address: ['', [Validators.required, Validators.minLength(5)]],
            email: ['', [Validators.required, Validators.email]]
        });
    }

  private loadProviderData(): void {
    this.isLoading = true;
    this.loadError = false;
    this.profileExists = false;

    // Limpiar datos anteriores
    this.provider = new Provider();
    this.profileForm.reset();

    const token = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('auth_user');

    if (token && storedUser) {
      console.log('=== CARGANDO PERFIL ===');
      const user = JSON.parse(storedUser || '{}');
      console.log('Usuario en localStorage:', user);
      console.log('ID del usuario:', user.id);
      console.log('Provider ID:', user.providerId);
      console.log('Auth0 ID:', user.auth0Id);

      // Intentar obtener el perfil existente
      console.log('Obteniendo perfil del usuario autenticado...');
      this.providerService.getMyProfile().subscribe({
        next: (profileData) => {
          // ✅ PERFIL EXISTE
          console.log('✅ Perfil encontrado:', profileData);
          this.profileExists = true;
          this.provider = profileData;
          console.log('ID del perfil:', this.provider.id);
          this.populateForm();
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error al obtener los datos del perfil:', error);
          
          if (error.status === 404) {
            // ⚠️ PERFIL NO EXISTE - Habilitar modo creación
            console.log('⚠️ Perfil no encontrado (404) - Modo CREACIÓN activado');
            this.profileExists = false;
            this.isEditing = true; // Activar edición automáticamente
            this.profileForm.enable(); // Habilitar formulario
            
            // Prellenar con datos del usuario Auth0 si están disponibles
            const user = JSON.parse(storedUser || '{}');
            this.profileForm.patchValue({
              email: user.email || '',
              companyName: user.name || '',
              documentNumber: '',
              documentType: 'RUC',
              phone: '',
              address: ''
            });
            
            this.isLoading = false;
            this.snackBar.open('No se encontró un perfil. Por favor, complete sus datos.', 'Cerrar', {
              duration: 5000,
              panelClass: 'warning-snackbar'
            });
          } else {
            // Otro tipo de error
            this.loadError = true;
            this.snackBar.open('Error al cargar el perfil. Intente nuevamente.', 'Cerrar', {
              duration: 5000,
              panelClass: 'error-snackbar'
            });
            this.isLoading = false;
          }
        }
      });
    } else {
      console.log('No hay token o usuario almacenado en localStorage.');
      this.isLoading = false;
      this.snackBar.open('No se encontró sesión. Por favor, inicie sesión.', 'Cerrar', {
        duration: 5000,
        panelClass: 'warning-snackbar'
      });
    }
  }

  private populateForm(): void {
        if (!this.provider) return;

        this.profileForm.patchValue({
            companyName: this.provider.firstName || this.provider.taxName,
            documentNumber: this.provider.documentNumber || this.provider.ruc,
            documentType: this.provider.documentType || 'RUC',
            phone: this.provider.phone,
            address: this.provider.direction,
            email: this.provider.email
        });
        this.profileForm.disable(); // Initially disable form for view mode
    }

    toggleEditMode(): void {
        this.isEditing = !this.isEditing;
        if (this.isEditing) {
            this.profileForm.enable();
        } else {
            this.profileForm.disable();
            this.populateForm(); // Reset form to original values when canceling edit
        }
    }

    onSubmit(): void {
        if (this.profileForm.invalid) {
            this.markFormGroupTouched(this.profileForm);
            this.snackBar.open('Por favor corrija los errores en el formulario', 'Cerrar', {
                duration: 3000,
                panelClass: 'warning-snackbar'
            });
            return;
        }

        this.submitInProgress = true;

        if (!this.profileExists) {
            // ➕ CREAR NUEVO PERFIL
            console.log('Creando nuevo perfil...');
            console.log('Valores del formulario:', this.profileForm.value);
            
            const companyName = this.profileForm.value.companyName || '';
            
            const newProfileData = {
                firstName: companyName,
                lastName: companyName,
                email: this.profileForm.value.email || '',
                direction: this.profileForm.value.address || '',
                documentNumber: this.profileForm.value.documentNumber || '',
                documentType: this.profileForm.value.documentType || 'RUC',
                phone: this.profileForm.value.phone || ''
            };
            
            console.log('📤 Enviando datos al backend:');
            console.log('- firstName:', newProfileData.firstName);
            console.log('- lastName:', newProfileData.lastName);
            console.log('- email:', newProfileData.email);
            console.log('- direction:', newProfileData.direction);
            console.log('- documentNumber:', newProfileData.documentNumber);
            console.log('- documentType:', newProfileData.documentType);
            console.log('- phone:', newProfileData.phone);
            console.log('JSON completo:', JSON.stringify(newProfileData, null, 2));

            this.providerService.createProfile(newProfileData).subscribe({
                next: (createdProfile) => {
                    console.log('✅ Perfil creado exitosamente:', createdProfile);
                    console.log('📋 Estructura completa del perfil creado:');
                    console.log('  Respuesta completa:', JSON.stringify(createdProfile, null, 2));
                    console.log('  - createdProfile.id:', createdProfile.id);
                    console.log('  - createdProfile.userId:', createdProfile.userId);
                    console.log('  - createdProfile.profileId:', createdProfile.profileId);
                    console.log('  - createdProfile.providerId:', createdProfile.providerId);
                    
                    this.provider = createdProfile;
                    this.profileExists = true; // Ahora el perfil existe
                    this.isEditing = false;
                    this.profileForm.disable();
                    this.submitInProgress = false;
                    
                    // Actualizar localStorage con los IDs correctos
                    const storedUser = localStorage.getItem('auth_user');
                    if (storedUser) {
                        const user = JSON.parse(storedUser);
                        console.log('Usuario antes de actualizar:', user);
                        
                        // IMPORTANTE: 
                        // - userId: ID de tabla users (para crear residentes)
                        // - profileId: ID de tabla profiles
                        // - providerId: ID de tabla providers (para GET /providers/{id}/profiles)
                        const updatedUser = {
                            ...user,
                            id: createdProfile.userId || user.id,  // ← userId de la tabla users
                            userId: createdProfile.userId || user.id, // Explícito
                            profileId: createdProfile.id, // ← ID de tabla profiles (createdProfile.id es el profile)
                            providerId: createdProfile.providerId || createdProfile.id, // ← ID de tabla providers
                            companyName: createdProfile.firstName || createdProfile.taxName || newProfileData.firstName,
                            taxName: createdProfile.taxName || '',
                            email: createdProfile.email || newProfileData.email,
                            phone: createdProfile.phone || '',
                            ruc: createdProfile.ruc || '',
                            direction: createdProfile.direction || '',
                            documentNumber: createdProfile.documentNumber || '',
                            documentType: createdProfile.documentType || '',
                            firstName: createdProfile.firstName || '',
                            lastName: createdProfile.lastName || ''
                        };
                        
                        localStorage.setItem('auth_user', JSON.stringify(updatedUser));
                        console.log('✅ Usuario actualizado en localStorage:');
                        console.log('  - user.id (User ID):', updatedUser.id);
                        console.log('  - user.userId (User ID):', updatedUser.userId);
                        console.log('  - user.profileId (Profile ID):', updatedUser.profileId);
                        console.log('  - user.providerId (Provider ID):', updatedUser.providerId);
                        console.log('  - user.auth0Id:', updatedUser.auth0Id);
                        
                        // Verificar que se guardó
                        const verifyUser = JSON.parse(localStorage.getItem('auth_user') || '{}');
                        console.log('🔍 Verificación - Usuario en localStorage:');
                        console.log('  - userId:', verifyUser.userId);
                        console.log('  - profileId:', verifyUser.profileId);
                        console.log('  - providerId:', verifyUser.providerId);
                    }

                    this.snackBar.open('Perfil creado exitosamente', 'Cerrar', {
                        duration: 3000,
                        panelClass: 'success-snackbar'
                    });
                    
                    // Actualizar el formulario con los datos creados
                    this.populateForm();
                },
                error: (error) => {
                    console.error('❌ Error al crear el perfil:', error);
                    this.submitInProgress = false;

                    this.snackBar.open('Error al crear el perfil. Inténtalo nuevamente.', 'Cerrar', {
                        duration: 3000,
                        panelClass: 'error-snackbar'
                    });
                }
            });
        } else {
            // ✏️ ACTUALIZAR PERFIL EXISTENTE
            console.log('Actualizando perfil existente...');
            console.log('Valores del formulario:', this.profileForm.value);
            console.log('Provider actual:', this.provider);
            
            const companyName = this.profileForm.value.companyName || '';
            
            // Datos para actualizar PROFILE (firstName, lastName, email, etc.)
            const updatedProfileData = {
                firstName: companyName,
                lastName: companyName,
                email: this.profileForm.value.email || '',
                direction: this.profileForm.value.address || '',
                documentNumber: this.profileForm.value.documentNumber || '',
                documentType: this.profileForm.value.documentType || 'RUC',
                phone: this.profileForm.value.phone || ''
            };
            
            // Datos para actualizar PROVIDER (taxName, ruc)
            const updatedProviderData = {
                taxName: companyName,
                ruc: this.profileForm.value.documentNumber || ''
            };
            
            console.log('📤 Actualizando PROFILE:', updatedProfileData);
            console.log('📤 Actualizando PROVIDER:', updatedProviderData);

            // Actualizar ambas tablas en paralelo usando forkJoin
            forkJoin({
                profile: this.providerService.updateProfile(updatedProfileData),
                provider: this.providerService.updateProvider(updatedProviderData)
            }).subscribe({
                next: (responses) => {
                    console.log('✅ Profile actualizado:', responses.profile);
                    console.log('✅ Provider actualizado:', responses.provider);
                    
                    // Actualizar datos locales
                    this.provider = {
                        ...this.provider,
                        ...updatedProfileData,
                        taxName: updatedProviderData.taxName,
                        ruc: updatedProviderData.ruc
                    };
                    
                    this.isEditing = false;
                    this.profileForm.disable();
                    this.submitInProgress = false;

                    this.snackBar.open('Perfil y proveedor actualizados exitosamente', 'Cerrar', {
                        duration: 3000,
                        panelClass: 'success-snackbar'
                    });
                },
                error: (error) => {
                    console.error('❌ Error al actualizar:', error);
                    this.submitInProgress = false;

                    this.snackBar.open('Error al actualizar. Inténtalo nuevamente.', 'Cerrar', {
                        duration: 3000,
                        panelClass: 'error-snackbar'
                    });
                }
            });
        }
    }

    hasError(controlName: string, errorName: string): boolean {
        const control = this.profileForm.get(controlName);
        return !!(control && control.hasError(errorName) && control.touched);
    }

    goToDetails(): void {
        this.router.navigate([`/provider/${this.providerId}`]);
    }

    // Utility function to mark all controls in a form group as touched
    private markFormGroupTouched(formGroup: FormGroup) {
        Object.values(formGroup.controls).forEach(control => {
            control.markAsTouched();

            if (control instanceof FormGroup) {
                this.markFormGroupTouched(control);
            }
        });
    }

    retry(): void {
        this.loadProviderData();
    }

}
