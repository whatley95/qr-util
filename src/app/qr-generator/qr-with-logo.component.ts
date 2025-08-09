import { Component, Input, OnChanges, SimpleChanges, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QRCodeComponent } from 'angularx-qrcode';

@Component({
  selector: 'app-qr-with-logo',
  standalone: true,
  imports: [CommonModule, QRCodeComponent],
  template: `
    <div class="qr-with-logo-container" [style.width.px]="size" [style.height.px]="size">
      <!-- Standard QR Code as base -->
      <qrcode
        #qrcode
        [qrdata]="qrdata"
        [width]="size"
        [colorDark]="colorDark"
        [colorLight]="colorLight"
        [margin]="margin"
        [errorCorrectionLevel]="errorCorrectionLevel"
        [elementType]="'svg'"
        class="qr-element"
        (qrCodeURL)="onQrCodeGenerated()">
      </qrcode>
      
      <!-- Canvas for QR code with logo -->
      <canvas 
        #qrCanvas
        [style.display]="showLogo ? 'block' : 'none'"
        [width]="size"
        [height]="size"
        class="qr-canvas">
      </canvas>
    </div>
  `,
  styles: [`
    .qr-with-logo-container {
      position: relative;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
      transition: transform 0.3s ease;
      
      &:hover {
        transform: scale(1.02);
      }
    }
    
    .qr-element {
      display: block;
    }
    
    .qr-canvas {
      position: absolute;
      top: 0;
      left: 0;
      z-index: 10;
      border-radius: 12px;
    }
  `]
})
export class QrWithLogoComponent implements OnChanges, AfterViewInit {
  @Input() qrdata: string = '';
  @Input() size: number = 200;
  @Input() colorDark: string = '#000000';
  @Input() colorLight: string = '#ffffff';
  @Input() margin: number = 4;
  @Input() errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H' = 'M';
  @Input() logoUrl: string | null = null;
  @Input() showLogo: boolean = false;
  @Input() logoSize: number = 60;

  // Gradient styling inputs
  @Input() gradientEnabled: boolean = false;
  @Input() gradientFrom: string = '#667eea';
  @Input() gradientTo: string = '#764ba2';
  @Input() gradientAngle: number = 45;
  
  @ViewChild('qrcode') qrcodeComponent!: QRCodeComponent;
  @ViewChild('qrCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  
  private qrCodeGenerated = false;
  private lastGradientId: string | null = null;
  
  ngAfterViewInit() {
    // Wait for QR code to be generated
    if (this.qrdata) {
      setTimeout(() => {
        this.applySvgGradient();
        if (this.showLogo && this.logoUrl) {
          this.renderQrWithLogo();
        }
      }, 300);
    }
  }
  
  ngOnChanges(changes: SimpleChanges) {
    // When inputs change, re-render
    if (changes['qrdata'] || changes['showLogo'] || changes['logoUrl'] || 
        changes['logoSize'] || changes['size'] || changes['colorDark'] || 
        changes['colorLight'] || changes['errorCorrectionLevel'] ||
        changes['gradientEnabled'] || changes['gradientFrom'] || changes['gradientTo'] || changes['gradientAngle']) {
      if (this.qrCodeGenerated) {
        // Re-apply gradient to current SVG
        setTimeout(() => this.applySvgGradient(), 0);
        // Re-render logo overlay if present
        if (this.showLogo && this.logoUrl) {
          setTimeout(() => this.renderQrWithLogo(), 300);
        }
      }
    }
  }
  
  onQrCodeGenerated() {
    this.qrCodeGenerated = true;
    // Apply gradient after QR is rendered
    this.applySvgGradient();
    if (this.showLogo && this.logoUrl) {
      this.renderQrWithLogo();
    }
  }

  private getSvgElement(): SVGElement | null {
    if (this.qrcodeComponent && this.qrcodeComponent.qrcElement) {
      const el = this.qrcodeComponent.qrcElement.nativeElement as HTMLElement;
      return el.querySelector('svg');
    }
    return null;
  }

  private applySvgGradient(): void {
    const svg = this.getSvgElement();
    if (!svg) return;

    // If disabled, clear any existing gradient and restore dark fills only
    if (!this.gradientEnabled) {
      this.clearSvgGradient(svg);
      return;
    }

    // Ensure a defs element exists
    let defs = svg.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      svg.insertBefore(defs, svg.firstChild);
    }

    // Remove previous gradient if exists
    if (this.lastGradientId) {
      const old = svg.querySelector(`#${this.lastGradientId}`);
      old?.parentElement?.removeChild(old);
    }

    // Create a unique gradient id
    const gradId = `qr-grad-${Date.now()}`;
    this.lastGradientId = gradId;

    const grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    grad.setAttribute('id', gradId);
    grad.setAttribute('gradientUnits', 'objectBoundingBox');

    // Compute endpoints from angle
    const theta = (this.gradientAngle % 360) * Math.PI / 180;
    const x1 = 0.5 - 0.5 * Math.cos(theta);
    const y1 = 0.5 - 0.5 * Math.sin(theta);
    const x2 = 0.5 + 0.5 * Math.cos(theta);
    const y2 = 0.5 + 0.5 * Math.sin(theta);
    grad.setAttribute('x1', `${x1}`);
    grad.setAttribute('y1', `${y1}`);
    grad.setAttribute('x2', `${x2}`);
    grad.setAttribute('y2', `${y2}`);

    const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', this.gradientFrom);

    const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', this.gradientTo);

    grad.appendChild(stop1);
    grad.appendChild(stop2);

    defs.appendChild(grad);

    // Apply gradient fill ONLY to modules that are using the dark color now
    const dark = (this.colorDark || '').toLowerCase();
    const candidates = Array.from(svg.querySelectorAll('path')) as SVGPathElement[];
    candidates
      .filter(p => {
        const f = (p.getAttribute('fill') || '').toLowerCase();
        return f === dark || f === '#000' || f === '#000000' || f === 'black';
      })
      .forEach(p => p.setAttribute('fill', `url(#${gradId})`));
  }

