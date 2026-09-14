@echo off
setlocal
cd /d "%~dp0"
where dotnet >nul 2>nul
if errorlevel 1 (
  echo Install the .NET 8 SDK and the Visual Studio ASP.NET and web development workload first.
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22 LTS or newer, then open a new terminal.
  pause
  exit /b 1
)
pushd src\smartx.client
call npm ci --no-audit --no-fund
if errorlevel 1 goto :clientfail
call npm run build
if errorlevel 1 goto :clientfail
popd
dotnet build SmartX.sln
if errorlevel 1 goto :fail
echo.
echo Setup complete. Open SmartX.sln, select SmartX.Api and press F5.
pause
exit /b 0
:clientfail
popd
:fail
echo Setup failed. Read the error above, fix it and run this script again.
pause
exit /b 1
