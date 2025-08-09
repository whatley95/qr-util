import { Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';

@Component({
  selector: 'app-barcode-scanner',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="barcode-scanner">
      <h1>Scan Barcode</h1>

      <div class="mode-switch">
        <button (click)="setMode('file')" [class.active]="mode==='file'">Upload image</button>
        <button (click)="setMode('camera')" [class.active]="mode==='camera'">Camera</button>
      </div>

      <ng-container *ngIf="mode==='camera'; else fileMode">
        <div class="video-wrapper">
          <video #video playsinline></video>
        </div>
        <div class="controls">
          <button (click)="start()" [disabled]="running">Start</button>
          <button (click)="stop()" [disabled]="!running" class="danger">Stop</button>
        </div>
      </ng-container>

      <ng-template #fileMode>
        <div class="dropzone" [class.dragging]="isDragging" (dragover)="onDragOver($event)" (dragleave)="onDragLeave($event)" (drop)="onFileDrop($event)">
          <div>
            <strong>Drop an image</strong> or
            <label class="link">
              choose a file
              <input type="file" accept="image/*" (change)="onFileSelected($event)" hidden />
            </label>
          </div>
          <small>PNG, JPG, or GIF</small>
        </div>

        <div class="preview" *ngIf="previewImageUrl">
          <img #previewImage [src]="previewImageUrl" alt="Barcode preview" (load)="onPreviewLoaded()" />
          <div class="actions">
            <button (click)="clearFile()" class="secondary">Clear</button>
          </div>
        </div>
      </ng-template>

      <div class="result" *ngIf="text">
        <div class="chip">{{ format }}</div>
        <div class="value">{{ text }}</div>
      </div>
    </div>
  `,
  styles: [`
    .barcode-scanner{max-width:900px;margin:0 auto;padding:1rem}
    h1{font-size:1.5rem;margin:0 0 .75rem}
    .mode-switch{display:flex;gap:.5rem;margin-bottom:.75rem}
    .mode-switch button{background:#e2e8f0;color:#0f172a;border:none;border-radius:999px;padding:.35rem .75rem;cursor:pointer}
    .mode-switch button.active{background:#1f6feb;color:#fff}

    .video-wrapper{position:relative;background:#0a0a0a;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
    video{width:100%;height:auto;display:block}
    .controls{margin-top:.75rem;display:flex;gap:.5rem}
    button{background:#1f6feb;color:#fff;border:none;border-radius:8px;padding:.55rem .9rem;cursor:pointer}
    button.danger{background:#ef4444}
    button.secondary{background:#e2e8f0;color:#0f172a}
    button:disabled{opacity:.6;cursor:not-allowed}

    .dropzone{border:2px dashed #cbd5e1;border-radius:12px;padding:1.25rem;text-align:center;background:#fff}
    .dropzone.dragging{background:#f8fafc;border-color:#94a3b8}
    .dropzone .link{color:#1f6feb;cursor:pointer}

    .preview{margin-top:.75rem;background:#fff;border-radius:12px;padding:1rem;display:flex;flex-direction:column;gap:.5rem;align-items:center}
    .preview img{max-width:100%;border-radius:8px;box-shadow:0 1px 8px rgba(0,0,0,.06)}

    .result{margin-top:.75rem;background:#fff;border-radius:12px;padding:1rem;display:flex;flex-direction:column;gap:.5rem}
    .chip{align-self:flex-start;background:#e2e8f0;color:#0f172a;border-radius:999px;padding:.2rem .6rem;font-size:.8rem}
    .value{font-size:1.05rem;font-weight:600;word-break:break-all}
  `]
})
export class BarcodeScannerComponent implements OnDestroy {
  @ViewChild('video') videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('previewImage') previewImage?: ElementRef<HTMLImageElement>;
  private reader = new BrowserMultiFormatReader();
  running = false;
  text: string | null = null;
  format: string | null = null;

  mode: 'camera' | 'file' = 'file';
  isDragging = false;
  selectedFile: File | null = null;
  previewImageUrl: string | null = null;

  setMode(m: 'camera' | 'file') {
    this.mode = m;
    this.text = null; this.format = null;
    if (m === 'camera') {
      this.start();
    } else {
      this.stop();
    }
  }

  private createHints() {
    const hints: Map<DecodeHintType, any> = new Map();
    const formats = [
      BarcodeFormat.CODE_128,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_39,
      BarcodeFormat.ITF,
      BarcodeFormat.CODABAR,
      BarcodeFormat.QR_CODE
    ];
    hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
    return hints;
  }

  async start() {
    if (this.running) return;
    this.running = true;

    this.reader = new BrowserMultiFormatReader(this.createHints());

    try {
      await this.reader.decodeFromVideoDevice(undefined, this.videoRef.nativeElement, (result, err) => {
        if (result) {
          this.text = (result as any).getText();
          this.format = String((result as any).getBarcodeFormat());
        }
      });
    } catch (e) {
      console.error(e);
    }
  }

  stop() {
    this.running = false;
    try {
      (this.reader as any).reset?.();
      (this.reader as any).stopContinuousDecode?.();
    } catch {}
    if (this.videoRef?.nativeElement?.srcObject) {
      const stream = this.videoRef.nativeElement.srcObject as MediaStream;
      stream.getTracks().forEach(t => t.stop());
      this.videoRef.nativeElement.srcObject = null as any;
    }
  }

  // File upload handlers
  onDragOver(event: DragEvent): void { event.preventDefault(); event.stopPropagation(); this.isDragging = true; }
  onDragLeave(event: DragEvent): void { event.preventDefault(); event.stopPropagation(); this.isDragging = false; }
  onFileDrop(event: DragEvent): void {
    event.preventDefault(); event.stopPropagation(); this.isDragging = false;
    const file = event.dataTransfer?.files?.[0];
    if (file && this.isImageFile(file)) this.processFile(file);
  }
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file && this.isImageFile(file)) this.processFile(file);
  }
  isImageFile(file: File): boolean { return file.type.startsWith('image/'); }

  processFile(file: File): void {
    this.selectedFile = file;
    if (this.previewImageUrl) URL.revokeObjectURL(this.previewImageUrl);
    this.previewImageUrl = URL.createObjectURL(file);
  }

  clearFile(): void {
    this.selectedFile = null;
    if (this.previewImageUrl) { URL.revokeObjectURL(this.previewImageUrl); this.previewImageUrl = null; }
    this.text = null; this.format = null;
  }

  onPreviewLoaded(): void { this.scanSelectedImage(); }

  scanSelectedImage(): void {
    if (!this.previewImageUrl) return;
    // Use ZXing to decode from image URL with hints
    const reader = new BrowserMultiFormatReader(this.createHints());
    reader.decodeFromImageUrl(this.previewImageUrl)
      .then((result: any) => {
        this.text = result?.getText?.() ?? '';
        this.format = String(result?.getBarcodeFormat?.() ?? '');
      })
      .catch(() => {
        alert('No barcode/QR found in the image. Try another image with better focus/contrast.');
      });
  }

  ngOnDestroy(): void {
    this.stop();
    if (this.previewImageUrl) URL.revokeObjectURL(this.previewImageUrl);
  }
}
