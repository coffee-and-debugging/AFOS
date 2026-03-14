using Avalonia.Controls;
using Avalonia.Interactivity;
using Avalonia.Threading;
using AFOS.Desktop.Models;
using AFOS.Desktop.ViewModels;

namespace AFOS.Desktop.Views.Pages;

public partial class DashboardPage : UserControl
{
    private readonly DashboardViewModel _vm = new();
    private readonly DispatcherTimer _timer;
    private readonly Button[] _filterButtons;

    public DashboardPage()
    {
        InitializeComponent();
        DataContext = _vm;

        _filterButtons = new[]
        {
            BtnFilterAll, BtnFilterPending, BtnFilterCooking,
            BtnFilterServing, BtnFilterCompleted
        };

        _timer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(8) };
        _timer.Tick += async (_, _) => await _vm.RefreshAsync();

        PropertyChanged += (_, e) =>
        {
            if (e.Property == IsVisibleProperty)
            {
                if (IsVisible) _timer.Start();
                else _timer.Stop();
            }
        };

        Loaded += async (_, _) =>
        {
            await _vm.LoadAsync();
            _timer.Start();
        };
    }

    public void StopRefresh()
    {
        _timer.Stop();
    }

    private async void BtnRefresh_Click(object? sender, RoutedEventArgs e)
    {
        await _vm.RefreshAsync();
    }

    private void FilterBtn_Click(object? sender, RoutedEventArgs e)
    {
        if (sender is not Button btn || btn.Tag is not string filter) return;

        _vm.StatusFilter = filter;

        // Update button styles: active gets "primary", others get "small"
        foreach (var b in _filterButtons)
        {
            bool isActive = b == btn;
            b.Classes.Set("primary", isActive);
            b.Classes.Set("small", !isActive);
        }
    }

    private async void BtnView_Click(object? sender, RoutedEventArgs e)
    {
        if (sender is not Button { Tag: Order order }) return;

        var dlg = new Dialogs.OrderDetailDialog(order, _vm);
        await dlg.ShowDialog(TopLevel.GetTopLevel(this) as Window);
    }

    private async void BtnConfirmCash_Click(object? sender, RoutedEventArgs e)
    {
        if (sender is not Button { Tag: Order order }) return;

        await _vm.ConfirmPaymentAsync(order);
    }
}
