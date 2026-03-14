using Avalonia.Controls;
using Avalonia.Interactivity;
using Avalonia.Media;
using AFOS.Desktop.Models;
using AFOS.Desktop.ViewModels;

namespace AFOS.Desktop.Views.Dialogs;

public partial class OrderDetailDialog : Window
{
    private readonly Order _order;
    private readonly DashboardViewModel _vm;
    private bool _suppressStatusChange;

    public OrderDetailDialog() { InitializeComponent(); _order = new Order(); _vm = new DashboardViewModel(); }

    public OrderDetailDialog(Order order, DashboardViewModel vm) : this()
    {
        _order = order;
        _vm    = vm;
        PopulateUI();
    }

    private void PopulateUI()
    {
        TxtOrderTitle.Text = $"Order #{_order.ShortId}";
        TxtTableInfo.Text  = $"Table #{_order.TableNumber}  •  {_order.TimeDisplay}";
        TxtTotal.Text      = _order.TotalDisplay;
        TxtDate.Text       = $"Placed: {_order.CreatedAt:dddd, MMMM dd yyyy  hh:mm tt}";
        ItemsList.ItemsSource = _order.Items;

        StatusBadge.Background = BgBrush(_order.Status switch { "pending"=>"#fff3cd", "cooking"=>"#cff4fc", "serving"=>"#d1e7dd", _=>"#e2e3e5" });
        TxtStatus.Foreground   = FgBrush(_order.Status switch { "pending"=>"#856404", "cooking"=>"#055160", "serving"=>"#0a3622", _=>"#41464b" });
        TxtStatus.Text         = _order.StatusDisplay;

        PayBadge.Background    = BgBrush(_order.PaymentStatus switch { "paid"=>"#d1e7dd", "pending_counter"=>"#fff3cd", "unpaid"=>"#f8d7da", _=>"#e2e3e5" });
        TxtPayment.Foreground  = FgBrush(_order.PaymentStatus switch { "paid"=>"#0a3622", "pending_counter"=>"#856404", "unpaid"=>"#842029", _=>"#41464b" });
        TxtPayment.Text        = _order.PaymentStatusDisplay;

        if (!string.IsNullOrWhiteSpace(_order.CustomerNote))
        {
            NoteBox.IsVisible = true;
            TxtNote.Text      = $"Note: {_order.CustomerNote}";
        }

        BtnConfirmCash.IsVisible = _order.CanConfirmCash;

        _suppressStatusChange = true;
        foreach (ComboBoxItem ci in CmbStatus.Items)
            if (ci.Tag?.ToString() == _order.Status) { CmbStatus.SelectedItem = ci; break; }
        _suppressStatusChange = false;
    }

    private async void CmbStatus_SelectionChanged(object? sender, SelectionChangedEventArgs e)
    {
        if (_suppressStatusChange) return;
        if (CmbStatus.SelectedItem is ComboBoxItem ci)
        {
            var newStatus = ci.Tag?.ToString() ?? "";
            if (newStatus != _order.Status)
                await _vm.UpdateStatusAsync(_order, newStatus);
        }
    }

    private async void BtnConfirmCash_Click(object? sender, RoutedEventArgs e)
    {
        await _vm.ConfirmPaymentAsync(_order);
        BtnConfirmCash.IsVisible = false;
        PayBadge.Background   = BgBrush("#d1e7dd");
        TxtPayment.Foreground = FgBrush("#0a3622");
        TxtPayment.Text       = "Paid (counter)";
    }

    private void BtnClose_Click(object? sender, RoutedEventArgs e) => Close();

    private static SolidColorBrush BgBrush(string hex) => new(Color.Parse(hex));
    private static SolidColorBrush FgBrush(string hex) => new(Color.Parse(hex));
}
