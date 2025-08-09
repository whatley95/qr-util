import { Routes } from '@angular/router';
import { Home } from './home/home';
import { QrGenerator } from './qr-generator/qr-generator';
import { QrScanner } from './qr-scanner/qr-scanner';
import { BarcodeGeneratorComponent } from './barcode/barcode-generator.component';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'generate', component: QrGenerator },
  { path: 'scan', component: QrScanner },
  { path: 'barcode/generate', component: BarcodeGeneratorComponent },
  // Point barcode scan to the unified scanner
  { path: 'barcode/scan', component: QrScanner },
  { path: '**', redirectTo: '' }
];
