import { Injectable } from '@angular/core';

export interface QrHistoryEntry {
  id: string;
  data: string;
  type: string;
  label: string;
  timestamp: number;
  colorDark: string;
  colorLight: string;
  errorCorrection: string;
  size: number;
}

const STORAGE_KEY = 'qr_history';
const MAX_ENTRIES = 50;

@Injectable({ providedIn: 'root' })
export class QrHistoryService {
  private entries: QrHistoryEntry[] = [];

  constructor() {
    this.load();
  }

  getAll(): QrHistoryEntry[] {
    return [...this.entries];
  }

  add(entry: Omit<QrHistoryEntry, 'id' | 'timestamp'>): void {
    const newEntry: QrHistoryEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    // Deduplicate: remove older entry with same data
    this.entries = this.entries.filter(e => e.data !== entry.data);
    this.entries.unshift(newEntry);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries = this.entries.slice(0, MAX_ENTRIES);
    }
    this.save();
  }

  remove(id: string): void {
    this.entries = this.entries.filter(e => e.id !== id);
    this.save();
  }

  clear(): void {
    this.entries = [];
    this.save();
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.entries = JSON.parse(raw);
      }
    } catch {
      this.entries = [];
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries));
    } catch {
      // Storage full — drop oldest
      this.entries = this.entries.slice(0, 20);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries));
    }
  }
}