  private clearSvgGradient(svg?: SVGElement): void {
    const el = svg || this.getSvgElement();
    if (!el) return;

    // Restore only elements that used our gradient back to colorDark
    const gradSelector = this.lastGradientId ? `path[fill="url(#${this.lastGradientId})"]` : 'path[fill^="url(#qr-grad-"]';
    const toRestore = el.querySelectorAll(gradSelector);
    toRestore.forEach(p => (p as SVGPathElement).setAttribute('fill', this.colorDark));

    if (this.lastGradientId) {
      const old = el.querySelector(`#${this.lastGradientId}`);
      old?.parentElement?.removeChild(old);
      this.lastGradientId = null;
    }
  }
  
  renderQrWithLogo() {
    if (!this.showLogo || !this.logoUrl || !this.canvasRef) {
      return;
    }
    
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      console.error('Could not get 2D context for canvas');
      return;
    }
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Try to find the QR code SVG using the component reference
    const qrElement = this.getSvgElement();
    if (!qrElement) {
      console.error('QR code SVG element not found');
      return;
    }
    
    // Draw the QR code to canvas
    const image = new Image();
    const svgData = new XMLSerializer().serializeToString(qrElement);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(svgBlob);
    image.src = url;
    
    image.onload = () => {
      // Draw QR code (with any gradient applied)
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      
      // Add logo if provided
      if (this.logoUrl) {
        const logoImg = new Image();
        logoImg.onload = () => {
          const qrSize = Math.min(canvas.width, canvas.height);
          const calculatedLogoSize = this.logoSize ? Math.min(this.logoSize, qrSize * 0.2) : qrSize * 0.15;
          const finalLogoSize = Math.min(calculatedLogoSize, qrSize * 0.2);
          const logoX = (canvas.width - finalLogoSize) / 2;
          const logoY = (canvas.height - finalLogoSize) / 2;
          
          ctx.save();
          ctx.beginPath();
          const padding = Math.max(10, finalLogoSize * 0.15);
          ctx.arc(logoX + finalLogoSize / 2, logoY + finalLogoSize / 2, (finalLogoSize / 2) + padding, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          
          ctx.beginPath();
          ctx.arc(logoX + finalLogoSize / 2, logoY + finalLogoSize / 2, finalLogoSize / 2, 0, Math.PI * 2);
          ctx.clip();
          
          ctx.drawImage(logoImg, logoX, logoY, finalLogoSize, finalLogoSize);
          ctx.restore();
          
          URL.revokeObjectURL(url);
        };
        logoImg.src = this.logoUrl;
      } else {
        URL.revokeObjectURL(url);
      }
    };
  }
  
  // Public method that can be called externally to ensure logo is rendered
  public refreshLogoRendering(): Promise<boolean> {
    return new Promise((resolve) => {
      // Ensure gradient is applied before capturing
      this.applySvgGradient();
      if (this.showLogo && this.logoUrl) {
        this.renderQrWithLogo();
        setTimeout(() => {
          resolve(true);
        }, 300);
      } else {
        resolve(false);
      }
    });
  }
  
  /**
   * Evaluates whether the current logo size is likely to make the QR code readable
   * @returns An assessment of QR code readability with current logo
   */
  public assessLogoImpact(): {readable: boolean, recommendations: string} {
    if (!this.showLogo || !this.logoUrl) {
      return {readable: true, recommendations: 'No logo present.'};
    }
    
    const qrSize = this.size;
    const logoPercentage = (this.logoSize / qrSize) * 100;
    const usingHighErrorCorrection = this.errorCorrectionLevel === 'H';
    
    if (!usingHighErrorCorrection) {
      return {
        readable: false, 
        recommendations: 'Using a logo requires error correction level H. Please select H for error correction.'
      };
    }
    
    if (logoPercentage > 25) {
      return {
        readable: false,
        recommendations: `Logo size (${Math.round(logoPercentage)}% of QR code) is too large. ` +
                         `Please reduce logo size to 20% or less of QR code size for better readability.`
      };
    }
    
    if (logoPercentage > 20) {
      return {
        readable: true,
        recommendations: `Logo size (${Math.round(logoPercentage)}% of QR code) may affect readability. ` +
                         `Consider reducing to 15-20% for optimal scanning.`
      };
    }
    
    return {
      readable: true,
      recommendations: `Logo size (${Math.round(logoPercentage)}% of QR code) is optimal for QR code readability.`
    };
  }
}
