@echo off
echo Starting Angular Dev Server...
cd /d %~dp0
npx -p @angular/cli ng serve --open
