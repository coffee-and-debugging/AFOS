using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using AFOS.Desktop.Models;
using AFOS.Desktop.ViewModels;

namespace AFOS.Desktop.Views.Dialogs;

public partial class OrderDetailDialog : Window
{
    private readonly Order _order;
    private readonly DashboardViewModel _vm;
    private bool _suppressStatusChange;

    public OrderDetailDialog(Order order, DashboardViewModel vm)
    {
        InitializeComponent();
        _order = order;
        _vm    = vm;
        PopulateUI();
    }

    private void PopulateUI()
    {
        RunOrderId.Text    = _order.ShortId;
        TxtTableInfo.Text  = $"Table #{_order.TableNumber}  •  {_order.TimeDisplay}";
        TxtTotal.Text      = _order.TotalDisplay;
        TxtDate.Text       = $"Placed: {_order.CreatedAt:dddd, MMMM dd yyyy  hh:mm tt}";

        ItemsList.ItemsSource = _order.Items;

        // Status badge
        StatusBadge.Background = StatusColor(_order.Status);
        TxtStatus.Foreground   = StatusFg(_order.Status);
        TxtStatus.Text         = _order.StatusDisplay;

        // Payment badge
        PayBadge.Background    = PayColor(_order.PaymentStatus);
        TxtPayment.Foreground  = PayFg(_order.PaymentStatus);
        TxtPayment.Text        = _order.PaymentStatusDisplay;

        // Note
        if (!string.IsNullOrWhiteSpace(_order.CustomerNote))
        {
            NoteBox.Visibility = Visibility.Visible;
            TxtNote.Text       = $"Note: {_order.CustomerNote}";
        }

        // Confirm cash
        BtnConfirmCash.Visibility = _order.CanConfirmCash
            ? Visibility.Visible : Visibility.Collapsed;

        // Status combo
        _suppressStatusChange = true;
        foreach (ComboBoxItem ci in CmbStatus.Items)
            if (ci.Tag?.ToString() == _order.Status)
            {
                CmbStatus.SelectedItem = ci;
                break;
            }
        _suppressStatusChange = false;
    }

    private async void CmbStatus_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (_suppressStatusChange) return;
        if (CmbStatus.SelectedItem is ComboBoxItem ci)
        {
            var newStatus = ci.Tag?.ToString() ?? "";
            if (newStatus != _order.Status)
                await _vm.UpdateStatusAsync(_order, newStatus);
        }
    }

    private async void BtnConfirmCash_Click(object sender, RoutedEventArgs e)
    {
        await _vm.ConfirmPaymentAsync(_order);
        BtnConfirmCash.Visibility = Visibility.Collapsed;
        PayBadge.Background       = PayColor("paid");
        TxtPayment.Foreground     = PayFg("paid");
        TxtPayment.Text           = "Paid (counter)";
    }

    private void BtnClose_Click(object sender, RoutedEventArgs e) => Close();

    private static SolidColorBrush StatusColor(string s) => Brush(s switch
    {
        "pending"   => "#fff3cd",
        "cooking"   => "#cff4fc",
        "serving"   => "#d1e7dd",
        "completed" => "#e2e3e5",
        _           => "#e2e3e5"
    });

    private static SolidColorBrush StatusFg(string s) => Brush(s switch
    {
        "pending"   => "#856404",
        "cooking"   => "#055160",
        "serving"   => "#0a3622",
        "completed" => "#41464b",
        _           => "#41464b"
    });

    private static SolidColorBrush PayColor(string s) => Brush(s switch
    {
        "paid"            => "#d1e7dd",
        "pending_counter" => "#fff3cd",
        "unpaid"          => "#f8d7da",
        _                 => "#e2e3e5"
    });

    private static SolidColorBrush PayFg(string s) => Brush(s switch
    {
        "paid"            => "#0a3622",
        "pending_counter" => "#856404",
        "unpaid"          => "#842029",
        _                 => "#41464b"
    });

    private static SolidColorBrush Brush(string hex)
        => new((Color)ColorConverter.ConvertFromString(hex));
}
