import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
// Import QRCodeComponent directly
import { QRCodeComponent } from 'angularx-qrcode';
// Fix import path
import { QrCodeService } from './../services/qr-code.service';

@Component({
  selector: 'app-qr-generator',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, QRCodeComponent],
  templateUrl: './qr-generator.html',
  styleUrl: './qr-generator.scss'
})
export class QrGenerator implements OnInit {
  qrForm!: FormGroup;
  qrDataString: string = '';
  isGenerating: boolean = false;

  constructor(
    private fb: FormBuilder,
    private qrCodeService: QrCodeService
  ) {}

  ngOnInit(): void {
    this.initializeForm();
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
      // Common options
      errorCorrection: ['M'],
      size: [200]
    });

    this.onTypeChange();
  }

  onTypeChange(): void {
    const type = this.qrForm.get('qrType')?.value;
    
    // Reset all validators
    for (const controlName in this.qrForm.controls) {
      if (controlName !== 'qrType' && controlName !== 'errorCorrection' && controlName !== 'size') {
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

  generateQRCode(): void {
    if (this.qrForm.invalid) {
      return;
    }

    this.isGenerating = true;
    const formValue = this.qrForm.value;
    
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

  downloadQRCode(fileType: 'png' | 'svg'): void {
    this.qrCodeService.downloadQRCode(
      fileType,
      this.qrForm.get('qrType')?.value || 'qrcode',
      document.querySelector('qrcode')
    );
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.qrForm.get(fieldName);
    return field !== null && field !== undefined && field.touched && field.invalid;
  }
}
