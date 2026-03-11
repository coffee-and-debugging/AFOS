namespace AFOS.Desktop.Models;

public class DashboardStats
{
    public int TotalOrders { get; set; }
    public int Pending { get; set; }
    public int Cooking { get; set; }
    public int Serving { get; set; }
    public int Completed { get; set; }
    public decimal RevenueCollected { get; set; }
    public decimal CashPending { get; set; }
    public List<Order> Orders { get; set; } = new();

    public decimal EsewaRevenue => Orders
        .Where(o => o.PaymentStatus == "paid" && o.PaymentMethod == "esewa")
        .Sum(o => o.TotalAmount);

    public decimal KhaltiRevenue => Orders
        .Where(o => o.PaymentStatus == "paid" && o.PaymentMethod == "khalti")
        .Sum(o => o.TotalAmount);

    public decimal CounterRevenue => Orders
        .Where(o => o.PaymentStatus == "paid" && o.PaymentMethod == "counter")
        .Sum(o => o.TotalAmount);
}
