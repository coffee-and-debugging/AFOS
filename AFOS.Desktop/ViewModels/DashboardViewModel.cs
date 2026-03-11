using System.Collections.ObjectModel;
using System.Windows.Media;
using AFOS.Desktop.Database;
using AFOS.Desktop.Models;

namespace AFOS.Desktop.ViewModels;

public class ChartBar
{
    public string Label { get; set; } = "";
    public double Value { get; set; }
    public double BarHeight { get; set; }
    public SolidColorBrush BarBrush { get; set; } = Brushes.Gray;
    public string DisplayValue => ((int)Value).ToString();
    public string DisplayRs => $"Rs. {Value:0}";
}

public class DashboardViewModel : BaseViewModel
{
    private int _totalOrders, _pending, _cooking, _serving, _completed;
    private decimal _revenue, _cashPending;
    private string _statusFilter = "all";
    private bool _isLoading;
    private string _lastUpdated = "";

    public int TotalOrders   { get => _totalOrders; set => SetField(ref _totalOrders, value); }
    public int Pending        { get => _pending;     set => SetField(ref _pending, value); }
    public int Cooking        { get => _cooking;     set => SetField(ref _cooking, value); }
    public int Serving        { get => _serving;     set => SetField(ref _serving, value); }
    public int Completed      { get => _completed;   set => SetField(ref _completed, value); }
    public decimal Revenue    { get => _revenue;     set { SetField(ref _revenue, value); OnPropertyChanged(nameof(RevenueDisplay)); } }
    public decimal CashPending{ get => _cashPending; set { SetField(ref _cashPending, value); OnPropertyChanged(nameof(CashPendingDisplay)); OnPropertyChanged(nameof(HasCashPending)); } }
    public bool IsLoading     { get => _isLoading;   set => SetField(ref _isLoading, value); }
    public string LastUpdated { get => _lastUpdated; set => SetField(ref _lastUpdated, value); }

    public string RevenueDisplay      => $"Rs. {Revenue:0.00}";
    public string CashPendingDisplay  => $"Rs. {CashPending:0.00}";
    public bool HasCashPending        => CashPending > 0;

    public string StatusFilter
    {
        get => _statusFilter;
        set { SetField(ref _statusFilter, value); ApplyFilter(); }
    }

    public ObservableCollection<Order> AllOrders    { get; } = new();
    public ObservableCollection<Order> FilteredOrders { get; } = new();
    public ObservableCollection<ChartBar> StatusChartData  { get; } = new();
    public ObservableCollection<ChartBar> RevenueChartData { get; } = new();

    // Pie data (paid vs unpaid)
    public int PaidCount   { get; private set; }
    public int UnpaidCount { get; private set; }

    public async Task LoadAsync()
    {
        IsLoading = true;
        try
        {
            var stats = await DatabaseService.Instance.GetDashboardStatsAsync();
            UpdateFromStats(stats);
        }
        catch { /* silently fail on refresh */ }
        finally { IsLoading = false; }
    }

    public async Task RefreshAsync()
    {
        try
        {
            var stats = await DatabaseService.Instance.GetDashboardStatsAsync();
            UpdateFromStats(stats);
        }
        catch { }
    }

    private void UpdateFromStats(DashboardStats stats)
    {
        TotalOrders  = stats.TotalOrders;
        Pending      = stats.Pending;
        Cooking      = stats.Cooking;
        Serving      = stats.Serving;
        Completed    = stats.Completed;
        Revenue      = stats.RevenueCollected;
        CashPending  = stats.CashPending;
        LastUpdated  = $"Updated {DateTime.Now:hh:mm:ss tt}";

        AllOrders.Clear();
        foreach (var o in stats.Orders) AllOrders.Add(o);
        ApplyFilter();

        // Charts
        double maxStatus = Math.Max(1, new[] { (double)Pending, Cooking, Serving, Completed }.Max());
        double maxH = 130;

        StatusChartData.Clear();
        StatusChartData.Add(new ChartBar { Label = "Pending",   Value = Pending,   BarHeight = Pending   / maxStatus * maxH, BarBrush = Brush("#fd7e14") });
        StatusChartData.Add(new ChartBar { Label = "Cooking",   Value = Cooking,   BarHeight = Cooking   / maxStatus * maxH, BarBrush = Brush("#0dcaf0") });
        StatusChartData.Add(new ChartBar { Label = "Serving",   Value = Serving,   BarHeight = Serving   / maxStatus * maxH, BarBrush = Brush("#2d6a4f") });
        StatusChartData.Add(new ChartBar { Label = "Completed", Value = Completed, BarHeight = Completed / maxStatus * maxH, BarBrush = Brush("#adb5bd") });

        double maxRev = Math.Max(1, new[] { (double)stats.EsewaRevenue, (double)stats.KhaltiRevenue, (double)stats.CounterRevenue }.Max());
        RevenueChartData.Clear();
        RevenueChartData.Add(new ChartBar { Label = "eSewa",   Value = (double)stats.EsewaRevenue,   BarHeight = (double)stats.EsewaRevenue   / maxRev * maxH, BarBrush = Brush("#3BB143") });
        RevenueChartData.Add(new ChartBar { Label = "Khalti",  Value = (double)stats.KhaltiRevenue,  BarHeight = (double)stats.KhaltiRevenue  / maxRev * maxH, BarBrush = Brush("#5C2D91") });
        RevenueChartData.Add(new ChartBar { Label = "Counter", Value = (double)stats.CounterRevenue, BarHeight = (double)stats.CounterRevenue / maxRev * maxH, BarBrush = Brush("#fd7e14") });

        PaidCount   = stats.Orders.Count(o => o.PaymentStatus == "paid");
        UnpaidCount = stats.Orders.Count(o => o.PaymentStatus != "paid");
        OnPropertyChanged(nameof(PaidCount));
        OnPropertyChanged(nameof(UnpaidCount));
    }

    private void ApplyFilter()
    {
        FilteredOrders.Clear();
        var src = _statusFilter == "all"
            ? AllOrders
            : AllOrders.Where(o => o.Status == _statusFilter);
        foreach (var o in src) FilteredOrders.Add(o);
    }

    public async Task ConfirmPaymentAsync(Order order)
    {
        await DatabaseService.Instance.ConfirmPaymentAsync(order.Id);
        await RefreshAsync();
    }

    public async Task UpdateStatusAsync(Order order, string newStatus)
    {
        await DatabaseService.Instance.UpdateOrderStatusAsync(order.Id, newStatus);
        await RefreshAsync();
    }

    private static SolidColorBrush Brush(string hex)
        => new((Color)ColorConverter.ConvertFromString(hex));
}
