namespace AFOS.Desktop.Models;

public class OrderItem
{
    public string Id { get; set; } = "";
    public string OrderId { get; set; } = "";
    public string MenuItemId { get; set; } = "";
    public string Name { get; set; } = "";
    public decimal Price { get; set; }
    public int Quantity { get; set; }
    public decimal Subtotal { get; set; }

    public string Display => $"{Name} x{Quantity} — Rs. {Subtotal:0.00}";
}
