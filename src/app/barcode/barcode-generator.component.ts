import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import JsBarcode from 'jsbarcode';

@Component({
  selector: 'app-barcode-generator',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="barcode-generator">
      <h1>Barcode Generator</h1>

      <div class="layout">
        <form [formGroup]="form" class="panel" (ngSubmit)="onSubmit()">
          <div class="row">
            <label>Symbology</label>
            <select formControlName="format">
              <option value="CODE128">CODE128</option>
              <option value="EAN13">EAN13</option>
              <option value="UPC">UPC</option>
              <option value="CODE39">CODE39</option>
              <option value="ITF14">ITF14</option>
              <option value="MSI">MSI</option>
              <option value="pharmacode">Pharmacode</option>
            </select>
            <small class="hint">Tip: CODE128 supports most ASCII characters.</small>
          </div>

          <div class="row">
            <label>Value</label>
            <input formControlName="value" placeholder="Enter value" />
            <small class="hint" *ngIf="form.get('format')?.value === 'EAN13'">EAN13 usually requires 12 or 13 digits.</small>
            <small class="hint" *ngIf="form.get('format')?.value === 'UPC'">UPC requires 11 or 12 digits.</small>
          </div>

          <div class="row inline">
            <label><input type="checkbox" formControlName="displayValue" /> Show text</label>
          </div>

          <div class="grid-3">
            <div class="row">
              <label>Width</label>
              <input type="number" formControlName="width" min="1" max="6" />
            </div>
            <div class="row">
              <label>Height</label>
              <input type="number" formControlName="height" min="20" max="200" />
            </div>
            <div class="row">
              <label>Margin</label>
              <input type="number" formControlName="margin" min="0" max="40" />
            </div>
          </div>

          <div class="actions">
            <button type="submit" [disabled]="form.invalid">Generate</button>
            <button type="button" class="secondary" (click)="clear()">Clear</button>
          </div>

          <div class="error" *ngIf="errorMessage">{{ errorMessage }}</div>
        </form>

        <div class="panel preview">
          <div class="preview-header">
            <span>Preview</span>
            <div class="actions" *ngIf="hasOutput">
              <button (click)="downloadPNG()">Download PNG</button>
              <button (click)="downloadSVG()">Download SVG</button>
            </div>
          </div>
          <div class="canvas">
            <svg #svg role="img" aria-label="Barcode preview"></svg>
            <div class="placeholder" *ngIf="!hasOutput">Enter a value to preview…</div>
          </div>
          <div class="meta" *ngIf="hasOutput">
            <span>Format: {{ form.value.format }}</span>
            <span>Size: {{ previewSize.width }} × {{ previewSize.height }} px</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .barcode-generator{max-width:1100px;margin:0 auto;padding:1.25rem}
    h1{font-size:1.5rem;margin:0 0 1rem}
    .layout{display:grid;gap:1rem}
    @media (min-width: 900px){.layout{grid-template-columns: 1fr 1fr}}

    .panel{background:#fff;border-radius:12px;padding:1rem;box-shadow:0 2px 12px rgba(0,0,0,.06)}
    form .row{display:flex;flex-direction:column;gap:.25rem}
    .row.inline{flex-direction:row;align-items:center;gap:.5rem}
    .grid-3{display:grid;grid-template-columns: repeat(3, 1fr);gap:1rem}
    label{font-weight:600}
    input, select{height:38px;padding:0 .5rem;border:1px solid #e2e8f0;border-radius:8px}
    input[type="checkbox"]{height:auto}
    .hint{color:#64748b;font-size:.8rem}

    .actions{display:flex;gap:.5rem;margin-top:.75rem}
    button{background:#1f6feb;color:#fff;border:none;border-radius:8px;padding:.55rem .9rem;cursor:pointer}
    button.secondary{background:#e2e8f0;color:#0f172a}
    button:disabled{opacity:.6;cursor:not-allowed}

    .preview .preview-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem}
    .canvas{position:relative;min-height:200px;display:flex;align-items:center;justify-content:center;background:repeating-conic-gradient(#f8fafc 0 15deg,#f1f5f9 0 30deg) 50%/20px 20px}
    svg{width:100%;max-width:700px;display:block;background:#fff;border-radius:8px}
    .placeholder{position:absolute;color:#64748b}
    .meta{margin-top:.5rem;color:#334155;display:flex;gap:1rem;flex-wrap:wrap}
    .error{margin-top:.5rem;color:#b91c1c;font-weight:600}
  `]
})
export class BarcodeGeneratorComponent implements OnInit {
  form!: FormGroup;
  hasOutput = false;
  errorMessage: string | null = null;
  previewSize = { width: 0, height: 0 };
  @ViewChild('svg') svgRef!: ElementRef<SVGSVGElement>;

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      format: ['CODE128', Validators.required],
      value: ['', Validators.required],
      displayValue: [true],
      width: [2, [Validators.min(1), Validators.max(6)]],
      height: [80, [Validators.min(20), Validators.max(200)]],
      margin: [10, [Validators.min(0), Validators.max(40)]]
    });

    // Live preview on changes
    this.form.valueChanges.subscribe(() => this.generate());
  }

  onSubmit(): void { this.generate(); }

  clear(): void {
    this.form.patchValue({ value: '' });
    this.hasOutput = false;
    this.errorMessage = null;
    const svg = this.svgRef?.nativeElement;
    if (svg) while (svg.firstChild) svg.removeChild(svg.firstChild);
  }

  generate(): void {
    const svg = this.svgRef?.nativeElement;
    if (!svg) return;

    // Clear existing drawing
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    this.errorMessage = null;
    const { format, value, displayValue, width, height, margin } = this.form.value;
    if (!value || this.form.invalid) { this.hasOutput = false; return; }

    try {
      JsBarcode(svg, value, {
        format,
        displayValue,
        width,
        height,
        margin,
        background: '#ffffff',
        lineColor: '#000000',
        valid: (valid: boolean) => {
          if (!valid) this.errorMessage = 'Invalid value for the selected symbology.';
        }
      } as any);

      // Compute size after render
      const bbox = svg.getBBox();
      this.previewSize = { width: Math.ceil(bbox.width), height: Math.ceil(bbox.height) };
      this.hasOutput = true;
    } catch (e: any) {
      this.errorMessage = e?.message || 'Failed to generate barcode.';
      this.hasOutput = false;
    }
  }

  // Build a safe base filename using value-format
  private getFileBase(): string {
    const value = this.form.get('value')?.value ?? 'barcode';
    const format = this.form.get('format')?.value ?? 'FORMAT';
    const safe = (s: any) => String(s)
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^A-Za-z0-9._-]/g, '')
      .substring(0, 100) || 'barcode';
    return `${safe(value)}-${safe(format)}`;
  }

  downloadSVG(): void {
    const svg = this.svgRef?.nativeElement; if (!svg) return;
    const data = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([data], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.getFileBase()}.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 200);
  }

  downloadPNG(): void {
    const svg = this.svgRef?.nativeElement; if (!svg) return;
    const data = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    const svgBlob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      const bbox = svg.getBBox();
      const padding = 20;
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(bbox.width) + padding * 2;
      canvas.height = Math.ceil(bbox.height) + padding * 2;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, padding, padding);
      URL.revokeObjectURL(url);
      const a = document.createElement('a');
      a.download = `${this.getFileBase()}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = url;
  }
}
