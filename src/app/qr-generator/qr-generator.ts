import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
// Fix import path
import { QrCodeService } from './../services/qr-code.service';
// Import the QR with logo component
import { QrWithLogoComponent } from './qr-with-logo.component';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-qr-generator',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, QrWithLogoComponent],
  templateUrl: './qr-generator.html',
  styleUrl: './qr-generator.scss'
})
export class QrGenerator implements OnInit {
  qrForm!: FormGroup;
  qrDataString: string = '';
  isGenerating: boolean = false;
  logoFile: File | null = null;
  logoURL: string | null = null;
  
  @ViewChild(QrWithLogoComponent) qrWithLogoComponent!: QrWithLogoComponent;

  // Track active tab in a reactive, Angular-friendly way
  activeTab: 'content' | 'design' | 'advanced' = 'content';
  
  // Inline copy notice
  copyNotice: string | null = null;
  
  // Color presets for quick selection
  colorPresets = [
    { name: 'Classic', dark: '#000000', light: '#ffffff' },
    { name: 'Blue', dark: '#1a73e8', light: '#ffffff' },
    { name: 'Green', dark: '#34a853', light: '#ffffff' },
    { name: 'Purple', dark: '#9c27b0', light: '#ffffff' },
    { name: 'Orange', dark: '#ff9800', light: '#ffffff' },
    { name: 'Red', dark: '#f44336', light: '#ffffff' },
    { name: 'Dark Mode', dark: '#ffffff', light: '#121212' },
    { name: 'Gradient Blue', dark: '#667eea', light: '#764ba2' }
  ];

  constructor(
    private fb: FormBuilder,
    private qrCodeService: QrCodeService
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    // Angular-driven tabs (remove DOM listeners)
    // Live preview: update on form changes
    this.qrForm.valueChanges
      .pipe(debounceTime(200))
      .subscribe(() => {
        // Adjust validators that depend on other control values
        this.syncDependentValidators();
        // Auto-enforce safe logo settings if logo is enabled
        this.enforceLogoSafety();
        // Update data string when valid
        this.updateQrDataString();
      });
  }

  initializeForm(): void {
    this.qrForm = this.fb.group({
      qrType: ['text', Validators.required],
      // URL type
      url: ['https://', [Validators.required, Validators.pattern('https?://.+')]],
      // Text type
      text: ['', Validators.required],
      // Email type
      email: ['', Validators.email],
      emailSubject: [''],
      emailBody: [''],
      // Phone type
      phone: ['', Validators.pattern('[+]?[^A-Za-z]{8,}')],
      // SMS type
      smsNumber: ['', Validators.pattern('[+]?[^A-Za-z]{8,}')],
      smsMessage: [''],
      // WiFi type
      ssid: [''],
      encryption: ['WPA'],
      password: [''],
      hidden: [false],
      // vCard type
      firstName: [''],
      lastName: [''],
      contactEmail: ['', Validators.email],
      contactPhone: [''],
      organization: [''],
      title: [''],
      contactUrl: [''],
      address: [''],
      // QR Design Customization
      colorDark: ['#000000'],
      colorLight: ['#ffffff'],
      margin: [4],
      // Image/Logo options
      addLogo: [false],
      logoSize: [60], // logo size in pixels
      // New gradient controls
      gradientEnabled: [false],
      gradientFrom: ['#667eea'],
      gradientTo: ['#764ba2'],
      gradientAngle: [45],
      // Common options
      errorCorrection: ['M'],
      size: [200]
    });

    this.onTypeChange();

    // React to addLogo toggling for safety
    this.qrForm.get('addLogo')?.valueChanges.subscribe(() => {
      this.enforceLogoSafety();
      this.updateQrDataString();
    });

    // React to encryption changes for WiFi password validator
    this.qrForm.get('encryption')?.valueChanges.subscribe(() => {
      this.syncDependentValidators();
      this.updateQrDataString();
    });

    // Initial render
    this.updateQrDataString();
  }
  
