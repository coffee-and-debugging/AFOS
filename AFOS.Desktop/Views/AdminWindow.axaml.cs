using Avalonia.Controls;
using Avalonia.Interactivity;
using AFOS.Desktop.Helpers;
using AFOS.Desktop.Views.Pages;

namespace AFOS.Desktop.Views;

public partial class AdminWindow : Window
{
    private DashboardPage?  _dashPage;
    private MenuPage?       _menuPage;
    private TablesPage?     _tablesPage;

    public AdminWindow()
    {
        InitializeComponent();
        TxtUserName.Text = AppState.CurrentUser?.Name ?? "Admin";
        NavigateTo("Dashboard");
    }

    private void NavigateTo(string page)
    {
        BtnNavDashboard.Classes.Set("nav-active", false); BtnNavDashboard.Classes.Set("nav", true);
        BtnNavMenu     .Classes.Set("nav-active", false); BtnNavMenu     .Classes.Set("nav", true);
        BtnNavTables   .Classes.Set("nav-active", false); BtnNavTables   .Classes.Set("nav", true);

        switch (page)
        {
            case "Dashboard":
                BtnNavDashboard.Classes.Set("nav", false); BtnNavDashboard.Classes.Set("nav-active", true);
                _dashPage ??= new DashboardPage();
                MainContent.Content = _dashPage;
                break;
            case "Menu":
                BtnNavMenu.Classes.Set("nav", false); BtnNavMenu.Classes.Set("nav-active", true);
                _menuPage ??= new MenuPage();
                MainContent.Content = _menuPage;
                _menuPage.Reload();
                break;
            case "Tables":
                BtnNavTables.Classes.Set("nav", false); BtnNavTables.Classes.Set("nav-active", true);
                _tablesPage ??= new TablesPage();
                MainContent.Content = _tablesPage;
                _tablesPage.Reload();
                break;
        }
    }

    private void NavDashboard_Click(object? sender, RoutedEventArgs e) => NavigateTo("Dashboard");
    private void NavMenu_Click    (object? sender, RoutedEventArgs e) => NavigateTo("Menu");
    private void NavTables_Click  (object? sender, RoutedEventArgs e) => NavigateTo("Tables");

    private void BtnLogout_Click(object? sender, RoutedEventArgs e)
    {
        AppState.Logout();
        _dashPage?.StopRefresh();
        new LoginWindow().Show();
        Close();
    }
}
