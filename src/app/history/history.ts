import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { QrHistoryService, QrHistoryEntry } from '../services/qr-history.service';
import QRCode from 'qrcode';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [],
  templateUrl: './history.html',
  styleUrl: './history.scss'
})
export class HistoryComponent implements OnInit {
  entries: (QrHistoryEntry & { dataUrl?: string })[] = [];
  confirmClear = false;

  constructor(
    private historyService: QrHistoryService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadEntries();
  }

  async loadEntries(): Promise<void> {
    const raw = this.historyService.getAll();
    this.entries = raw;

    // Generate thumbnails in batches
    for (const entry of this.entries) {
      try {
        entry.dataUrl = await QRCode.toDataURL(entry.data, {
          width: 80,
          margin: 1,
          errorCorrectionLevel: (entry.errorCorrection || 'M') as 'L' | 'M' | 'Q' | 'H',
          color: { dark: entry.colorDark || '#000', light: entry.colorLight || '#fff' },
        });
      } catch {
        entry.dataUrl = undefined;
      }
    }
  }

  remove(id: string): void {
    this.historyService.remove(id);
    this.entries = this.entries.filter(e => e.id !== id);
  }

  clearAll(): void {
    if (!this.confirmClear) {
      this.confirmClear = true;
      setTimeout(() => this.confirmClear = false, 3000);
      return;
    }
    this.historyService.clear();
    this.entries = [];
    this.confirmClear = false;
  }

  reuse(entry: QrHistoryEntry): void {
    // Navigate to generator with query params
    this.router.navigate(['/generate'], {
      queryParams: {
        type: entry.type,
        data: entry.data,
      }
    });
  }

  copyData(entry: QrHistoryEntry): void {
    navigator.clipboard.writeText(entry.data);
  }

  formatDate(ts: number): string {
    return new Date(ts).toLocaleString();
  }

  get isEmpty(): boolean {
    return this.entries.length === 0;
  }
}
