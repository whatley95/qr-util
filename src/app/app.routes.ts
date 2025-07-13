import { Routes } from '@angular/router';
import { Home } from './home/home';
import { QrGenerator } from './qr-generator/qr-generator';
import { QrScanner } from './qr-scanner/qr-scanner';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'generate', component: QrGenerator },
  { path: 'scan', component: QrScanner },
  { path: '**', redirectTo: '' }
];
