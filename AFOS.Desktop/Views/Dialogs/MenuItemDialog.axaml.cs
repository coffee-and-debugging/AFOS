using Avalonia.Controls;
using Avalonia.Interactivity;

namespace AFOS.Desktop.Views.Dialogs;

public partial class MenuItemDialog : Window
{
    private readonly Models.MenuItem? _editItem;
    public Models.MenuItem? ResultItem { get; private set; }

    public MenuItemDialog() { InitializeComponent(); CmbCategory.SelectedIndex = 0; }

    public MenuItemDialog(Models.MenuItem? item) : this()
    {
        _editItem = item;
        if (item != null)
        {
            TxtTitle.Text       = "Edit Menu Item";
            TxtName.Text        = item.Name;
            TxtDescription.Text = item.Description;
            TxtPrice.Text       = item.Price.ToString("0.00");
            ChkAvailable.IsChecked = item.Available;
            foreach (ComboBoxItem ci in CmbCategory.Items)
                if (ci.Tag?.ToString() == item.Category) { CmbCategory.SelectedItem = ci; break; }
        }
    }

    private void BtnSave_Click(object? sender, RoutedEventArgs e)
    {
        TxtError.IsVisible = false;
        var name = TxtName.Text?.Trim() ?? "";
        var desc = TxtDescription.Text?.Trim() ?? "";
        var priceStr = TxtPrice.Text?.Trim() ?? "";

        if (string.IsNullOrEmpty(name)) { ShowError("Name is required."); return; }
        if (!decimal.TryParse(priceStr, out var price) || price <= 0) { ShowError("Please enter a valid price."); return; }

        var cat = (CmbCategory.SelectedItem as ComboBoxItem)?.Tag?.ToString() ?? "tea";
        ResultItem = new Models.MenuItem
        {
            Id          = _editItem?.Id ?? 0,
            Name        = name,
            Description = desc,
            Price       = price,
            Category    = cat,
            Available   = ChkAvailable.IsChecked ?? true,
            ImageUrl    = _editItem?.ImageUrl
        };
        Close(true);
    }

    private void BtnCancel_Click(object? sender, RoutedEventArgs e) => Close(false);

    private void ShowError(string msg) { TxtError.Text = msg; TxtError.IsVisible = true; }
}
