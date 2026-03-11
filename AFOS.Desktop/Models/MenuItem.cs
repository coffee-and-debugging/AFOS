namespace AFOS.Desktop.Models;

public class MenuItem
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public decimal Price { get; set; }
    public string Category { get; set; } = "tea"; // tea | food
    public bool Available { get; set; } = true;
    public string? ImageUrl { get; set; }

    public string CategoryDisplay => Category == "tea" ? "Tea" : "Food";
    public string AvailableDisplay => Available ? "Yes" : "No";
    public string PriceDisplay => $"Rs. {Price:0.00}";
}
