import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import QRCode from 'qrcode';

interface BatchItem {
  label: string;
  data: string;
  dataUrl: string | null;
}

interface SizePreset {
  label: string;
  size: number;
  icon: string;
}

@Component({
  selector: 'app-batch-generator',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './batch-generator.html',
  styleUrl: './batch-generator.scss'
})
export class BatchGenerator {
  mode: 'sequential' | 'bulk' = 'sequential';
  form!: FormGroup;
  bulkText = '';
  items: BatchItem[] = [];
  generating = false;
  progress = 0;
  errorMessage: string | null = null;

  // PDF layout
  pdfColumns = 3;
  qrSize = 200;
  showLabels = true;

  // Size presets
  sizePresets: SizePreset[] = [
    { label: 'Small', size: 128, icon: 'S' },
    { label: 'Medium', size: 256, icon: 'M' },
    { label: 'Large', size: 512, icon: 'L' },
    { label: 'XL', size: 768, icon: 'XL' },
    { label: 'Print', size: 1024, icon: '🖨' },
  ];
  activePreset: string | null = 'Medium';

  get thumbnailSize(): number {
    return Math.max(80, Math.min(this.qrSize, 200));
  }

  constructor(private fb: FormBuilder) {
    this.form = this.fb.group({
      prefix: ['ITEM-'],
      start: [1, [Validators.required, Validators.min(0)]],
      end: [20, [Validators.required, Validators.min(1)]],
      padding: [3, [Validators.min(1), Validators.max(10)]],
      suffix: [''],
      separator: [''],
      errorCorrection: ['M'],
      colorDark: ['#000000'],
      colorLight: ['#ffffff'],
      qrSize: [256, [Validators.min(50), Validators.max(2048)]],
      margin: [2, [Validators.min(0), Validators.max(10)]],
    });

    // Sync preset selection when qrSize changes
    this.form.get('qrSize')?.valueChanges.subscribe(val => {
      const match = this.sizePresets.find(p => p.size === val);
      this.activePreset = match ? match.label : null;
    });
  }

  get totalCount(): number {
    if (this.mode === 'sequential') {
      const s = this.form.get('start')?.value ?? 0;
      const e = this.form.get('end')?.value ?? 0;
      return Math.max(0, e - s + 1);
    }
    return this.bulkLines.length;
  }

  get bulkLines(): string[] {
    return this.bulkText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  }

  async generate(): Promise<void> {
    this.errorMessage = null;
    this.items = [];

    if (this.totalCount === 0) {
      this.errorMessage = 'No items to generate.';
      return;
    }
    if (this.totalCount > 500) {
      this.errorMessage = 'Maximum 500 items per batch.';
      return;
    }

    this.generating = true;
    this.progress = 0;
    this.qrSize = this.form.get('qrSize')?.value ?? 256;
    const margin = this.form.get('margin')?.value ?? 2;

    const entries = this.buildEntries();
    const ec = this.form.get('errorCorrection')?.value ?? 'M';
    const dark = this.form.get('colorDark')?.value ?? '#000000';
    const light = this.form.get('colorLight')?.value ?? '#ffffff';

    const batchSize = 20;
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (entry) => {
          try {
            const url = await QRCode.toDataURL(entry.data, {
              width: this.qrSize,
              margin,
              errorCorrectionLevel: ec as 'L' | 'M' | 'Q' | 'H',
              color: { dark, light },
            });
            return { ...entry, dataUrl: url };
          } catch {
            return { ...entry, dataUrl: null };
          }
        })
      );
      this.items.push(...results);
      this.progress = Math.round((this.items.length / entries.length) * 100);
      // Yield to UI
      await new Promise(r => setTimeout(r, 0));
    }

    this.generating = false;
  }

  private buildEntries(): BatchItem[] {
    if (this.mode === 'bulk') {
      return this.bulkLines.map((line, i) => ({
        label: line.length > 30 ? line.substring(0, 30) + '…' : line,
        data: line,
        dataUrl: null,
      }));
    }

    const prefix = this.form.get('prefix')?.value ?? '';
    const start = this.form.get('start')?.value ?? 1;
    const end = this.form.get('end')?.value ?? 10;
    const padding = this.form.get('padding')?.value ?? 3;
    const suffix = this.form.get('suffix')?.value ?? '';
    const separator = this.form.get('separator')?.value ?? '';

    const items: BatchItem[] = [];
    for (let n = start; n <= end; n++) {
      const num = String(n).padStart(padding, '0');
      const data = `${prefix}${separator}${num}${suffix}`;
      items.push({ label: data, data, dataUrl: null });
    }
    return items;
  }

  downloadPNG(item: BatchItem): void {
    if (!item.dataUrl) return;
    const a = document.createElement('a');
    a.href = item.dataUrl;
    a.download = `${this.sanitizeFilename(item.label)}.png`;
    a.click();
  }

  async downloadAllPNGs(): Promise<void> {
    for (const item of this.items) {
      if (item.dataUrl) {
        this.downloadPNG(item);
        await new Promise(r => setTimeout(r, 150));
      }
    }
  }

  printAsPDF(): void {
    const win = window.open('', '_blank');
    if (!win) {
      this.errorMessage = 'Pop-up blocked. Please allow pop-ups for this site.';
      return;
    }

    const cols = this.pdfColumns;
    const showLabels = this.showLabels;
    const size = Math.min(this.qrSize, 180);

    const rows = this.items.map(item => {
      if (!item.dataUrl) return '';
      return `<div class="qr-cell">
        <img src="${item.dataUrl}" width="${size}" height="${size}" />
        ${showLabels ? `<div class="label">${this.escapeHtml(item.label)}</div>` : ''}
      </div>`;
    }).join('');

    win.document.write(`<!DOCTYPE html>
<html><head><title>Batch QR Codes</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; padding: 12mm; }
  .grid { display: grid; grid-template-columns: repeat(${cols}, 1fr); gap: 8mm; }
  .qr-cell { text-align: center; page-break-inside: avoid; break-inside: avoid; padding: 4mm; border: 1px solid #eee; border-radius: 4px; }
  .qr-cell img { display: block; margin: 0 auto 4px; }
  .label { font-size: 9pt; color: #333; word-break: break-all; max-width: ${size + 20}px; margin: 0 auto; }
  @media print {
    body { padding: 8mm; }
    .qr-cell { border: 1px solid #ddd; }
  }
</style></head><body>
<div class="grid">${rows}</div>
<script>window.onload=function(){window.print();}<\/script>
</body></html>`);
    win.document.close();
  }

  private sanitizeFilename(name: string): string {
    return name.replace(/[^a-zA-Z0-9_\-]/g, '_').substring(0, 100);
  }

  private escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  applyPreset(preset: SizePreset): void {
    this.form.get('qrSize')?.setValue(preset.size);
    this.activePreset = preset.label;
  }

  previewLabel(): string {
    const prefix = this.form.get('prefix')?.value ?? '';
    const start = this.form.get('start')?.value ?? 1;
    const padding = this.form.get('padding')?.value ?? 3;
    const suffix = this.form.get('suffix')?.value ?? '';
    const separator = this.form.get('separator')?.value ?? '';
    const num = String(start).padStart(padding, '0');
    return `${prefix}${separator}${num}${suffix}`;
  }
}
