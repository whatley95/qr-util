import { Routes } from '@angular/router';
import { Home } from './home/home';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'generate', loadComponent: () => import('./qr-generator/qr-generator').then(m => m.QrGenerator) },
  { path: 'scan', loadComponent: () => import('./qr-scanner/qr-scanner').then(m => m.QrScanner) },
  { path: 'barcode/generate', loadComponent: () => import('./barcode/barcode-generator.component').then(m => m.BarcodeGeneratorComponent) },
  // Point barcode scan to the unified scanner
  { path: 'barcode/scan', loadComponent: () => import('./qr-scanner/qr-scanner').then(m => m.QrScanner) },
  { path: '**', redirectTo: '' }
];
