using System;
using System.Linq;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Security.Cryptography;

namespace AFOS.Desktop.Helpers;

public static class NetworkHelper
{
    private const int WebPort = 5173;
    private const string IdAlphabet = "abcdefghijkmnpqrstuvwxyz23456789"; // same as server/lib/ids.js

    /// <summary>
    /// This PC's IPv4 address on the restaurant network: a Wi-Fi or Ethernet adapter that is up
    /// and has a default gateway (virtual WSL/VMware/Docker adapters have none). Null if not found.
    /// </summary>
    public static string? LanAddress()
    {
        var candidates = NetworkInterface.GetAllNetworkInterfaces()
            .Where(n => n.OperationalStatus == OperationalStatus.Up
                        && n.NetworkInterfaceType is NetworkInterfaceType.Wireless80211 or NetworkInterfaceType.Ethernet
                        && !n.Description.Contains("Virtual", StringComparison.OrdinalIgnoreCase)
                        && !n.Name.Contains("vEthernet", StringComparison.OrdinalIgnoreCase))
            .Select(n => n.GetIPProperties())
            .Where(p => p.GatewayAddresses.Any(g => g.Address.AddressFamily == AddressFamily.InterNetwork))
            .SelectMany(p => p.UnicastAddresses)
            .Where(a => a.Address.AddressFamily == AddressFamily.InterNetwork && !a.Address.ToString().StartsWith("169.254."));
        return candidates.FirstOrDefault()?.Address.ToString();
    }

    /// <summary>Base address for table QR codes: the "Guest ordering address" setting, else this PC on port 5173.</summary>
    public static string GuestBaseUrl(string? configured)
    {
        if (!string.IsNullOrWhiteSpace(configured)) return configured.TrimEnd('/');
        var ip = LanAddress();
        return $"http://{ip ?? "localhost"}:{WebPort}";
    }

    /// <summary>Random permanent table id used in QR URLs (12 chars, hard to guess).</summary>
    public static string NewTableId()
    {
        Span<char> id = stackalloc char[12];
        for (var i = 0; i < id.Length; i++) id[i] = IdAlphabet[RandomNumberGenerator.GetInt32(IdAlphabet.Length)];
        return new string(id);
    }
}
