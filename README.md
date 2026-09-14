# Smart-X Sensor Gateway

An ASP.NET Core Minimal API and React application for registering sensors, ingesting typed telemetry, monitoring device activity and investigating unusual readings.

Smart-X also demonstrates advanced C# concepts through working features: generic telemetry packets, operator-overloaded meter calculations, jagged historical batches, and recursive deployment validation.

## Features

- Register sensors with identifiers, locations and categories.
- Submit temperature, power and Boolean switch readings.
- Simulate readings and inject numeric spikes.
- Monitor charts and sensor status with two-second polling.
- Inspect anomalous readings and missing-data warnings.
- Upload configuration files, device photos and hardware logs.
- Compare two power meters using aggregate load and signed deltas.
- Import validated historical batches.
- Validate and save nested deployment configurations.

## Project Status

| Architectural pillar | Status |
|---|---|
| Sensor Data Ingestion and Telemetry | Implemented |
| Real-Time Command Stream and History | Planned |
| Network Topology and Mesh Routing | Planned |

This version implements Task 2 of the Part 1 assignment brief. Future command-stream and mesh-routing modules are visible but disabled.

## Screenshots

### Telemetry dashboard

![Smart-X telemetry dashboard](docs/dashboard-preview.png)

### Advanced sensor tools

![Meter comparison and deployment tools](docs/advanced-preview.png)

## Built With

| Layer | Technology |
|---|---|
| Backend | C#, ASP.NET Core Minimal APIs, .NET 8 |
| Frontend | React 18, Vite |
| Communication | HTTP and Fetch |
| Charts | Interactive SVG |
| Persistent data | JSON files and local attachments |
| Recent readings | Bounded generic queues |

## Quick Start

### Visual Studio

1. Download or clone the repository.
2. Open `SmartX.sln` in Visual Studio 2022.
3. Ensure the ASP.NET and web development workload and .NET 8 SDK are installed.
4. Set `SmartX.Api` as the startup project.
5. Press **F5**.
6. Visit `http://localhost:5080`.
7. Select **Load demo sensors**.

The repository includes compiled React assets in `wwwroot`, allowing the initial launch without installing frontend dependencies.

### Command Line

From the solution root:

```powershell
dotnet run --project src/SmartX.Api
```

### Frontend Development

Install Node.js 22 or newer, then run:

```powershell
cd src/smartx.client
npm ci
npm run dev
```

Keep the backend running at port 5080 and open `http://localhost:5173`.

To rebuild the frontend served by the API:

```powershell
npm run build
```

On Windows, `setup.cmd` installs frontend dependencies, builds React and builds the .NET solution.

## How It Works

The React frontend sends and retrieves data through the Minimal API.

Registration, ingestion, historical imports, meter comparisons, deployment validation and file handling are implemented in dedicated backend services.

The default Visual Studio launch serves both the API and compiled React frontend from port 5080. During frontend development, Vite proxies `/api` requests to the backend.

## Advanced C# Concepts

| Concept | Implementation |
|---|---|
| Generics | `TelemetryPacket<T>` and `TelemetryBuffer<T>` preserve typed values. |
| Operator overloading | `MeterReading` supports addition, subtraction and comparisons. |
| Jagged arrays | Historical batches use `TelemetryPacket<T>[][]`. |
| Generic lists | Validated batches transfer into a preallocated `List<TelemetryPacket<T>>`. |
| Recursion | Deployment validation recursively checks hierarchy and inherited enabled state. |

See [Advanced requirements](docs/ADVANCED-REQUIREMENTS.md) for code locations and demonstrations.

## Project Organisation

| Location | Purpose |
|---|---|
| `SmartX.sln` | Visual Studio solution |
| `src/SmartX.Api/Endpoints` | Minimal API route mappings |
| `src/SmartX.Api/Models` | Sensor, telemetry and deployment structures |
| `src/SmartX.Api/Services` | Validation, processing and storage |
| `src/SmartX.Api/wwwroot` | Compiled React frontend |
| `src/smartx.client/src` | React source code |
| `tests` | API smoke tests |
| `docs` | Architecture, demonstrations and validation notes |

## API Overview

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Check gateway health |
| GET | `/api/sensors` | List sensors and status |
| POST | `/api/sensors` | Register a sensor |
| GET / POST | `/api/sensors/{id}/telemetry/temperature` | Temperature readings |
| GET / POST | `/api/sensors/{id}/telemetry/power` | Power readings |
| GET / POST | `/api/sensors/{id}/telemetry/switch` | Switch readings |
| POST | `/api/sensors/{id}/telemetry/{kind}/batches` | Import historical batches |
| GET | `/api/meters/{aId}/compare/{bId}` | Compare power meters |
| GET / POST | `/api/deployment` | Load or save deployment |
| POST | `/api/deployment/validate` | Validate a deployment tree |
| GET / POST | `/api/sensors/{id}/attachments` | List or upload attachments |
| GET | `/api/sensors/{id}/attachments/{attachmentId}` | Download an attachment |

For historical imports, `{kind}` is `temperature`, `power` or `switch`.

POST requests require:

```http
X-SmartX-Client: dashboard
```

This header is a browser write guard, not authentication.

## Tests

With the backend running:

```powershell
node tests/api-smoke.mjs
node tests/advanced-smoke.mjs
```

Frontend tests:

```powershell
cd src/smartx.client
npm test
```

The supplied version passed 436 API assertions and browser workflow checks. These are recorded validation results, not a continuously updated CI status.

Tests modify local demo data. The advanced suite also replaces the saved deployment, so use a disposable test data folder.

## Data and Limits

By default:

- 100 registered sensors.
- 300 recent readings retained per sensor.
- 20 attachments per sensor.
- 5 MiB maximum per attachment.
- 1,000 historical readings per import request.
- 100 deployment nodes and eight hierarchy levels.

Profiles, attachments and deployment configuration persist in `App_Data`. Telemetry is stored in memory and resets after a backend restart.

## Limitations

Smart-X is a local coursework application. It does not include authentication, persistent telemetry history, distributed gateway coordination or malware scanning.

Alerts identify threshold breaches and missing telemetry. They do not establish a confirmed hardware fault.

The browser simulator stops when its selected sensor dashboard closes. Meter comparisons use last-received values, which may represent different device times.
