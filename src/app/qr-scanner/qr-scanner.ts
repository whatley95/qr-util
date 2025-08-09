import { Component, ElementRef, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import jsQR from 'jsqr';
import { BrowserMultiFormatReader } from '@zxing/browser';

@Component({
  selector: 'app-qr-scanner',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './qr-scanner.html',
  styleUrl: './qr-scanner.scss'
})
export class QrScanner implements AfterViewInit, OnDestroy {
  @ViewChild('videoElement') videoElement?: ElementRef<HTMLVideoElement>;
  @ViewChild('previewImage') previewImage?: ElementRef<HTMLImageElement>;
  
  scanOption: 'camera' | 'file' = 'file'; // Default to file option
  isCameraReady = false;
  selectedFile: File | null = null;
  previewImageUrl: string | null = null;
  isDragging = false;
  isMobileDevice = false; // New property to detect mobile devices
  scanError: string | null = null;
  copyNotice: string | null = null;
  
  // QR code scan result
  scanResult: string | null = null;
  scanResultType = '';
  // Add detected symbology/format (e.g., QR_CODE, CODE_128, EAN_13)
  scanFormat: string | null = null;

  // New UX/scan controls
  autoStopOnResult = true;
  torchOn = false;
  torchAvailable = false;
  private lastCameraText: string | null = null;
  private audioCtx?: AudioContext;
  
  // Additional information about the uploaded QR code
  qrUploadInfo = {
    fileSize: '',
    dimensions: '',
    uploadTime: '',
    fileType: '',
    fileName: ''
  };
  
  private stream: MediaStream | null = null;
  private codeReader = new BrowserMultiFormatReader();
  videoDevices: MediaDeviceInfo[] = [];
  currentDeviceIndex = 0;
  private scanInterval: any;
  cameraError: string | null = null;
  
  ngAfterViewInit(): void {
    this.detectMobileDevice();
    this.checkCameraAvailability();
  }
  
  // Check if the device is a mobile device
  private detectMobileDevice(): void {
    // Check if device is mobile using userAgent or screen size
    const userAgent = navigator.userAgent.toLowerCase();
    const mobileKeywords = ['android', 'iphone', 'ipad', 'ipod', 'windows phone', 'blackberry', 'opera mini', 'mobile'];
    this.isMobileDevice = mobileKeywords.some(keyword => userAgent.includes(keyword)) || window.innerWidth <= 991;
    
    // Default to file option on desktop, camera on mobile if available
    this.scanOption = this.isMobileDevice ? 'camera' : 'file';
    
    // Add resize listener to handle orientation changes or window resizing
    window.addEventListener('resize', () => {
      const wasMobile = this.isMobileDevice;
      this.isMobileDevice = mobileKeywords.some(keyword => userAgent.includes(keyword)) || window.innerWidth <= 991;
      
      // If changing from mobile to desktop, switch to file option
      if (wasMobile && !this.isMobileDevice) {
        this.scanOption = 'file';
      }
    });
  }
  
  ngOnDestroy(): void {
    this.stopCamera();
    if (this.previewImageUrl) {
      URL.revokeObjectURL(this.previewImageUrl);
    }
  }
  
  setScanOption(option: 'camera' | 'file'): void {
    this.scanOption = option;
    
    if (option === 'camera') {
      if (!this.isCameraReady && this.videoDevices.length > 0) {
        this.startCamera();
      }
    } else {
      this.stopCamera();
    }
  }
  
  async checkCameraAvailability(): Promise<void> {
    try {
      let devices = await navigator.mediaDevices.enumerateDevices();
      this.videoDevices = devices.filter(device => device.kind === 'videoinput');

      // If no devices listed, request permission once to populate labels/devices
      if (this.videoDevices.length === 0 && navigator.mediaDevices.getUserMedia) {
        try {
          const tmp = await navigator.mediaDevices.getUserMedia({ video: true });
          tmp.getTracks().forEach(t => t.stop());
          devices = await navigator.mediaDevices.enumerateDevices();
          this.videoDevices = devices.filter(d => d.kind === 'videoinput');
        } catch {}
      }
      
      // Start camera automatically if devices are available and we're on camera option
      if (this.scanOption === 'camera') {
        this.startCamera();
      }
    } catch (error) {
      console.error('Error checking camera availability:', error);
    }
  }
  
  async startCamera(): Promise<void> {
    if (!this.videoElement) {
      return;
    }
    
    try {
      this.stopCamera();
      this.torchOn = false;
      this.torchAvailable = false;
      this.lastCameraText = null;
      this.cameraError = null;

      // Ensure devices list is fresh
      if (this.videoDevices.length === 0) {
        await this.checkCameraAvailability();
      }

      // Choose deviceId if available, otherwise let ZXing pick default/facingMode
      const deviceId = this.videoDevices[this.currentDeviceIndex]?.deviceId;

      // Start scanning; ZXing will attach the MediaStream to the video element
      this.startZXingVideoScan(deviceId);
      this.isCameraReady = true;

      // Torch capability (best-effort) after a tick
      setTimeout(() => {
        try {
          const track = (this.videoElement!.nativeElement.srcObject as MediaStream | null)?.getVideoTracks?.()[0];
          const caps: any = track && (track as any).getCapabilities?.();
          this.torchAvailable = !!caps?.torch;
        } catch {}
      }, 300);
    } catch (error: any) {
      console.error('Error starting camera:', error);
      this.isCameraReady = false;
      this.cameraError = 'Cannot start camera. Check permissions, HTTPS, or device settings.';
    }
  }

  // Use deviceId when provided, otherwise fallback to facingMode: environment
  private startZXingVideoScan(deviceId?: string): void {
    if (!this.videoElement) return;

    const onResult = (result: any, err: any) => {
      if (result) {
        const text = result.getText ? result.getText() : String(result);
        const format = result.getBarcodeFormat ? String(result.getBarcodeFormat()) : null;
        if (text && text !== this.lastCameraText) {
          this.lastCameraText = text;
          this.handleScanResult(text, format || undefined);
          this.playBeep();
          if (this.autoStopOnResult) {
            this.stopCamera();
          }
        }
      }
    };

    const startWithDevice = () =>
      this.codeReader.decodeFromVideoDevice(deviceId!, this.videoElement!.nativeElement, onResult)
        .catch(err => {
          console.error('ZXing video decode error (device):', err);
          this.cameraError = 'Camera access failed. Try switching device or check permissions.';
        });

    const startWithConstraints = () =>
      (this.codeReader as any).decodeFromConstraints?.({
        video: { facingMode: { ideal: 'environment' } }
      }, this.videoElement!.nativeElement, onResult)
      .catch((err: any) => {
        console.error('ZXing video decode error (constraints):', err);
        this.cameraError = 'Camera access failed. Try switching device or check permissions.';
      });

    if (deviceId) {
      startWithDevice();
    } else if ((this.codeReader as any).decodeFromConstraints) {
      startWithConstraints();
    } else {
      // Final fallback: let library choose default by passing undefined
      this.codeReader.decodeFromVideoDevice(undefined, this.videoElement.nativeElement, onResult)
        .catch(err => {
          console.error('ZXing video decode error (default):', err);
          this.cameraError = 'Camera access failed. Try switching device or check permissions.';
        });
    }
  }
  
  // Switch to the next available camera
  async switchCamera(): Promise<void> {
    if (!this.videoDevices || this.videoDevices.length <= 1) return;
    this.currentDeviceIndex = (this.currentDeviceIndex + 1) % this.videoDevices.length;
    await this.startCamera();
  }

  // Choose a specific camera by index
  chooseDevice(index: number): void {
    const i = Number(index);
    if (!Number.isInteger(i) || i < 0 || i >= this.videoDevices.length) return;
    this.currentDeviceIndex = i;
    this.startCamera();
  }

  // Toggle device torch/flash if supported
  toggleTorch(event: Event): void {
    this.torchOn = (event.target as HTMLInputElement)?.checked ?? !this.torchOn;
    try {
      const stream = this.videoElement?.nativeElement?.srcObject as MediaStream | null;
      const track = stream?.getVideoTracks?.()[0];
      const caps: any = track && (track as any).getCapabilities?.();
      if (track && caps?.torch) {
        (track as any).applyConstraints?.({ advanced: [{ torch: this.torchOn }] } as any).catch(() => {});
      }
    } catch {}
  }

  // Toggle auto-stop behavior
  toggleAutoStop(event: Event): void {
    this.autoStopOnResult = (event.target as HTMLInputElement).checked;
  }

  stopCamera(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    // Stop any tracks attached by ZXing via video element
    try {
      const stream = this.videoElement?.nativeElement?.srcObject as MediaStream | null;
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    } catch {}
    
    if (this.videoElement && this.videoElement.nativeElement.srcObject) {
      this.videoElement.nativeElement.srcObject = null;
    }
    
    this.isCameraReady = false;
    this.lastCameraText = null;
    
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
    }
    
    // Reset ZXing reader to stop any ongoing decode loops (handle different versions)
    try {
      const anyReader: any = this.codeReader as any;
      if (typeof anyReader.reset === 'function') {
        anyReader.reset();
      } else if (typeof anyReader.stopContinuousDecode === 'function') {
        anyReader.stopContinuousDecode();
      }
    } catch {}
  }
  
  private startQRScanning(): void {
    if (!this.videoElement) {
      return;
    }
    
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
    }
    
    this.scanInterval = setInterval(() => {
      if (
        this.videoElement && 
        this.videoElement.nativeElement.readyState === this.videoElement.nativeElement.HAVE_ENOUGH_DATA
      ) {
        const video = this.videoElement.nativeElement;
        
        // Create canvas for snapshot
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        // Draw video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Get image data for QR analysis
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Scan for QR code
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        
        if (code) {
          // QR code found
          this.handleScanResult(code.data);
          clearInterval(this.scanInterval);
        }
      }
    }, 200);
  }
  
  // File upload handling
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }
  
  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }
  
  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
    
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      if (this.isImageFile(file)) {
        this.processFile(file);
      }
    }
  }
  
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (this.isImageFile(file)) {
        this.processFile(file);
      }
    }
  }
  
  isImageFile(file: File): boolean {
    return file.type.startsWith('image/');
  }
  
  processFile(file: File): void {
    this.scanError = null;
    this.copyNotice = null;
    this.selectedFile = file;
    // Guard: very large images can cause memory spikes; warn if >10MB
    if (file.size > 10 * 1024 * 1024) {
      this.scanError = 'Large image detected (>10MB). Decoding may be slow. Consider a smaller image.';
    }
    
    // Revoke previous URL if exists
    if (this.previewImageUrl) {
      URL.revokeObjectURL(this.previewImageUrl);
    }
    
    // Create preview URL
    this.previewImageUrl = URL.createObjectURL(file);
    
    // Update upload info
    this.qrUploadInfo = {
      fileName: file.name,
      fileSize: this.formatFileSize(file.size),
      fileType: file.type,
      dimensions: 'Loading...',
      uploadTime: new Date().toLocaleString()
    };
  }
  
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  clearSelectedFile(): void {
    this.selectedFile = null;
    if (this.previewImageUrl) {
      URL.revokeObjectURL(this.previewImageUrl);
      this.previewImageUrl = null;
    }
  }
  
  onPreviewLoaded(): void {
    // Update dimensions in upload info
    if (this.previewImage) {
      const img = this.previewImage.nativeElement;
      this.qrUploadInfo.dimensions = `${img.naturalWidth} x ${img.naturalHeight}`;
    }
    
    // Image loaded, automatically scan it
    this.scanSelectedImage();
  }
  
  scanSelectedImage(): void {
    if (!this.previewImage || !this.previewImageUrl) {
      return;
    }
    
    this.scanError = null;
    this.copyNotice = null;
    const img = this.previewImage.nativeElement;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      return;
    }
    
    // Set canvas dimensions to match the image
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    
    // Draw image onto canvas
    ctx.drawImage(img, 0, 0);
    
    // Get image data
    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Attempt to scan with jsQR first (fast for QR)
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      
      if (code) {
        // jsQR only returns QR data (no format info)
        this.handleScanResult(code.data, 'QR_CODE');
      } else {
        // Fallback to ZXing for broader format support (QR + 1D barcodes)
        try {
          const imageUrl = canvas.toDataURL('image/png');
          this.codeReader.decodeFromImageUrl(imageUrl)
            .then((result: any) => {
              const text = result?.getText ? result.getText() : '';
              const format = result?.getBarcodeFormat ? String(result.getBarcodeFormat()) : undefined;
              if (text) {
                this.handleScanResult(text, format);
              } else {
                this.scanError = 'No QR/Barcode found. Try a clearer image.';
              }
            })
            .catch(() => {
              this.scanError = 'No QR/Barcode found. Try a clearer image.';
            });
        } catch (zxingError) {
          console.error('ZXing error:', zxingError);
          this.scanError = 'No QR/Barcode found in the image.';
        }
      }
    } catch (error) {
      console.error('Error scanning image:', error);
      this.scanError = 'Error scanning image. It might be too large or unsupported.';
    }
  }
  
  // Handle scan result
  handleScanResult(result: string, format?: string): void {
    this.scanResult = result;
    this.scanFormat = format || null;
    this.determineResultType(result);
  }

  determineResultType(data: string): void {
    if (data.startsWith('http://') || data.startsWith('https://')) {
      this.scanResultType = 'URL';
    } else if (data.startsWith('mailto:')) {
      this.scanResultType = 'Email';
    } else if (data.startsWith('tel:')) {
      this.scanResultType = 'Phone';
    } else if (data.startsWith('sms:')) {
      this.scanResultType = 'SMS';
    } else if (data.startsWith('WIFI:')) {
      this.scanResultType = 'WiFi';
    } else if (data.startsWith('BEGIN:VCARD')) {
      this.scanResultType = 'vCard';
    } else if (this.scanFormat && this.scanFormat !== 'QR_CODE') {
      this.scanResultType = `Barcode (${this.scanFormat})`;
    } else {
      this.scanResultType = 'Text';
    }
  }
  
  clearScanResult(): void {
    this.scanResult = null;
    this.scanResultType = '';
    this.scanFormat = null;
    this.lastCameraText = null;
    
    // If camera was active, restart scanning using ZXing video decode
    if (this.scanOption === 'camera' && this.isCameraReady) {
      const deviceId = this.videoDevices[this.currentDeviceIndex]?.deviceId;
      if (deviceId) {
        this.startZXingVideoScan(deviceId);
      } else {
        this.startCamera();
      }
    }
  }

  openResult(): void {
    if (this.scanResultType === 'URL' && this.scanResult) {
      window.open(this.scanResult, '_blank');
    }
  }

  private playBeep(): void {
    try {
      if (!this.audioCtx) this.audioCtx = new (window as any).AudioContext();
      const ctx = this.audioCtx;
      if (!ctx) return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 880; // A5
      o.connect(g);
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
      o.start();
      setTimeout(() => {
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
        o.stop(ctx.currentTime + 0.14);
      }, 10);
    } catch {}
  }
  
  copyToClipboard(): void {
    if (this.scanResult) {
      navigator.clipboard.writeText(this.scanResult)
        .then(() => {
          this.copyNotice = 'Copied to clipboard.';
          setTimeout(() => this.copyNotice = null, 2000);
        })
        .catch(err => {
          console.error('Could not copy text: ', err);
        });
    }
  }
  
  // Helper methods for parsing different QR code types
  getEmailAddress(): string {
    if (this.scanResult && this.scanResult.startsWith('mailto:')) {
      const email = this.scanResult.substring(7); // Remove 'mailto:'
      const questionMarkIndex = email.indexOf('?');
      return questionMarkIndex !== -1 ? email.substring(0, questionMarkIndex) : email;
    }
    return '';
  }
  
  getEmailSubject(): string {
    if (this.scanResult && this.scanResult.includes('?subject=')) {
      const start = this.scanResult.indexOf('?subject=') + 9;
      const end = this.scanResult.includes('&body=') ? 
        this.scanResult.indexOf('&body=') : this.scanResult.length;
      return decodeURIComponent(this.scanResult.substring(start, end));
    }
    return '';
  }
  
  getEmailBody(): string {
    if (this.scanResult && this.scanResult.includes('?body=') || this.scanResult?.includes('&body=')) {
      const bodyParam = this.scanResult.includes('?body=') ? '?body=' : '&body=';
      const start = this.scanResult.indexOf(bodyParam) + bodyParam.length;
      return decodeURIComponent(this.scanResult.substring(start));
    }
    return '';
  }
  
  getPhoneNumber(): string {
    if (this.scanResult && this.scanResult.startsWith('tel:')) {
      return this.scanResult.substring  (4); // Remove 'tel:'
    }
    return '';
  }
  
  getSmsNumber(): string {
    if (this.scanResult && this.scanResult.startsWith('sms:')) {
      const start = 4; // Skip 'sms:'
      const end = this.scanResult.includes(':?') ? 
        this.scanResult.indexOf(':?') : this.scanResult.length;
      return this.scanResult.substring(start, end);
    }
    return '';
  }
  
  getSmsMessage(): string {
    if (this.scanResult && this.scanResult.includes('body=')) {
      const start = this.scanResult.indexOf('body=') + 5;
      return decodeURIComponent(this.scanResult.substring(start));
    }
    return '';
  }
  
  getWifiSsid(): string {
    if (this.scanResult && this.scanResult.includes('S:')) {
      const start = this.scanResult.indexOf('S:') + 2;
      const end = this.scanResult.indexOf(';', start);
      return this.unescapeWifiString(this.scanResult.substring(start, end));
    }
    return '';
  }
  
  getWifiEncryption(): string {
    if (this.scanResult && this.scanResult.includes('T:')) {
      const start = this.scanResult.indexOf('T:') + 2;
      const end = this.scanResult.indexOf(';', start);
      return this.scanResult.substring(start, end);
    }
    return '';
  }
  
  getWifiPassword(): string {
    if (this.scanResult && this.scanResult.includes('P:')) {
      const start = this.scanResult.indexOf('P:') + 2;
      const end = this.scanResult.indexOf(';', start);
      return this.unescapeWifiString(this.scanResult.substring(start, end));
    }
    return '';
  }
  
  unescapeWifiString(str: string): string {
    return str.replace(/\\([\\;,:"'])/g, '$1');
  }
  
  getVCardName(): string {
    if (this.scanResult) {
      const fnMatch = this.scanResult.match(/FN:(.+)/i);
      if (fnMatch && fnMatch[1]) {
        return fnMatch[1].trim();
      }
    }
    return '';
  }
  
  getVCardPhone(): string {
    if (this.scanResult) {
      const telMatch = this.scanResult.match(/TEL[^:]*:(.+)/i);
      if (telMatch && telMatch[1]) {
        return telMatch[1].trim();
      }
    }
    return '';
  }
  
  getVCardEmail(): string {
    if (this.scanResult) {
      const emailMatch = this.scanResult.match(/EMAIL[^:]*:(.+)/i);
      if (emailMatch && emailMatch[1]) {
        return emailMatch[1].trim();
      }
    }
    return '';
  }
  
  getVCardOrganization(): string {
    if (this.scanResult) {
      const orgMatch = this.scanResult.match(/ORG:(.+)/i);
      if (orgMatch && orgMatch[1]) {
        return orgMatch[1].trim();
      }
    }
    return '';
  }
  
  getVCardTitle(): string {
    if (this.scanResult) {
      const titleMatch = this.scanResult.match(/TITLE:(.+)/i);
      if (titleMatch && titleMatch[1]) {
        return titleMatch[1].trim();
      }
    }
    return '';
  }
  
  getVCardUrl(): string {
    if (this.scanResult) {
      const urlMatch = this.scanResult.match(/URL:(.+)/i);
      if (urlMatch && urlMatch[1]) {
        return urlMatch[1].trim();
      }
    }
    return '';
  }
  
  getVCardAddress(): string {
    if (this.scanResult) {
      const adrMatch = this.scanResult.match(/ADR[^:]*:(.+)/i);
      if (adrMatch && adrMatch[1]) {
        return adrMatch[1].trim();
      }
    }
    return '';
  }
}
