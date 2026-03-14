# AFOS Desktop App — Admin & Chef

Cross-platform (Windows, Linux, macOS) desktop application built with **Avalonia UI + .NET 8**. Connects **directly to PostgreSQL** — the Express server does NOT need to be running.

---

## Requirements

- **Windows / Linux / macOS**
- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- PostgreSQL running with the `afos` database set up (same DB as the web app)

---

## Setup

### 1. Install .NET 8 SDK

**Linux (Ubuntu/Debian):**
```bash
sudo apt install dotnet-sdk-8.0
```

**macOS:**
```bash
brew install dotnet-sdk
```

**Windows:**
Download from https://dotnet.microsoft.com/download/dotnet/8.0

### 2. Configure the database connection

Edit `config.json` with your PostgreSQL credentials:

```json
{
  "ConnectionString": "Host=localhost;Port=5432;Database=afos;Username=postgres;Password=YOUR_PASSWORD"
}
```

### 3. Restore, build, and run

```bash
cd AFOS.Desktop
dotnet restore
dotnet run
```

### 4. Publish standalone executable (optional)

```bash
# Linux
dotnet publish -c Release -r linux-x64 --self-contained

# Windows
dotnet publish -c Release -r win-x64 --self-contained

# macOS
dotnet publish -c Release -r osx-x64 --self-contained
```

---

## Login

| Role  | Username | Password  |
|-------|----------|-----------|
| Admin | admin    | admin123  |
| Chef  | chef     | chef123   |

---

## Features

### Admin
- **Dashboard** — stat cards, bar charts (orders by status, revenue by method), payment breakdown, orders table with filtering, confirm cash payments
- **Menu Management** — add/edit/delete tea and food items, toggle availability
- **Tables & QR Codes** — add/remove tables, generate and download QR codes as PNG

### Chef
- **Chef Station** — order cards, advance status (pending → cooking → serving → completed), auto-refresh every 5 seconds
- Filter tabs: Active, Serving, Completed, All
