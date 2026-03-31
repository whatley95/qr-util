import { Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { QrCodeService } from './../services/qr-code.service';
import { QrWithLogoComponent } from './qr-with-logo.component';
import { QrHistoryService } from '../services/qr-history.service';
import { QrTemplateService, QrTemplate } from '../services/qr-template.service';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-qr-generator',
  standalone: true,
  imports: [ReactiveFormsModule, QrWithLogoComponent],
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
  activeTab: 'content' | 'design' | 'advanced' | 'templates' = 'content';

  // Templates
  templates: QrTemplate[] = [];
  showTemplates = false;
  templateName = '';
  
  // Inline copy notice
  copyNotice: string | null = null;
  
  // Inline logo/validation notice
  logoNotice: string | null = null;
  
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
    private qrCodeService: QrCodeService,
    private historyService: QrHistoryService,
    private templateService: QrTemplateService
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.templates = this.templateService.getAll();
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
        this.logoNotice = 'Please select an image file.';
        setTimeout(() => this.logoNotice = null, 4000);
        return;
      }
      
      // Check image size - if too large, notify
      if (file.size > 500000) { // 500KB
        this.logoNotice = 'For best results, use an image smaller than 500KB.';
        setTimeout(() => this.logoNotice = null, 4000);
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
      this.logoNotice = `Warning: ${assessment.recommendations}`;
      setTimeout(() => this.logoNotice = null, 6000);
      
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

    // Save to history
    if (this.qrDataString) {
      const fv = this.qrForm.value;
      this.historyService.add({
        data: this.qrDataString,
        type: fv.qrType,
        label: this.getFileBase(),
        colorDark: fv.colorDark,
        colorLight: fv.colorLight,
        errorCorrection: fv.errorCorrection,
        size: fv.size,
      });
    }
  }

  // Template methods
  loadTemplate(template: QrTemplate): void {
    this.qrForm.patchValue({
      colorDark: template.colorDark,
      colorLight: template.colorLight,
      errorCorrection: template.errorCorrection,
      size: template.size,
      margin: template.margin,
      gradientEnabled: template.gradientEnabled,
      gradientFrom: template.gradientFrom,
      gradientTo: template.gradientTo,
      gradientAngle: template.gradientAngle,
    });
    this.showTemplates = false;
  }

  saveAsTemplate(): void {
    if (!this.templateName.trim()) return;
    const fv = this.qrForm.value;
    this.templateService.save({
      name: this.templateName.trim(),
      type: fv.qrType,
      colorDark: fv.colorDark,
      colorLight: fv.colorLight,
      errorCorrection: fv.errorCorrection,
      size: fv.size,
      margin: fv.margin,
      gradientEnabled: fv.gradientEnabled,
      gradientFrom: fv.gradientFrom,
      gradientTo: fv.gradientTo,
      gradientAngle: fv.gradientAngle,
      addLogo: fv.addLogo,
    });
    this.templates = this.templateService.getAll();
    this.templateName = '';
  }

  removeTemplate(id: string): void {
    this.templateService.remove(id);
    this.templates = this.templateService.getAll();
  }

  async downloadQRCode(fileType: 'png' | 'svg'): Promise<void> {
    this.checkQrReadability();

    const formValue = this.qrForm.value;
    const includeLogo = formValue.addLogo === true && this.logoURL !== null;
    const logoSize = includeLogo ? formValue.logoSize : 60;
    const fileName = this.getFileBase();

    if (includeLogo) {
      this.qrForm.get('errorCorrection')?.setValue('H');
      const qrSize = formValue.size || 200;
      const maxLogoSize = Math.round(qrSize * 0.2);
      if (formValue.logoSize > maxLogoSize) {
        this.qrForm.get('logoSize')?.setValue(maxLogoSize);
      }
    }

    if (includeLogo && this.qrWithLogoComponent) {
      try { await this.qrWithLogoComponent.refreshLogoRendering(); } catch { /* ignore */ }
    }

    if (fileType === 'png') {
      try {
        const canvas = await this.getExportCanvas();
        const link = document.createElement('a');
        link.download = `${fileName}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      } catch (e) {
        console.error('Error generating PNG:', e);
        this.logoNotice = 'Could not download QR code. Please try again.';
        setTimeout(() => this.logoNotice = null, 4000);
      }
    } else if (fileType === 'svg') {
      let svgElement: SVGElement | null = null;

      if (this.qrWithLogoComponent?.qrcodeComponent?.qrcElement?.nativeElement) {
        svgElement = this.qrWithLogoComponent.qrcodeComponent.qrcElement.nativeElement.querySelector('svg');
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
            circle.setAttribute("cx", (width / 2).toString());
            circle.setAttribute("cy", (height / 2).toString());
            circle.setAttribute("r", ((finalLogoSize / 2) + padding).toString());
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
            clipCircle.setAttribute("cx", (width / 2).toString());
            clipCircle.setAttribute("cy", (height / 2).toString());
            clipCircle.setAttribute("r", (finalLogoSize / 2).toString());

            clipPath.appendChild(clipCircle);
            clonedSvg.appendChild(clipPath);

            image.setAttribute("clip-path", `url(#${clipId})`);

            group.appendChild(circle);
            group.appendChild(image);
            clonedSvg.appendChild(group);
          }

          const svgData = new XMLSerializer().serializeToString(clonedSvg);
          const svgBlob = new Blob([svgData], { type: "image/svg+xml" });
          const url = URL.createObjectURL(svgBlob);

          const link = document.createElement('a');
          link.href = url;
          link.download = `${fileName}.svg`;
          link.click();

          setTimeout(() => URL.revokeObjectURL(url), 100);
        } catch (e) {
          console.error('Error generating SVG:', e);
          this.logoNotice = 'Could not download SVG. Please try again.';
          setTimeout(() => this.logoNotice = null, 4000);
        }
      }
    }
  }

  applyColorPreset(preset: any): void {
    this.qrForm.patchValue({
      colorDark: preset.dark,
      colorLight: preset.light
    });
  }

  async copyQrData(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.qrDataString || '');
      this.copyNotice = 'Copied to clipboard!';
      setTimeout(() => (this.copyNotice = null), 2000);
    } catch {
      // no-op
    }
  }

  async copyQrImage(): Promise<void> {
    try {
      const canvas = await this.getExportCanvas();
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (blob) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        this.copyNotice = 'Image copied to clipboard!';
      }
    } catch {
      this.copyNotice = 'Could not copy image. Try downloading instead.';
    }
    setTimeout(() => (this.copyNotice = null), 3000);
  }

  async shareQr(): Promise<void> {
    try {
      const canvas = await this.getExportCanvas();
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) return;
      const file = new File([blob], `${this.getFileBase()}.png`, { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: 'QR Code', text: this.qrDataString, files: [file] });
      } else if (navigator.share) {
        await navigator.share({ title: 'QR Code', text: this.qrDataString });
      } else {
        this.copyNotice = 'Sharing not supported on this browser.';
        setTimeout(() => (this.copyNotice = null), 3000);
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        this.copyNotice = 'Could not share.';
        setTimeout(() => (this.copyNotice = null), 3000);
      }
    }
  }

  async printQr(): Promise<void> {
    try {
      const canvas = await this.getExportCanvas();
      const dataUrl = canvas.toDataURL('image/png');
      const w = window.open('', '_blank');
      if (!w) return;
      w.document.write(`<!DOCTYPE html>
        <html><head><title>Print QR Code</title>
        <style>body{display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;}
        img{max-width:80vmin;max-height:80vmin;}</style></head>
        <body><img src="${dataUrl}" onload="window.print();window.close();"></body></html>`);
      w.document.close();
    } catch {
      this.logoNotice = 'Could not prepare QR for printing.';
      setTimeout(() => this.logoNotice = null, 3000);
    }
  }

  get qrDataLength(): number {
    return (this.qrDataString || '').length;
  }

  get qrMaxCapacity(): number {
    const ec = this.qrForm?.get('errorCorrection')?.value || 'M';
    const caps: Record<string, number> = { L: 4296, M: 3391, Q: 2420, H: 1852 };
    return caps[ec] || 3391;
  }

  private getExportCanvas(): Promise<HTMLCanvasElement> {
    if (!this.qrWithLogoComponent) {
      return Promise.reject(new Error('QR component not ready'));
    }
    return this.qrWithLogoComponent.getExportCanvas();
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
