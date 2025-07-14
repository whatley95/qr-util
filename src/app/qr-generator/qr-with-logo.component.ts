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
  
  @ViewChild('qrcode') qrcodeComponent!: QRCodeComponent;
  @ViewChild('qrCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  
  private qrCodeGenerated = false;
  
  ngAfterViewInit() {
    // Wait for QR code to be generated
    if (this.qrdata && this.showLogo && this.logoUrl) {
      setTimeout(() => this.renderQrWithLogo(), 300);
    }
  }
  
  ngOnChanges(changes: SimpleChanges) {
    // When inputs change, re-render
    if (changes['qrdata'] || changes['showLogo'] || changes['logoUrl'] || 
        changes['logoSize'] || changes['size'] || changes['colorDark'] || 
        changes['colorLight'] || changes['errorCorrectionLevel']) {
      
      // If the QR data changes, we need to wait for the QR component to generate
      // Otherwise, we can just re-render the logo
      if (changes['qrdata'] || !this.qrCodeGenerated) {
        // Will be handled by the onQrCodeGenerated method
      } else {
        setTimeout(() => this.renderQrWithLogo(), 300);
      }
    }
  }
  
  onQrCodeGenerated() {
    this.qrCodeGenerated = true;
    if (this.showLogo && this.logoUrl) {
      this.renderQrWithLogo();
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
    
    // Try to find the QR code SVG or Canvas using multiple approaches
    let qrElement = null;
    
    // 1. First try using the component reference (most reliable)
    if (this.qrcodeComponent && this.qrcodeComponent.qrcElement) {
      if (this.qrcodeComponent.elementType === 'canvas') {
        qrElement = this.qrcodeComponent.qrcElement.nativeElement.querySelector('canvas');
      } else if (this.qrcodeComponent.elementType === 'svg') {
        qrElement = this.qrcodeComponent.qrcElement.nativeElement.querySelector('svg');
      }
    }
    
    // 2. Try searching by class inside this component's DOM tree
    if (!qrElement && this.qrcodeComponent) {
      const el = this.qrcodeComponent.qrcElement.nativeElement;
      qrElement = el.querySelector('.qr-element svg') || el.querySelector('.qr-element canvas');
    }
    
    // 3. Fall back to searching in the entire DOM with more specific selectors
    if (!qrElement) {
      qrElement = document.querySelector('app-qr-with-logo .qr-element svg') || 
                  document.querySelector('app-qr-with-logo .qr-element canvas');
    }
    
    // 4. Last resort - any QR element in the DOM
    if (!qrElement) {
      qrElement = document.querySelector('.qr-element svg') || 
                  document.querySelector('.qr-element canvas');
    }
    
    if (!qrElement) {
      console.error('QR code element not found after multiple attempts');
      return;
    }
    
    // Draw the QR code to canvas
    const image = new Image();
    
    if (qrElement instanceof SVGElement) {
      // Convert SVG to data URL
      const svgData = new XMLSerializer().serializeToString(qrElement);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml' });
      image.src = URL.createObjectURL(svgBlob);
    } else if (qrElement instanceof HTMLCanvasElement) {
      image.src = qrElement.toDataURL();
    } else {
      console.error('Unknown QR code element type');
      return;
    }
    
    image.onload = () => {
      // Draw QR code
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      
      // Add logo if provided
      if (this.logoUrl) {
        const logoImg = new Image();
        logoImg.onload = () => {
          // Calculate logo position and size - ensure logo size is not too large
          // Maximum logo size should be smaller to improve readability
          const qrSize = Math.min(canvas.width, canvas.height);
          // Limit logo size to at most 20% of QR code size for better readability
          const calculatedLogoSize = this.logoSize ? Math.min(this.logoSize, qrSize * 0.2) : qrSize * 0.15;
          // Ensure logo size isn't too large for the QR code
          const finalLogoSize = Math.min(calculatedLogoSize, qrSize * 0.2);
          const logoX = (canvas.width - finalLogoSize) / 2;
          const logoY = (canvas.height - finalLogoSize) / 2;
          
          // Draw white background for logo with generous padding for better readability
          ctx.save();
          ctx.beginPath();
          // Increase padding to improve scannability - at least 10px or 15% of logo size
          const padding = Math.max(10, finalLogoSize * 0.15);
          ctx.arc(logoX + finalLogoSize / 2, logoY + finalLogoSize / 2, (finalLogoSize / 2) + padding, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          
          // Create a rounded clip path for the logo
          ctx.beginPath();
          ctx.arc(logoX + finalLogoSize / 2, logoY + finalLogoSize / 2, finalLogoSize / 2, 0, Math.PI * 2);
          ctx.clip();
          
          // Draw logo
          ctx.drawImage(logoImg, logoX, logoY, finalLogoSize, finalLogoSize);
          ctx.restore();
          
          // Clean up SVG blob if it exists
          if (qrElement instanceof SVGElement) {
            URL.revokeObjectURL(image.src);
          }
        };
        
        logoImg.src = this.logoUrl;
      }
    };
  }
  
  // Public method that can be called externally to ensure logo is rendered
  public refreshLogoRendering(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.showLogo && this.logoUrl) {
        // Re-render the logo with optimized size
        this.renderQrWithLogo();
        
        // Give it time to render
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
    
    // Get QR code size
    const qrSize = this.size;
    // Calculate what percentage of QR the logo is taking
    const logoPercentage = (this.logoSize / qrSize) * 100;
    
    // Check if we're using high error correction
    const usingHighErrorCorrection = this.errorCorrectionLevel === 'H';
    
    // Assessment logic
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
