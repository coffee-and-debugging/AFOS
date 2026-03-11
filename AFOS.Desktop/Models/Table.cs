namespace AFOS.Desktop.Models;

public class Table
{
    public string Id { get; set; } = "";
    public int Number { get; set; }
    public string CustomerUrl => $"/table/{Id}";
}
