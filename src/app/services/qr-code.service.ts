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
  downloadQRCode(
    fileType: 'png' | 'svg', 
    namePrefix: string, 
    qrElement: Element | null,
    logoUrl?: string | null,
    includeLogo: boolean = false,
    logoSize: number = 60
  ): void {
    if (!qrElement) {
      console.error('QR code element not found');
      return;
    }

    const fileName = `${namePrefix}-qrcode-${new Date().toISOString().split('T')[0]}`;

    if (fileType === 'png') {
      // For PNG download
      const canvas = qrElement.querySelector('canvas');
      if (canvas) {
        if (includeLogo && logoUrl) {
          // When we have a logo to embed, we need to create a new canvas
          // and add the logo in the center of the QR code
          const logoImg = new Image();
          logoImg.onload = () => {
            const newCanvas = document.createElement('canvas');
            const ctx = newCanvas.getContext('2d');
            
            if (!ctx) {
              console.error('Could not get 2D context');
              return;
            }
            
            // Set canvas size
            newCanvas.width = canvas.width;
            newCanvas.height = canvas.height;
            
            // Draw QR code first
            ctx.drawImage(canvas, 0, 0);
            
            // Calculate logo position and size
            const qrSize = Math.min(canvas.width, canvas.height);
            // Use provided logoSize or calculate as percentage if not provided (limit to 15% by default)
            const calculatedLogoSize = logoSize ? Math.min(logoSize, qrSize * 0.2) : qrSize * 0.15;
            // Ensure logo isn't too large for the QR code (max 20% of QR size for better readability)
            const finalLogoSize = Math.min(calculatedLogoSize, qrSize * 0.2);
            const logoX = (canvas.width - finalLogoSize) / 2;
            const logoY = (canvas.height - finalLogoSize) / 2;
            
            // Create a rounded clip path for the logo (optional)
            ctx.save();
            ctx.beginPath();
            ctx.arc(logoX + finalLogoSize / 2, logoY + finalLogoSize / 2, finalLogoSize / 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            
            // Draw logo
            ctx.drawImage(logoImg, logoX, logoY, finalLogoSize, finalLogoSize);
            ctx.restore();
            
            // Create white background for logo (with generous padding)
            ctx.save();
            ctx.beginPath();
            const padding = Math.max(10, finalLogoSize * 0.15);
            ctx.arc(logoX + finalLogoSize / 2, logoY + finalLogoSize / 2, (finalLogoSize / 2) + padding, 0, Math.PI * 2);
            ctx.closePath();
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.lineWidth = 8;
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();
            ctx.restore();
            
            // Download the canvas with logo
            const link = document.createElement('a');
            link.download = `${fileName}.png`;
            link.href = newCanvas.toDataURL('image/png');
            link.click();
          };
          logoImg.src = logoUrl;
        } else {
          // Regular download without logo
          const link = document.createElement('a');
          link.download = `${fileName}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
        }
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
        
        if (includeLogo && logoUrl) {
          // Add logo to SVG
          const svgNS = "http://www.w3.org/2000/svg";
          const width = parseFloat(clonedSvg.getAttribute('width') || '200');
          const height = parseFloat(clonedSvg.getAttribute('height') || '200');
          
          // Create a group for the logo
          const logoGroup = document.createElementNS(svgNS, 'g');
          
          // Calculate logo size with stricter limits for better readability
          const qrSize = Math.min(width, height);
          // Use provided logoSize or calculate as percentage (default 15%)
          const calculatedLogoSize = logoSize ? Math.min(logoSize, qrSize * 0.2) : qrSize * 0.15;
          // Ensure logo isn't too large for the QR code (max 20% of QR size)
          const finalLogoSize = Math.min(calculatedLogoSize, qrSize * 0.2);
          
          // Create white circle background with more padding
          const circle = document.createElementNS(svgNS, 'circle');
          const padding = Math.max(10, finalLogoSize * 0.15); // 15% padding or at least 10px
          circle.setAttribute('cx', (width / 2).toString());
          circle.setAttribute('cy', (height / 2).toString());
          circle.setAttribute('r', ((finalLogoSize / 2) + padding).toString());
          circle.setAttribute('fill', 'white');
          circle.setAttribute('stroke', 'white');
          circle.setAttribute('stroke-width', '8');
          
          // Create image element for logo
          const image = document.createElementNS(svgNS, 'image');
          image.setAttribute('x', ((width - finalLogoSize) / 2).toString());
          image.setAttribute('y', ((height - finalLogoSize) / 2).toString());
          image.setAttribute('width', finalLogoSize.toString());
          image.setAttribute('height', finalLogoSize.toString());
          image.setAttribute('href', logoUrl);
          image.setAttribute('preserveAspectRatio', 'xMidYMid meet');
          
          // Add elements to SVG
          logoGroup.appendChild(circle);
          logoGroup.appendChild(image);
          clonedSvg.appendChild(logoGroup);
        }
        
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
