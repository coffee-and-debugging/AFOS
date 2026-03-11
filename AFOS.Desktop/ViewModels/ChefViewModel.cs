using System.Collections.ObjectModel;
using AFOS.Desktop.Database;
using AFOS.Desktop.Models;

namespace AFOS.Desktop.ViewModels;

public class ChefViewModel : BaseViewModel
{
    private int _pending, _cooking, _serving, _completed;
    private string _filter = "active";
    private bool _isLoading;
    private string _welcomeName = "";

    public int Pending   { get => _pending;   set => SetField(ref _pending, value); }
    public int Cooking   { get => _cooking;   set => SetField(ref _cooking, value); }
    public int Serving   { get => _serving;   set => SetField(ref _serving, value); }
    public int Completed { get => _completed; set => SetField(ref _completed, value); }
    public bool IsLoading   { get => _isLoading;   set => SetField(ref _isLoading, value); }
    public string WelcomeName { get => _welcomeName; set => SetField(ref _welcomeName, value); }

    public string Filter
    {
        get => _filter;
        set { SetField(ref _filter, value); ApplyFilter(); }
    }

    public ObservableCollection<Order> AllOrders      { get; } = new();
    public ObservableCollection<Order> FilteredOrders { get; } = new();

    public bool HasNewOrders => Pending > 0;
    public string NewBadge   => Pending > 0 ? $"{Pending} new" : "";

    public ChefViewModel(User user)
    {
        WelcomeName = user.Name;
    }

    public async Task LoadAsync()
    {
        IsLoading = true;
        try   { await RefreshAsync(); }
        finally { IsLoading = false; }
    }

    public async Task RefreshAsync()
    {
        try
        {
            var orders = await DatabaseService.Instance.GetOrdersAsync();
            Pending   = orders.Count(o => o.Status == "pending");
            Cooking   = orders.Count(o => o.Status == "cooking");
            Serving   = orders.Count(o => o.Status == "serving");
            Completed = orders.Count(o => o.Status == "completed");
            OnPropertyChanged(nameof(HasNewOrders));
            OnPropertyChanged(nameof(NewBadge));

            AllOrders.Clear();
            foreach (var o in orders) AllOrders.Add(o);
            ApplyFilter();
        }
        catch { }
    }

    private void ApplyFilter()
    {
        FilteredOrders.Clear();
        IEnumerable<Order> src = Filter switch
        {
            "active"    => AllOrders.Where(o => o.Status == "pending" || o.Status == "cooking"),
            "serving"   => AllOrders.Where(o => o.Status == "serving"),
            "completed" => AllOrders.Where(o => o.Status == "completed"),
            _           => AllOrders
        };
        foreach (var o in src) FilteredOrders.Add(o);
    }

    public async Task<bool> AdvanceStatusAsync(Order order)
    {
        string? next = order.Status switch
        {
            "pending" => "cooking",
            "cooking" => "serving",
            "serving" => "completed",
            _         => null
        };
        if (next == null) return false;

        var ok = await DatabaseService.Instance.UpdateOrderStatusAsync(order.Id, next);
        if (ok) await RefreshAsync();
        return ok;
    }

    public string NextStatusLabel(Order order) => order.Status switch
    {
        "pending" => "Mark Cooking",
        "cooking" => "Mark Serving",
        "serving" => "Mark Completed",
        _         => ""
    };
}
