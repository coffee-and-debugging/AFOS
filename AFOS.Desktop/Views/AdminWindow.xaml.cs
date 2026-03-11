using System.Windows;
using System.Windows.Controls;
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
        // Reset all nav buttons
        BtnNavDashboard.Style = FindResource("NavBtn")        as Style;
        BtnNavMenu     .Style = FindResource("NavBtn")        as Style;
        BtnNavTables   .Style = FindResource("NavBtn")        as Style;

        switch (page)
        {
            case "Dashboard":
                BtnNavDashboard.Style = FindResource("NavBtnActive") as Style;
                _dashPage ??= new DashboardPage();
                MainContent.Content = _dashPage;
                break;

            case "Menu":
                BtnNavMenu.Style = FindResource("NavBtnActive") as Style;
                _menuPage ??= new MenuPage();
                MainContent.Content = _menuPage;
                _menuPage.Reload();
                break;

            case "Tables":
                BtnNavTables.Style = FindResource("NavBtnActive") as Style;
                _tablesPage ??= new TablesPage();
                MainContent.Content = _tablesPage;
                _tablesPage.Reload();
                break;
        }
    }

    private void NavDashboard_Click(object sender, RoutedEventArgs e) => NavigateTo("Dashboard");
    private void NavMenu_Click    (object sender, RoutedEventArgs e) => NavigateTo("Menu");
    private void NavTables_Click  (object sender, RoutedEventArgs e) => NavigateTo("Tables");

    private void BtnLogout_Click(object sender, RoutedEventArgs e)
    {
        AppState.Logout();
        // Stop all timers
        _dashPage?.StopRefresh();
        new LoginWindow().Show();
        Close();
    }
}
