import { Component, ElementRef, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import jsQR from 'jsqr';
import { BrowserMultiFormatReader } from '@zxing/browser';

@Component({
  selector: 'app-qr-scanner',
  standalone: true,
  imports: [CommonModule],
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
  
  // QR code scan result
  scanResult: string | null = null;
  scanResultType = '';
  
  private stream: MediaStream | null = null;
  private codeReader = new BrowserMultiFormatReader();
  private videoDevices: MediaDeviceInfo[] = [];
  private currentDeviceIndex = 0;
  private scanInterval: any;
  
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
    if (!this.isMobileDevice) {
      this.scanOption = 'file';
    }
    
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
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      // Start camera automatically if devices are available and we're on camera option
      if (this.videoDevices.length > 0 && this.scanOption === 'camera') {
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
      if (this.videoDevices.length === 0) {
        await this.checkCameraAvailability();
      }
      
      if (this.videoDevices.length === 0) {
        console.error('No camera devices found');
        return;
      }
      
      // Stop any existing stream
      this.stopCamera();
      
      // Get camera device ID
      const deviceId = this.videoDevices[this.currentDeviceIndex].deviceId;
      
      // Get stream
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } }
      });
      
      // Connect stream to video element
      this.videoElement.nativeElement.srcObject = this.stream;
      this.videoElement.nativeElement.play();
      
      this.isCameraReady = true;
      
      // Start scanning
      this.startQRScanning();
    } catch (error) {
      console.error('Error starting camera:', error);
      this.isCameraReady = false;
    }
  }
  
  stopCamera(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    if (this.videoElement && this.videoElement.nativeElement.srcObject) {
      this.videoElement.nativeElement.srcObject = null;
    }
    
    this.isCameraReady = false;
    
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
    }
  }
  
  async switchCamera(): Promise<void> {
    if (this.videoDevices.length <= 1) {
      return;
    }
    
    this.currentDeviceIndex = (this.currentDeviceIndex + 1) % this.videoDevices.length;
    await this.startCamera();
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
    this.selectedFile = file;
    
    // Revoke previous URL if exists
    if (this.previewImageUrl) {
      URL.revokeObjectURL(this.previewImageUrl);
    }
    
    // Create preview URL
    this.previewImageUrl = URL.createObjectURL(file);
  }
  
  clearSelectedFile(): void {
    this.selectedFile = null;
    if (this.previewImageUrl) {
      URL.revokeObjectURL(this.previewImageUrl);
      this.previewImageUrl = null;
    }
  }
  
  onPreviewLoaded(): void {
    // Image loaded, automatically scan it
    this.scanSelectedImage();
  }
  
  scanSelectedImage(): void {
    if (!this.previewImage || !this.previewImageUrl) {
      return;
    }
    
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
      
      // Attempt to scan with jsQR first
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      
      if (code) {
        this.handleScanResult(code.data);
      } else {
        // Fallback to ZXing if jsQR fails
        try {
          // Convert canvas to data URL
          const imageUrl = canvas.toDataURL('image/png');
          
          // Create a new image from the data URL
          const tempImg = new Image();
          tempImg.onload = () => {
            // Use ZXing BrowserMultiFormatReader as fallback
            this.codeReader.decodeFromImageUrl(imageUrl)
              .then((result: any) => {
                this.handleScanResult(result.getText());
              })
              .catch(() => {
                alert('No QR code found in the image. Try a different image or ensure the QR code is clearly visible.');
              });
          };
          
          tempImg.src = imageUrl;
        } catch (zxingError) {
          console.error('ZXing error:', zxingError);
          alert('No QR code found in the image.');
        }
      }
    } catch (error) {
      console.error('Error scanning image:', error);
      alert('Error scanning the image. The image might be too large or from an external source.');
    }
  }
  
  // Handle scan result
  handleScanResult(result: string): void {
    this.scanResult = result;
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
    } else {
      this.scanResultType = 'Text';
    }
  }
  
  clearScanResult(): void {
    this.scanResult = null;
    this.scanResultType = '';
    
    // If camera was active, restart scanning
    if (this.scanOption === 'camera' && this.isCameraReady) {
      this.startQRScanning();
    }
  }
  
  copyToClipboard(): void {
    if (this.scanResult) {
      navigator.clipboard.writeText(this.scanResult)
        .then(() => {
          alert('Copied to clipboard!');
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
      return this.scanResult.substring(4); // Remove 'tel:'
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
