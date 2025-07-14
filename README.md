# QR Util

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A modern, feature-rich QR code generator and scanner utility built with Angular. This open source tool allows you to create customizable QR codes and scan existing ones with ease.

![QR Util Screenshot](https://via.placeholder.com/800x400?text=QR+Util+Screenshot)

## Features

- **QR Code Generation**: Create QR codes for various content types:
  - URLs
  - Plain text
  - Email addresses with subject/body
  - Phone numbers
  - SMS messages
  - WiFi network credentials
  - vCards (contact information)

- **Customization Options**:
  - Color presets for QR codes
  - Custom logo embedding with automatic readability optimization
  - Error correction level adjustment
  - Size and margin controls

- **QR Code Scanning**:
  - Upload and scan QR code images
  - Camera-based scanning on supported devices
  - Detailed analysis of scanned QR content

- **Export Options**:
  - Download as PNG
  - Download as SVG

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 20.1.0.

## Deployment

### Cloudflare Pages
This application can be easily deployed to Cloudflare Pages:

1. **Manual Deployment**:
   - Build the application: `npm run build -- --configuration production`
   - Upload the contents of `dist/qr-util/browser/` to Cloudflare Pages via the dashboard

2. **Automatic Deployment**:
   - Connect your GitHub repository to Cloudflare Pages
   - Configure the build settings:
     - Build command: `npm run build -- --configuration production`
     - Build output directory: `dist/qr-util/browser`
     - Environment variables: Set `NODE_VERSION` to `18` or higher

3. **Custom Domain**:
   - After deployment, you can configure a custom domain in the Cloudflare Pages settings

4. **Configuration Files**:
   - This repo includes `_routes.json` which configures Cloudflare Pages to handle Angular's client-side routing
   - The configuration also sets optimal caching headers for static assets

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

### Local Build

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

### Building for Deployment to Cloudflare Pages

To build the project for manual deployment to Cloudflare Pages:

1. Create a production build:

```bash
npm run build -- --configuration production
```

2. The build output will be in the `dist/qr-util/browser/` directory.

3. For manual deployment to Cloudflare Pages:
   - Log in to your Cloudflare dashboard
   - Navigate to Pages
   - Create a new project (if needed)
   - Upload the contents of the `dist/qr-util/browser/` directory

Alternatively, you can set up automatic deployments with these settings:
- **Build command:** `npm run build -- --configuration production`
- **Build output directory:** `dist/qr-util/browser`
- **Root directory:** `/`

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Contributing

Contributions are welcome! If you'd like to help improve QR Util, please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add some amazing feature'`
4. Push to your branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines

- Follow the Angular style guide
- Write tests for new features
- Ensure your code passes linting checks: `ng lint`

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgements

- [Angular](https://angular.dev/)
- [angularx-qrcode](https://www.npmjs.com/package/angularx-qrcode)
- [jsQR](https://github.com/cozmo/jsQR)
- [ZXing](https://github.com/zxing/zxing)

## Contact

Project Link: [https://github.com/whatley95/qr-util](https://github.com/whatley95/qr-util)

---

Created by [whatley95](https://github.com/whatley95) - feel free to contact me!