  private syncDependentValidators(): void {
    const type = this.qrForm.get('qrType')?.value;

    // Reset all validators except design/common
    for (const controlName in this.qrForm.controls) {
      if (
        controlName !== 'qrType' &&
        controlName !== 'errorCorrection' &&
        controlName !== 'size' &&
        controlName !== 'colorDark' &&
        controlName !== 'colorLight' &&
        controlName !== 'margin' &&
        controlName !== 'addLogo' &&
        controlName !== 'logoSize'
      ) {
        this.qrForm.get(controlName)?.clearValidators();
        this.qrForm.get(controlName)?.updateValueAndValidity({ emitEvent: false });
      }
    }

    // Add validators based on type
    switch(type) {
      case 'url':
        this.qrForm.get('url')?.setValidators([Validators.required, Validators.pattern('https?://.+')]);
        break;
      case 'text':
        this.qrForm.get('text')?.setValidators(Validators.required);
        break;
      case 'email':
        this.qrForm.get('email')?.setValidators([Validators.required, Validators.email]);
        break;
      case 'phone':
        this.qrForm.get('phone')?.setValidators([Validators.required, Validators.pattern('[+]?[^A-Za-z]{8,}')]);
        break;
      case 'sms':
        this.qrForm.get('smsNumber')?.setValidators([Validators.required, Validators.pattern('[+]?[^A-Za-z]{8,}')]);
        break;
      case 'wifi':
        this.qrForm.get('ssid')?.setValidators(Validators.required);
        if (this.qrForm.get('encryption')?.value !== 'nopass') {
          this.qrForm.get('password')?.setValidators(Validators.required);
        }
        break;
      case 'vcard':
        this.qrForm.get('firstName')?.setValidators(Validators.required);
        this.qrForm.get('lastName')?.setValidators(Validators.required);
        if (this.qrForm.get('contactEmail')?.value) {
          this.qrForm.get('contactEmail')?.setValidators(Validators.email);
        }
        break;
    }

    // Update validity without triggering cycles
    for (const controlName in this.qrForm.controls) {
      this.qrForm.get(controlName)?.updateValueAndValidity({ emitEvent: false });
    }
  }

  // Handle logo file selection
  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      
      // Check if file is an image
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      
      // Check image size - if too large, notify
      if (file.size > 500000) { // 500KB
        alert('For best results, use an image smaller than 500KB.');
      }
      
      this.logoFile = file;
      
      // Clear previous URL if exists
      if (this.logoURL) {
        URL.revokeObjectURL(this.logoURL);
      }
      
      // Create preview URL
      this.logoURL = URL.createObjectURL(file);
      
      // When adding logo, automatically adjust settings for better readability
      this.qrForm.get('errorCorrection')?.setValue('H');
      this.qrForm.get('addLogo')?.setValue(true);
      
      // Ensure logo size is reasonable based on QR code size
      const qrSize = this.qrForm.get('size')?.value || 200;
      const maxLogoSize = Math.round(qrSize * 0.2); // 20% of QR code size
      const currentLogoSize = this.qrForm.get('logoSize')?.value || 60;
      
      if (currentLogoSize > maxLogoSize) {
        this.qrForm.get('logoSize')?.setValue(maxLogoSize);
      }
      
      // If QR code is small, increase its size to accommodate the logo better
      if (qrSize < 200) {
        this.qrForm.get('size')?.setValue(Math.max(qrSize, 200));
      }
      
