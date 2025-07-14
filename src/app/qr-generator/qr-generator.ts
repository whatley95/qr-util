import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
// Fix import path
import { QrCodeService } from './../services/qr-code.service';
// Import the QR with logo component
import { QrWithLogoComponent } from './qr-with-logo.component';

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
    this.setupTabSwitching();
  }

  private setupTabSwitching(): void {
    // Use setTimeout to ensure DOM is ready
    setTimeout(() => {
      const tabButtons = document.querySelectorAll('.tab-btn');
      const tabContents = document.querySelectorAll('.tab-content');

      tabButtons.forEach((button, index) => {
        button.addEventListener('click', () => {
          // Remove active class from all tabs and contents
          tabButtons.forEach(btn => btn.classList.remove('active'));
          tabContents.forEach(content => content.classList.remove('active'));
          
          // Add active class to clicked tab and corresponding content
          button.classList.add('active');
          tabContents[index]?.classList.add('active');
        });
      });
    }, 0);
  }

  initializeForm(): void {
    this.qrForm = this.fb.group({
      qrType: ['url', Validators.required],
      // URL type
      url: ['https://', [Validators.required, Validators.pattern('https?://.+')]],
      // Text type
      text: [''],
      // Email type
      email: ['', Validators.email],
      emailSubject: [''],
      emailBody: [''],
      // Phone type
      phone: ['', Validators.pattern('[+]?[0-9\\s-()]{8,}')],
      // SMS type
      smsNumber: ['', Validators.pattern('[+]?[0-9\\s-()]{8,}')],
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
      // Common options
      errorCorrection: ['M'],
      size: [200]
    });

    this.onTypeChange();
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
      
      // Check image size - if too large, resize it
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
      
      // Always set error correction to high when using a logo
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
      
      // Re-generate QR code if it already exists
      if (this.qrDataString) {
        this.generateQRCode();
      }
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
    
    // Re-generate QR code if it already exists
    if (this.qrDataString) {
      this.generateQRCode();
    }
  }

  onTypeChange(): void {
    const type = this.qrForm.get('qrType')?.value;
    
    // Reset all validators
    for (const controlName in this.qrForm.controls) {
      if (controlName !== 'qrType' && controlName !== 'errorCorrection' && controlName !== 'size' && 
          controlName !== 'colorDark' && controlName !== 'colorLight' && controlName !== 'margin') {
        this.qrForm.get(controlName)?.clearValidators();
        this.qrForm.get(controlName)?.updateValueAndValidity();
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
        this.qrForm.get('phone')?.setValidators([Validators.required, Validators.pattern('[+]?[0-9\\s-()]{8,}')]);
        break;
      case 'sms':
        this.qrForm.get('smsNumber')?.setValidators([Validators.required, Validators.pattern('[+]?[0-9\\s-()]{8,}')]);
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

    // Update validity
    for (const controlName in this.qrForm.controls) {
      this.qrForm.get(controlName)?.updateValueAndValidity();
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
      // Show warning if QR might not be readable
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

  generateQRCode(): void {
    if (this.qrForm.invalid) {
      return;
    }

    this.isGenerating = true;
    const formValue = this.qrForm.value;
    
    // Check logo impact on QR readability before generating
    if (formValue.addLogo && this.logoURL) {
      // Ensure error correction is high when using a logo
      if (formValue.errorCorrection !== 'H') {
        console.log('Setting error correction to H for better logo compatibility');
        this.qrForm.get('errorCorrection')?.setValue('H');
      }
      
      // Make sure logo size is reasonable (max 20% of QR size)
      const maxLogoSize = Math.round(formValue.size * 0.2);
      if (formValue.logoSize > maxLogoSize) {
        console.log(`Reducing logo size from ${formValue.logoSize}px to ${maxLogoSize}px for better QR readability`);
        this.qrForm.get('logoSize')?.setValue(maxLogoSize);
      }
    }
    
    switch(formValue.qrType) {
      case 'url':
        this.qrDataString = formValue.url;
        break;
      case 'text':
        this.qrDataString = formValue.text;
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
    }
    
    this.isGenerating = false;
  }

  async downloadQRCode(fileType: 'png' | 'svg'): Promise<void> {
    // First check QR code readability if using logo
    this.checkQrReadability();
    
    // Get form values (after potential adjustments from readability check)
    const formValue = this.qrForm.value;
    const includeLogo = formValue.addLogo === true && this.logoURL !== null;
    const logoSize = includeLogo ? formValue.logoSize : 60; // Default to 60px if not specified
    const fileName = `${formValue.qrType || 'qrcode'}-${new Date().toISOString().split('T')[0]}`;
    
    // ALWAYS ensure error correction is set to high when using a logo
    if (includeLogo) {
      // Force high error correction level for logo QR codes to improve readability
      this.qrForm.get('errorCorrection')?.setValue('H');
      
      // Ensure logo size isn't too large - limit to at most 20% of QR size for better readability
      const qrSize = formValue.size || 200;
      const maxLogoSize = Math.round(qrSize * 0.2); // 20% of QR code size
      
      if (formValue.logoSize > maxLogoSize) {
        console.log(`Adjusting logo size from ${formValue.logoSize}px to ${maxLogoSize}px for better readability`);
        this.qrForm.get('logoSize')?.setValue(maxLogoSize);
      }
    }
    
    // If we're using a logo, make sure it's rendered completely before downloading
    if (includeLogo && this.qrWithLogoComponent) {
      try {
        // This will render the logo and return a promise when complete
        await this.qrWithLogoComponent.refreshLogoRendering();
      } catch (e) {
        console.error('Error refreshing logo rendering:', e);
      }
    }
    
    if (fileType === 'png') {
      // Find the visible canvas element - if logo is showing, use the overlay canvas
      let canvas: HTMLCanvasElement | null = null;
      
      if (includeLogo && this.qrWithLogoComponent) {
        // Get the canvas directly from the ViewChild reference
        canvas = this.qrWithLogoComponent.canvasRef?.nativeElement;
      }
      
      // Fallback to DOM query if ViewChild approach fails
      if (!canvas) {
        if (includeLogo) {
          canvas = document.querySelector('app-qr-with-logo .qr-canvas') as HTMLCanvasElement;
        } else {
          canvas = document.querySelector('app-qr-with-logo .qr-element canvas') as HTMLCanvasElement;
        }
      }
      
      if (canvas) {
        try {
          // Create link and trigger download
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
      // For SVG we need to handle differently
      let svgElement: SVGElement | null = null;
      
      // Try to get SVG from component reference first
      if (this.qrWithLogoComponent && this.qrWithLogoComponent.qrcodeComponent) {
        const qrElement = this.qrWithLogoComponent.qrcodeComponent.qrcElement?.nativeElement;
        if (qrElement) {
          svgElement = qrElement.querySelector('svg');
        }
      }
      
      // Fallback to DOM query
      if (!svgElement) {
        svgElement = document.querySelector('app-qr-with-logo .qr-element svg') as SVGElement;
      }
      
      if (svgElement) {
        try {
          // Clone the SVG to avoid modifying the original
          const clonedSvg = svgElement.cloneNode(true) as SVGElement;
          
          // Set proper attributes for standalone SVG
          clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
          clonedSvg.setAttribute('version', '1.1');
          
          // If we need to add a logo to the SVG
          if (includeLogo && this.logoURL) {
            // Get dimensions
            const width = parseFloat(clonedSvg.getAttribute('width') || '200');
            const height = parseFloat(clonedSvg.getAttribute('height') || '200');
            // Use a smaller percentage (15-20%) of QR code size for the logo to maintain readability
            const qrSize = Math.min(width, height);
            const calculatedLogoSize = logoSize ? Math.min(logoSize, qrSize * 0.2) : qrSize * 0.15;
            // Further limit size for readability
            const finalLogoSize = Math.min(calculatedLogoSize, qrSize * 0.2);
            const logoX = (width - finalLogoSize) / 2;
            const logoY = (height - finalLogoSize) / 2;
            
            // Create a group for logo elements
            const ns = "http://www.w3.org/2000/svg";
            const group = document.createElementNS(ns, "g");
            
            // Add white circle background for the logo
            const circle = document.createElementNS(ns, "circle");
            // Use more generous padding (15%) for better readability
            const padding = Math.max(10, finalLogoSize * 0.15);
            circle.setAttribute("cx", (width/2).toString());
            circle.setAttribute("cy", (height/2).toString());
            circle.setAttribute("r", ((finalLogoSize/2) + padding).toString());
            circle.setAttribute("fill", "white");
            // Add a white stroke for extra padding/margin around logo
            circle.setAttribute("stroke", "white");
            circle.setAttribute("stroke-width", "4");
            
            // Add logo image 
            const image = document.createElementNS(ns, "image");
            image.setAttribute("x", logoX.toString());
            image.setAttribute("y", logoY.toString());
            image.setAttribute("width", finalLogoSize.toString());
            image.setAttribute("height", finalLogoSize.toString());
            image.setAttribute("href", this.logoURL);
            image.setAttribute("preserveAspectRatio", "xMidYMid meet");
            
            // Clip the image to be circular
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
            
            // Add elements to SVG
            group.appendChild(circle);
            group.appendChild(image);
            clonedSvg.appendChild(group);
          }
          
          // Convert to string and download
          const svgData = new XMLSerializer().serializeToString(clonedSvg);
          const svgBlob = new Blob([svgData], {type: "image/svg+xml"});
          const url = URL.createObjectURL(svgBlob);
          
          const link = document.createElement('a');
          link.href = url;
          link.download = `${fileName}.svg`;
          link.click();
          
          // Clean up
          setTimeout(() => URL.revokeObjectURL(url), 100);
          return;
        } catch (e) {
          console.error('Error generating SVG:', e);
        }
      }
    }
    
    // Fall back to the standard method if the custom handling fails
    this.qrCodeService.downloadQRCode(
      fileType,
      formValue.qrType || 'qrcode',
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

  isFieldInvalid(fieldName: string): boolean {
    const field = this.qrForm.get(fieldName);
    return field !== null && field !== undefined && field.touched && field.invalid;
  }
}
