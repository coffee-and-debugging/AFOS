using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;
using AFOS.Desktop.Helpers;
using AFOS.Desktop.Models;
using AFOS.Desktop.ViewModels;

namespace AFOS.Desktop.Views;

public partial class ChefWindow : Window
{
    private readonly ChefViewModel _vm;
    private readonly DispatcherTimer _timer;

    public ChefWindow()
    {
        InitializeComponent();
        _vm = new ChefViewModel(AppState.CurrentUser!);
        DataContext = _vm;

        _timer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(5) };
        _timer.Tick += async (_, _) => await _vm.RefreshAsync();
        _timer.Start();

        Closed += (_, _) => _timer.Stop();
        Loaded  += async (_, _) => await _vm.LoadAsync();
    }

    private void FilterBtn_Click(object sender, RoutedEventArgs e)
    {
        if (sender is Button btn)
        {
            _vm.Filter = btn.Tag?.ToString() ?? "active";
            UpdateFilterUI(_vm.Filter);
        }
    }

    private void UpdateFilterUI(string active)
    {
        var muted   = FindResource("TextMutedBrush") as System.Windows.Media.Brush;
        var primary = FindResource("PrimaryBrush")   as System.Windows.Media.Brush;

        BtnFilterActive   .Foreground = active == "active"    ? primary : muted;
        BtnFilterServing  .Foreground = active == "serving"   ? primary : muted;
        BtnFilterCompleted.Foreground = active == "completed" ? primary : muted;
        BtnFilterAll      .Foreground = active == "all"       ? primary : muted;
    }

    private async void BtnAdvance_Click(object sender, RoutedEventArgs e)
    {
        if (sender is Button btn && btn.Tag is Order order)
        {
            btn.IsEnabled = false;
            await _vm.AdvanceStatusAsync(order);
            btn.IsEnabled = true;
        }
    }

    private void BtnLogout_Click(object sender, RoutedEventArgs e)
    {
        _timer.Stop();
        AppState.Logout();
        new LoginWindow().Show();
        Close();
    }
}
