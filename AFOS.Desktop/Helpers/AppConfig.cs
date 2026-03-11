using System.IO;
using System.Text.Json;

namespace AFOS.Desktop.Helpers;

public static class AppConfig
{
    public static string ConnectionString { get; private set; } = "";
    public static string UploadsPath { get; private set; } = "";

    private static readonly string ConfigPath =
        Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "config.json");

    public static void Load()
    {
        try
        {
            if (File.Exists(ConfigPath))
            {
                var json = File.ReadAllText(ConfigPath);
                var doc = JsonDocument.Parse(json);
                ConnectionString = doc.RootElement.GetProperty("ConnectionString").GetString() ?? "";
                if (doc.RootElement.TryGetProperty("UploadsPath", out var up))
                    UploadsPath = up.GetString() ?? "";
            }
        }
        catch { /* use defaults */ }
    }

    public static void Save()
    {
        var obj = new { ConnectionString, UploadsPath };
        var json = JsonSerializer.Serialize(obj, new JsonSerializerOptions { WriteIndented = true });
        File.WriteAllText(ConfigPath, json);
    }

    public static void Update(string connectionString, string uploadsPath = "")
    {
        ConnectionString = connectionString;
        UploadsPath = uploadsPath;
        Save();
    }
}
