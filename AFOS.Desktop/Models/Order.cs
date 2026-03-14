using Avalonia.Media;

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
    public bool IsCompleted => Status == "completed";

    public string NextActionLabel => Status switch
    {
        "pending"   => "Mark as Cooking",
        "cooking"   => "Mark as Serving",
        "serving"   => "Mark as Completed",
        "completed" => "Completed",
        _           => ""
    };

    // Progress dots for chef cards (3 dots + 2 lines)
    private static readonly ISolidColorBrush ActiveBrush = new SolidColorBrush(Color.Parse("#2d6a4f"));
    private static readonly ISolidColorBrush InactiveBrush = new SolidColorBrush(Color.Parse("#dee2e6"));

    private int StepIndex => Status switch
    {
        "pending" => 0,
        "cooking" => 1,
        "serving" => 2,
        "completed" => 3,
        _ => 0
    };

    public ISolidColorBrush ProgressDot2Brush => StepIndex >= 1 ? ActiveBrush : InactiveBrush;
    public ISolidColorBrush ProgressDot3Brush => StepIndex >= 2 ? ActiveBrush : InactiveBrush;
    public ISolidColorBrush ProgressLine1Brush => StepIndex >= 1 ? ActiveBrush : InactiveBrush;
    public ISolidColorBrush ProgressLine2Brush => StepIndex >= 2 ? ActiveBrush : InactiveBrush;

    public string CompletedText
    {
        get
        {
            var text = "✓ Order completed";
            if (PaymentStatus == "paid" && PaymentMethod != null)
                text += $" · Paid ({PaymentMethod.ToUpper()})";
            else if (PaymentStatus == "pending_counter")
                text += " · Pay at counter";
            else if (PaymentStatus == "unpaid")
                text += " · Unpaid";
            return text;
        }
    }
}
