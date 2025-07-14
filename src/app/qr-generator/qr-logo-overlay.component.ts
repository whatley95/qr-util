// This component has been replaced by QrWithLogoComponent
// Keeping the file as a placeholder to prevent build errors
// but it's no longer used in the application

import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-qr-logo-overlay',
  standalone: true,
  imports: [CommonModule],
  template: `<div></div>`,
})
export class QrLogoOverlayComponent {
  @Input() logoUrl: string | null = null;
  @Input() addLogo: boolean = false;
  @Input() logoSize: number = 60;
  @Input() size: number = 200;
}
