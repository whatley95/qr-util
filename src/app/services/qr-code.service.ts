import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class QrCodeService {

  constructor() { }

  /**
   * Generate QR code data string for email
   */
  generateEmailQR(email: string, subject?: string, body?: string): string {
    let data = `mailto:${encodeURIComponent(email)}`;
    const params: string[] = [];
    
    if (subject) {
      params.push(`subject=${encodeURIComponent(subject)}`);
    }
    
    if (body) {
      params.push(`body=${encodeURIComponent(body)}`);
    }
    
    if (params.length > 0) {
      data += '?' + params.join('&');
    }
    
    return data;
  }

  /**
   * Generate QR code data string for SMS
   */
  generateSmsQR(phoneNumber: string, message?: string): string {
    let data = `sms:${phoneNumber.replace(/\s+/g, '')}`;
    
    if (message) {
      data += `:?body=${encodeURIComponent(message)}`;
    }
    
    return data;
  }

  /**
   * Generate QR code data string for WiFi network
   */
  generateWifiQR(ssid: string, encryption: string, password?: string, hidden: boolean = false): string {
    let data = 'WIFI:';
    data += `S:${escapeWifiString(ssid)};`;
    data += `T:${encryption};`;
    
    if (password && encryption !== 'nopass') {
      data += `P:${escapeWifiString(password)};`;
    }
    
    if (hidden) {
      data += 'H:true;';
    }
    
    data += ';';
    return data;
    
    // Helper function to escape special characters in WIFI strings
    function escapeWifiString(str: string): string {
      return str.replace(/([\\;,:"'])/g, '\\$1');
    }
  }

  /**
   * Generate QR code data string for vCard
   */
  generateVCardQR(
    firstName: string, 
    lastName: string, 
    phone?: string, 
    email?: string, 
    organization?: string,
    title?: string,
    url?: string,
    address?: string
  ): string {
    let data = 'BEGIN:VCARD\nVERSION:3.0\n';
    data += `N:${lastName};${firstName};;;\n`;
    data += `FN:${firstName} ${lastName}\n`;
    
    if (organization) {
      data += `ORG:${organization}\n`;
    }
    
    if (title) {
      data += `TITLE:${title}\n`;
    }
    
    if (phone) {
      data += `TEL;TYPE=CELL:${phone}\n`;
    }
    
    if (email) {
      data += `EMAIL:${email}\n`;
    }
    
    if (url) {
      data += `URL:${url}\n`;
    }
    
    if (address) {
      data += `ADR:;;${address};;;;\n`;
    }
    
    data += 'END:VCARD';
    return data;
  }

  /**
   * Download QR code as image file
   */
  downloadQRCode(fileType: 'png' | 'svg', namePrefix: string, qrElement: Element | null): void {
    if (!qrElement) {
      console.error('QR code element not found');
      return;
    }

    const fileName = `${namePrefix}-qrcode-${new Date().toISOString().split('T')[0]}`;

    if (fileType === 'png') {
      // For PNG download
      const canvas = qrElement.querySelector('canvas');
      if (canvas) {
        const link = document.createElement('a');
        link.download = `${fileName}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      }
    } else {
      // For SVG download
      const svg = qrElement.querySelector('svg');
      if (svg) {
        // Clone the SVG to avoid modifying the original
        const clonedSvg = svg.cloneNode(true) as SVGElement;
        
        // Set proper attributes for standalone SVG
        clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        clonedSvg.setAttribute('version', '1.1');
        
        // Convert SVG to string
        const svgData = new XMLSerializer().serializeToString(clonedSvg);
        const blob = new Blob([svgData], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.download = `${fileName}.svg`;
        link.href = url;
        link.click();
        
        // Clean up
        setTimeout(() => URL.revokeObjectURL(url), 100);
      }
    }
  }
}
