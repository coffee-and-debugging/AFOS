using Avalonia.Controls;
using Avalonia.Interactivity;
using Avalonia.Threading;
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

        Loaded += async (_, _) => await _vm.LoadAsync();
        Closed += (_, _) => _timer.Stop();
    }

    private void FilterBtn_Click(object? sender, RoutedEventArgs e)
    {
        if (sender is not Button btn || btn.Tag is not string filter) return;

        // Reset all filter buttons to secondary
        BtnFilterActive.Classes.Set("primary", false);
        BtnFilterActive.Classes.Set("secondary", true);
        BtnFilterServing.Classes.Set("primary", false);
        BtnFilterServing.Classes.Set("secondary", true);
        BtnFilterCompleted.Classes.Set("primary", false);
        BtnFilterCompleted.Classes.Set("secondary", true);
        BtnFilterAll.Classes.Set("primary", false);
        BtnFilterAll.Classes.Set("secondary", true);

        // Highlight clicked button
        btn.Classes.Set("secondary", false);
        btn.Classes.Set("primary", true);

        _vm.Filter = filter;
    }

    private async void BtnAdvance_Click(object? sender, RoutedEventArgs e)
    {
        if (sender is Button btn && btn.Tag is Order order)
        {
            await _vm.AdvanceStatusAsync(order);
        }
    }

    private void BtnLogout_Click(object? sender, RoutedEventArgs e)
    {
        _timer.Stop();
        AppState.Logout();
        new LoginWindow().Show();
        Close();
    }
}
