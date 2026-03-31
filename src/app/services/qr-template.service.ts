import { Injectable } from '@angular/core';

export interface QrTemplate {
  id: string;
  name: string;
  type: string;
  colorDark: string;
  colorLight: string;
  errorCorrection: string;
  size: number;
  margin: number;
  gradientEnabled: boolean;
  gradientFrom: string;
  gradientTo: string;
  gradientAngle: number;
  addLogo: boolean;
  createdAt: number;
}

const STORAGE_KEY = 'qr_templates';

@Injectable({ providedIn: 'root' })
export class QrTemplateService {
  private templates: QrTemplate[] = [];

  constructor() {
    this.load();
    if (this.templates.length === 0) {
      this.seedDefaults();
    }
  }

  getAll(): QrTemplate[] {
    return [...this.templates];
  }

  save(template: Omit<QrTemplate, 'id' | 'createdAt'>): QrTemplate {
    const entry: QrTemplate = {
      ...template,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    this.templates.unshift(entry);
    this.persist();
    return entry;
  }

  remove(id: string): void {
    this.templates = this.templates.filter(t => t.id !== id);
    this.persist();
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.templates = JSON.parse(raw);
    } catch {
      this.templates = [];
    }
  }

  private persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.templates));
  }

  private seedDefaults(): void {
    const defaults: Omit<QrTemplate, 'id' | 'createdAt'>[] = [
      { name: 'Classic Black', type: 'text', colorDark: '#000000', colorLight: '#ffffff', errorCorrection: 'M', size: 200, margin: 4, gradientEnabled: false, gradientFrom: '#667eea', gradientTo: '#764ba2', gradientAngle: 45, addLogo: false },
      { name: 'Blue Professional', type: 'text', colorDark: '#1a73e8', colorLight: '#ffffff', errorCorrection: 'M', size: 200, margin: 4, gradientEnabled: false, gradientFrom: '#667eea', gradientTo: '#764ba2', gradientAngle: 45, addLogo: false },
      { name: 'Gradient Purple', type: 'text', colorDark: '#667eea', colorLight: '#ffffff', errorCorrection: 'H', size: 250, margin: 4, gradientEnabled: true, gradientFrom: '#667eea', gradientTo: '#764ba2', gradientAngle: 45, addLogo: false },
      { name: 'High Error Correction', type: 'text', colorDark: '#000000', colorLight: '#ffffff', errorCorrection: 'H', size: 300, margin: 6, gradientEnabled: false, gradientFrom: '#667eea', gradientTo: '#764ba2', gradientAngle: 45, addLogo: false },
      { name: 'Dark Mode', type: 'text', colorDark: '#ffffff', colorLight: '#121212', errorCorrection: 'M', size: 200, margin: 4, gradientEnabled: false, gradientFrom: '#667eea', gradientTo: '#764ba2', gradientAngle: 45, addLogo: false },
    ];
    defaults.forEach(d => this.save(d));
  }
}
