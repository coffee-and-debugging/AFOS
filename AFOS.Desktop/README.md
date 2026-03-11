# AFOS Desktop App — Admin & Chef

WPF desktop application for managing the AFOS Tea Shop. Connects **directly to PostgreSQL** — the Express server does NOT need to be running.

---

## Requirements

- Windows 10/11 (64-bit)
- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- PostgreSQL running with the `afos` database set up (same DB as the web app)

---

## Setup

### 1. Configure the database connection

Open `config.json` and update the connection string to match your PostgreSQL credentials:

```json
{
  "ConnectionString": "Host=localhost;Port=5432;Database=afos;Username=postgres;Password=YOUR_PASSWORD"
}
```

### 2. Restore and build

Open **Command Prompt** or **PowerShell** in the `AFOS.Desktop` folder and run:

```
dotnet restore
dotnet build
```

### 3. Run

```
dotnet run
```

Or build a standalone executable:

```
dotnet publish -c Release -r win-x64 --self-contained
```

The output will be in `bin\Release\net8.0-windows\win-x64\publish\`.

---

## Login

| Role  | Username | Password  |
|-------|----------|-----------|
| Admin | admin    | admin123  |
| Chef  | chef     | chef123   |

---

## Features

### Admin
- **Dashboard** — stat cards, charts (orders by status, payment breakdown, revenue by method), full orders table with filtering, confirm cash payments
- **Menu Management** — add/edit/delete tea and food items, toggle availability
- **Tables & QR Codes** — add/remove tables, generate and download QR codes

### Chef
- **Chef Station** — order cards with status, advance orders (pending → cooking → serving → completed), auto-refreshes every 5 seconds
- Filter tabs: Active, Serving, Completed, All
