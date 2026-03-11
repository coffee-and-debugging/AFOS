using System.Windows;
using AFOS.Desktop.Helpers;

namespace AFOS.Desktop;

public partial class App : Application
{
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        AppConfig.Load();
    }
}