      // Update preview if it already exists
      this.updateQrDataString();
    }
  }
  
  // Clear logo selection
  clearLogo(): void {
    this.logoFile = null;
    if (this.logoURL) {
      URL.revokeObjectURL(this.logoURL);
      this.logoURL = null;
    }
    this.qrForm.get('addLogo')?.setValue(false);
    
    // Reset error correction to default if no logo
    if (this.qrForm.get('errorCorrection')?.value === 'H') {
      this.qrForm.get('errorCorrection')?.setValue('M');
    }
    
    // Update preview
    this.updateQrDataString();
  }

  onTypeChange(): void {
    this.syncDependentValidators();
  }

  // Ensure settings are safe for a QR with a logo
  private enforceLogoSafety(): void {
    const formValue = this.qrForm.value;
    const includeLogo = formValue.addLogo === true && this.logoURL !== null;
    if (!includeLogo) {
      return;
    }

    // Force high error correction
    if (formValue.errorCorrection !== 'H') {
      this.qrForm.get('errorCorrection')?.setValue('H', { emitEvent: false });
    }

    // Limit logo size to <= 20% of QR size
    const qrSize = formValue.size || 200;
    const maxLogoSize = Math.round(qrSize * 0.2);
    if (formValue.logoSize > maxLogoSize) {
      this.qrForm.get('logoSize')?.setValue(maxLogoSize, { emitEvent: false });
    }

    // Ensure a reasonable quiet zone when using a logo
    const minMargin = 2;
    if ((formValue.margin ?? 0) < minMargin) {
      this.qrForm.get('margin')?.setValue(minMargin, { emitEvent: false });
    }
  }

  // Method to check if QR code with logo will be readable
  checkQrReadability(): void {
    if (!this.qrWithLogoComponent || !this.qrForm.get('addLogo')?.value || !this.logoURL) {
      return; // No logo to check
    }
    
    // Get the assessment from QrWithLogoComponent
    const assessment = this.qrWithLogoComponent.assessLogoImpact();
    
    if (!assessment.readable) {
      alert(`Warning: ${assessment.recommendations}`);
      
      // Automatically adjust settings for better readability
      const formValue = this.qrForm.value;
      
      // Ensure error correction is high
      if (formValue.errorCorrection !== 'H') {
        this.qrForm.get('errorCorrection')?.setValue('H');
      }
      
      // Calculate safe logo size (20% of QR code)
      const safeLogoSize = Math.round(formValue.size * 0.2);
      if (formValue.logoSize > safeLogoSize) {
        this.qrForm.get('logoSize')?.setValue(safeLogoSize);
      }
    }
  }

  // Generate the data string based on current form values
  private updateQrDataString(): void {
    if (this.qrForm.invalid) {
      this.qrDataString = '';
      return;
    }

    const formValue = this.qrForm.value;

    switch(formValue.qrType) {
      case 'url':
        this.qrDataString = formValue.url?.trim();
        break;
      case 'text':
        this.qrDataString = formValue.text?.toString() ?? '';
        break;
      case 'email':
        this.qrDataString = this.qrCodeService.generateEmailQR(
          formValue.email,
          formValue.emailSubject,
          formValue.emailBody
        );
        break;
      case 'phone':
        this.qrDataString = `tel:${formValue.phone}`;
        break;
      case 'sms':
        this.qrDataString = this.qrCodeService.generateSmsQR(
          formValue.smsNumber,
          formValue.smsMessage
        );
        break;
      case 'wifi':
        this.qrDataString = this.qrCodeService.generateWifiQR(
          formValue.ssid,
          formValue.encryption,
          formValue.password,
          formValue.hidden
        );
        break;
      case 'vcard':
        this.qrDataString = this.qrCodeService.generateVCardQR(
          formValue.firstName,
          formValue.lastName,
          formValue.contactPhone,
          formValue.contactEmail,
          formValue.organization,
          formValue.title,
          formValue.contactUrl,
          formValue.address
        );
        break;
      default:
        this.qrDataString = '';
    }
  }

  generateQRCode(): void {
    if (this.qrForm.invalid) {
      return;
    }

    this.isGenerating = true;
    // Check logo impact on QR readability before generating
    const formValue = this.qrForm.value;
    if (formValue.addLogo && this.logoURL) {
      if (formValue.errorCorrection !== 'H') {
        this.qrForm.get('errorCorrection')?.setValue('H');
      }
      const maxLogoSize = Math.round((formValue.size || 200) * 0.2);
      if (formValue.logoSize > maxLogoSize) {
        this.qrForm.get('logoSize')?.setValue(maxLogoSize);
      }
    }

    this.updateQrDataString();
    this.isGenerating = false;
  }

  async downloadQRCode(fileType: 'png' | 'svg'): Promise<void> {
    // First check QR code readability if using logo
    this.checkQrReadability();
    
    // Get form values (after potential adjustments from readability check)
    const formValue = this.qrForm.value;
    const includeLogo = formValue.addLogo === true && this.logoURL !== null;
    const logoSize = includeLogo ? formValue.logoSize : 60; // Default to 60px if not specified
    const fileName = this.getFileBase();
    
    // ALWAYS ensure error correction is set to high when using a logo
    if (includeLogo) {
      this.qrForm.get('errorCorrection')?.setValue('H');
      const qrSize = formValue.size || 200;
      const maxLogoSize = Math.round(qrSize * 0.2);
      if (formValue.logoSize > maxLogoSize) {
        this.qrForm.get('logoSize')?.setValue(maxLogoSize);
      }
    }
    
    // If we're using a logo, make sure it's rendered completely before downloading
    if (includeLogo && this.qrWithLogoComponent) {
      try {
        await this.qrWithLogoComponent.refreshLogoRendering();
      } catch (e) {
        console.error('Error refreshing logo rendering:', e);
      }
    }
    
    if (fileType === 'png') {
      let canvas: HTMLCanvasElement | null = null;
      
      if (includeLogo && this.qrWithLogoComponent) {
        canvas = this.qrWithLogoComponent.canvasRef?.nativeElement;
      }
      
      if (!canvas) {
        if (includeLogo) {
          canvas = document.querySelector('app-qr-with-logo .qr-canvas') as HTMLCanvasElement;
        } else {
          canvas = document.querySelector('app-qr-with-logo .qr-element canvas') as HTMLCanvasElement;
        }
      }
      
      if (canvas) {
        try {
          const link = document.createElement('a');
          link.download = `${fileName}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
          return;
        } catch (e) {
          console.error('Error generating PNG:', e);
          alert('Could not download QR code. Please try again.');
        }
      }
    } else if (fileType === 'svg') {
      let svgElement: SVGElement | null = null;
      
      if (this.qrWithLogoComponent && this.qrWithLogoComponent.qrcodeComponent) {
        const qrElement = this.qrWithLogoComponent.qrcodeComponent.qrcElement?.nativeElement;
        if (qrElement) {
          svgElement = qrElement.querySelector('svg');
        }
      }
      
      if (!svgElement) {
        svgElement = document.querySelector('app-qr-with-logo .qr-element svg') as SVGElement;
      }
      
      if (svgElement) {
        try {
          const clonedSvg = svgElement.cloneNode(true) as SVGElement;
          
          clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
          clonedSvg.setAttribute('version', '1.1');
          
          if (includeLogo && this.logoURL) {
            const width = parseFloat(clonedSvg.getAttribute('width') || '200');
            const height = parseFloat(clonedSvg.getAttribute('height') || '200');
            const qrSize = Math.min(width, height);
            const calculatedLogoSize = logoSize ? Math.min(logoSize, qrSize * 0.2) : qrSize * 0.15;
            const finalLogoSize = Math.min(calculatedLogoSize, qrSize * 0.2);
            const logoX = (width - finalLogoSize) / 2;
            const logoY = (height - finalLogoSize) / 2;
            
            const ns = "http://www.w3.org/2000/svg";
            const group = document.createElementNS(ns, "g");
            
            const circle = document.createElementNS(ns, "circle");
            const padding = Math.max(10, finalLogoSize * 0.15);
            circle.setAttribute("cx", (width/2).toString());
            circle.setAttribute("cy", (height/2).toString());
            circle.setAttribute("r", ((finalLogoSize/2) + padding).toString());
            circle.setAttribute("fill", "white");
            circle.setAttribute("stroke", "white");
            circle.setAttribute("stroke-width", "4");
            
            const image = document.createElementNS(ns, "image");
            image.setAttribute("x", logoX.toString());
            image.setAttribute("y", logoY.toString());
            image.setAttribute("width", finalLogoSize.toString());
            image.setAttribute("height", finalLogoSize.toString());
            image.setAttribute("href", this.logoURL);
            image.setAttribute("preserveAspectRatio", "xMidYMid meet");
            
            const clipPath = document.createElementNS(ns, "clipPath");
            const clipId = "logo-clip-" + Date.now();
            clipPath.setAttribute("id", clipId);
            
            const clipCircle = document.createElementNS(ns, "circle");
            clipCircle.setAttribute("cx", (width/2).toString());
            clipCircle.setAttribute("cy", (height/2).toString());
            clipCircle.setAttribute("r", (finalLogoSize/2).toString());
            
            clipPath.appendChild(clipCircle);
            clonedSvg.appendChild(clipPath);
            
            image.setAttribute("clip-path", `url(#${clipId})`);
            
            group.appendChild(circle);
            group.appendChild(image);
            clonedSvg.appendChild(group);
          }
          
          const svgData = new XMLSerializer().serializeToString(clonedSvg);
          const svgBlob = new Blob([svgData], {type: "image/svg+xml"});
          const url = URL.createObjectURL(svgBlob);
          
          const link = document.createElement('a');
          link.href = url;
          link.download = `${fileName}.svg`;
          link.click();
          
          setTimeout(() => URL.revokeObjectURL(url), 100);
          return;
        } catch (e) {
          console.error('Error generating SVG:', e);
        }
      }
    }
    
    // Fall back
    this.qrCodeService.downloadQRCode(
      fileType,
      this.getFileBase(),
      document.querySelector('app-qr-with-logo .qr-element'),
      this.logoURL,
      includeLogo,
      logoSize
    );
  }

  // Method to apply a color preset
  applyColorPreset(preset: any): void {
    this.qrForm.patchValue({
      colorDark: preset.dark,
      colorLight: preset.light
    });
  }

  // Copy the current content string
  async copyQrData(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.qrDataString || '');
      this.copyNotice = 'Copied';
      setTimeout(() => (this.copyNotice = null), 2000);
    } catch {
      // no-op
    }
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.qrForm.get(fieldName);
    return field !== null && field !== undefined && field.touched && field.invalid;
  }

  // Build a descriptive file base name like url-example.com or text-hello-world
  private getFileBase(): string {
    const v = this.qrForm.value;
    const sanitize = (s: string) =>
      (s || '')
        .toString()
        .trim()
        .toLowerCase()
        .replace(/https?:\/\//, '')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-_\.]/g, '')
        .slice(0, 40) || 'qrcode';

    let base = 'qrcode';
    switch (v.qrType) {
      case 'url':
        base = `url-${sanitize(v.url || '')}`;
        break;
      case 'text':
        base = `text-${sanitize((v.text || '').slice(0, 24))}`;
        break;
      case 'email':
        base = `email-${sanitize(v.email || '')}`;
        break;
      case 'phone':
        base = `tel-${sanitize(v.phone || '')}`;
        break;
      case 'sms':
        base = `sms-${sanitize(v.smsNumber || '')}`;
        break;
      case 'wifi':
        base = `wifi-${sanitize(v.ssid || '')}`;
        break;
      case 'vcard':
        base = `vcard-${sanitize(v.firstName || '')}-${sanitize(v.lastName || '')}`;
        break;
    }
    return base.replace(/-+$/, '') || 'qrcode';
  }
}
