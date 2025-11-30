import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from "@angular/common/http";
import { provideAuth0 } from '@auth0/auth0-angular';
import { authHttpInterceptorFn } from '@auth0/auth0-angular';
import { environment } from '../environments/environment';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([authHttpInterceptorFn])
    ),
    provideAuth0({
      domain: 'dev-c18xi4y5iccg4xkd.us.auth0.com',
      clientId: 'H9UGPf4fDG5DoS2u7STNbBywYs28HhrN',
      authorizationParams: {
        redirect_uri: window.location.origin + '/callback',
        audience: 'https://aquaconecta-api',
        scope: 'openid profile email'
      },
      cacheLocation: 'localstorage',
      useRefreshTokens: true,
      httpInterceptor: {
        allowedList: [
          // Patrón general que captura tanto Azure como localhost
          {
            uri: 'https://aquaconecta-web-bff-gateway.azurewebsites.net/api/web/*',
            tokenOptions: {
              authorizationParams: {
                audience: 'https://aquaconecta-api',
                scope: 'openid profile email'
              }
            }
          },
          {
            uri: 'http://localhost:8080/api/v1/*',
            tokenOptions: {
              authorizationParams: {
                audience: 'https://aquaconecta-api',
                scope: 'openid profile email'
              }
            }
          },
          // BFF (Backend-for-Frontend)
          {
            uri: 'http://localhost:8081/api/web/*',
            tokenOptions: {
              authorizationParams: {
                audience: 'https://aquaconecta-api',
                scope: 'openid profile email'
              }
            }
          }
        ]
      }
    })
  ]
}
