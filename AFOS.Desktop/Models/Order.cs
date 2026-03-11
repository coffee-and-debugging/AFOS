namespace AFOS.Desktop.Models;

public class Order
{
    public string Id { get; set; } = "";
    public string TableId { get; set; } = "";
    public int TableNumber { get; set; }
    public List<OrderItem> Items { get; set; } = new();
    public string? CustomerNote { get; set; }
    public string Status { get; set; } = "pending"; // pending | cooking | serving | completed
    public string PaymentStatus { get; set; } = "unpaid"; // unpaid | paid | pending_counter
    public string? PaymentMethod { get; set; } // esewa | khalti | counter
    public decimal TotalAmount { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public string ShortId => Id.Length > 8 ? Id[..8].ToUpper() : Id.ToUpper();
    public string TotalDisplay => $"Rs. {TotalAmount:0.00}";
    public string ItemsDisplay => $"{Items.Count} item{(Items.Count != 1 ? "s" : "")}";
    public string TimeDisplay => CreatedAt.ToString("MMM dd, hh:mm tt");
    public bool CanConfirmCash => PaymentStatus == "pending_counter";

    public string StatusDisplay => Status switch
    {
        "pending" => "Pending",
        "cooking" => "Cooking",
        "serving" => "Serving",
        "completed" => "Completed",
        _ => Status
    };

    public string PaymentStatusDisplay => PaymentStatus switch
    {
        "paid" => $"Paid{(PaymentMethod != null ? $" ({PaymentMethod})" : "")}",
        "pending_counter" => "Cash Pending",
        "unpaid" => "Unpaid",
        _ => PaymentStatus
    };

    public string TimeAgo
    {
        get
        {
            var diff = DateTime.UtcNow - CreatedAt.ToUniversalTime();
            if (diff.TotalSeconds < 60) return $"{(int)diff.TotalSeconds}s ago";
            if (diff.TotalMinutes < 60) return $"{(int)diff.TotalMinutes}m ago";
            return $"{(int)diff.TotalHours}h ago";
        }
    }

    public bool CanAdvance => Status != "completed";

    public string NextActionLabel => Status switch
    {
        "pending"   => "Mark Cooking",
        "cooking"   => "Mark Serving",
        "serving"   => "Mark Completed",
        "completed" => "✓  Completed",
        _           => ""
    };
}
