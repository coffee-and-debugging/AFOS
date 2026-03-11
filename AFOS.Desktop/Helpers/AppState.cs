using AFOS.Desktop.Models;

namespace AFOS.Desktop.Helpers;

public static class AppState
{
    public static User? CurrentUser { get; set; }

    public static bool IsAdmin => CurrentUser?.Role == "admin";
    public static bool IsChef  => CurrentUser?.Role == "chef";

    public static void Logout()
    {
        CurrentUser = null;
    }
}
