using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;
using AFOS.Desktop.Models;
using AFOS.Desktop.ViewModels;
using AFOS.Desktop.Views.Dialogs;

namespace AFOS.Desktop.Views.Pages;

public partial class DashboardPage : UserControl
{
    private readonly DashboardViewModel _vm = new();
    private readonly DispatcherTimer _timer;

    public DashboardPage()
    {
        InitializeComponent();
        DataContext = _vm;

        _timer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(8) };
        _timer.Tick += async (_, _) => await _vm.RefreshAsync();

        IsVisibleChanged += (_, e) =>
        {
            if ((bool)e.NewValue) { _timer.Start(); _ = _vm.RefreshAsync(); }
            else _timer.Stop();
        };

        Loaded += async (_, _) => await _vm.LoadAsync();
    }

    public void StopRefresh() => _timer.Stop();

    private async void BtnRefresh_Click(object sender, RoutedEventArgs e)
        => await _vm.LoadAsync();

    private void FilterBtn_Click(object sender, RoutedEventArgs e)
    {
        if (sender is not Button btn) return;
        var tag = btn.Tag?.ToString() ?? "all";
        _vm.StatusFilter = tag;

        // Visually highlight the active filter
        var btns = new[] { BtnAll, BtnPending, BtnCooking, BtnServing, BtnCompleted };
        foreach (var b in btns)
        {
            b.Style = b.Tag?.ToString() == tag
                ? FindResource("BtnPrimary")   as Style
                : FindResource("BtnSecondary") as Style;
        }
    }

    private void BtnView_Click(object sender, RoutedEventArgs e)
    {
        if (sender is Button btn && btn.Tag is Order order)
        {
            var dlg = new OrderDetailDialog(order, _vm) { Owner = Window.GetWindow(this) };
            dlg.ShowDialog();
        }
    }

    private async void BtnConfirmCash_Click(object sender, RoutedEventArgs e)
    {
        if (sender is Button btn && btn.Tag is Order order)
        {
            var result = MessageBox.Show(
                $"Confirm cash payment of {order.TotalDisplay} for Table #{order.TableNumber}?",
                "Confirm Cash Payment",
                MessageBoxButton.YesNo,
                MessageBoxImage.Question);

            if (result == MessageBoxResult.Yes)
                await _vm.ConfirmPaymentAsync(order);
        }
    }
}
